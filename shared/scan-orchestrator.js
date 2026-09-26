/**
 * WhatStack Scan Orchestrator — manages tab scan caching, light/deep orchestration,
 * content script fallback injection, MAIN-world evaluation, and badge application.
 *
 * Flow per page load:
 *   content script  ──LIGHT_SCAN──▶ lightScan()   (DOM + asset signals, instant badge)
 *                                     └─ scheduleDeep() → deepScan() with the MAIN-world
 *                                        probe, so the badge counts what the popup shows
 *   popup           ──GET_RESULT──▶ deepScan()    (always re-collects: Rescan is real)
 */

import { detect, mergeDeepSignals, badgeCount, mainWorldProbeSource } from './detect.js';
import { isRestrictedUrl, sameDocument } from './url-policy.js';

export { isRestrictedUrl };

/** Budgets: a hung or hostile page must never leave the popup on "Scanning…". */
export const PROBE_TIMEOUT_MS = 3000;
export const COLLECT_TIMEOUT_MS = 2500;
/** Coalesces the load-time and +1.5s LIGHT_SCAN posts into one background probe. */
export const BACKGROUND_DEEP_DELAY_MS = 350;
/** After an SPA route change, wait for the new route to render. */
export const SPA_RESCAN_DELAY_MS = 1200;

const TIMED_OUT = Symbol('timeout');

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<T | typeof TIMED_OUT>}
 */
function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(TIMED_OUT), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** @param {string} url */
function emptySignals(url) {
  return { url, scripts: [], stylesheets: [], cookies: [], metas: [], inlineSamples: [], domFlags: [], globals: {}, pass: 'light' };
}

/** @param {number} n */
export function technologiesLabel(n) {
  return `${n} ${n === 1 ? 'technology' : 'technologies'}`;
}

export class ScanOrchestrator {
  /**
   * @param {object} [chromeApi] Optional Chrome API adapter for testing
   * @param {{ backgroundDelayMs?: number, spaDelayMs?: number, probeTimeoutMs?: number, collectTimeoutMs?: number }} [opts]
   */
  constructor(chromeApi = typeof chrome !== 'undefined' ? chrome : null, opts = {}) {
    this.chrome = chromeApi;
    /** @type {Map<number, { url: string, result: import('./detect.js').ScanResult, signals?: object, globals?: object }>} */
    this.tabCache = new Map();
    /**
     * Entries are normally dropped by tabs.onRemoved, but that event is missed
     * whenever the MV3 worker is asleep, so the map would otherwise only ever
     * grow. Each entry holds a full signal set, so cap it and evict
     * oldest-first.
     */
    this.maxCachedTabs = 25;
    /** @type {Map<number, ReturnType<typeof setTimeout>>} */
    this.timers = new Map();
    this.backgroundDelayMs = opts.backgroundDelayMs ?? BACKGROUND_DEEP_DELAY_MS;
    this.spaDelayMs = opts.spaDelayMs ?? SPA_RESCAN_DELAY_MS;
    this.probeTimeoutMs = opts.probeTimeoutMs ?? PROBE_TIMEOUT_MS;
    this.collectTimeoutMs = opts.collectTimeoutMs ?? COLLECT_TIMEOUT_MS;
  }

  /**
   * Store a scan result, evicting the oldest entry past the cap.
   * @param {number} tabId
   * @param {{ url: string, result: import('./detect.js').ScanResult, signals?: object, globals?: object }} entry
   */
  cacheResult(tabId, entry) {
    // Re-insert so Map iteration order tracks recency.
    this.tabCache.delete(tabId);
    this.tabCache.set(tabId, entry);
    while (this.tabCache.size > this.maxCachedTabs) {
      const oldest = this.tabCache.keys().next();
      if (oldest.done) break;
      this.tabCache.delete(oldest.value);
    }
  }

  /**
   * Render badge text, color, and title for a tab.
   * @param {number} tabId
   * @param {import('./detect.js').ScanResult} result
   */
  async applyBadge(tabId, result) {
    if (!this.chrome || !this.chrome.action) return;
    const count = badgeCount(result);
    const text = count > 0 ? String(Math.min(count, 99)) : '';
    const title = result.primary
      ? `WhatStack: ${result.primary.name}${count ? ` · ${technologiesLabel(count)}` : ''}`
      : count
        ? `WhatStack: ${technologiesLabel(count)}`
        : 'WhatStack: nothing solid detected';
    try {
      await this.chrome.action.setBadgeText({ tabId, text });
      await this.chrome.action.setBadgeBackgroundColor({ tabId, color: '#2563eb' });
      await this.chrome.action.setTitle({ tabId, title });
    } catch {
      /* tab gone or unavailable */
    }
  }

  /** @param {number} tabId */
  async clearBadge(tabId) {
    if (!this.chrome || !this.chrome.action) return;
    try {
      await this.chrome.action.setBadgeText({ tabId, text: '' });
    } catch {
      /* tab gone */
    }
  }

  /**
   * Execute MAIN-world probe via scripting API.
   * @param {number} tabId
   * @returns {Promise<Record<string, unknown> | null>} null when the page could not be probed
   */
  async probeMainWorld(tabId) {
    if (!this.chrome || !this.chrome.scripting) return null;
    try {
      const out = await withTimeout(
        this.chrome.scripting.executeScript({
          target: { tabId },
          world: 'MAIN',
          func: mainWorldProbeSource(),
        }),
        this.probeTimeoutMs,
      );
      if (out === TIMED_OUT || !Array.isArray(out) || !out[0]) return null;
      const result = out[0].result;
      return result && typeof result === 'object' ? result : {};
    } catch {
      return null;
    }
  }

  /**
   * Collect light signals from content script, with fallback injection.
   * @param {number} tabId
   */
  async collectFromContent(tabId) {
    if (!this.chrome || !this.chrome.tabs) return null;
    const ask = async () => {
      const response = await withTimeout(
        this.chrome.tabs.sendMessage(tabId, { type: 'COLLECT_SIGNALS' }),
        this.collectTimeoutMs,
      );
      if (response !== TIMED_OUT && response && response.ok && response.signals) return response.signals;
      return null;
    };
    try {
      const signals = await ask();
      if (signals) return signals;
    } catch {
      /* content script may be missing — inject */
    }

    if (!this.chrome.scripting) return null;
    try {
      await withTimeout(
        this.chrome.scripting.executeScript({ target: { tabId }, files: ['content/content-script.js'] }),
        this.collectTimeoutMs,
      );
      return await ask();
    } catch {
      return null;
    }
  }

  /**
   * Perform a deep scan for a tab: fresh light signals + MAIN-world probe.
   * @param {number} tabId
   * @param {string} url
   * @param {{ signals?: object | null }} [opts] pre-collected light signals (from LIGHT_SCAN)
   */
  async deepScan(tabId, url, opts = {}) {
    if (isRestrictedUrl(url)) {
      return { url, scannedAt: Date.now(), pass: 'deep', hits: [], primary: null, error: 'restricted' };
    }

    // Always re-collect: Rescan must see scripts, widgets and DOM that arrived
    // after the load-time light pass, and a reload of the same URL is a new
    // document. The cache is only a fallback when collection fails.
    let light = opts.signals || (await this.collectFromContent(tabId));
    if (!light) {
      const cached = this.tabCache.get(tabId);
      if (cached && sameDocument(cached.url, url) && cached.signals) light = cached.signals;
    }

    const globals = await this.probeMainWorld(tabId);

    if (!light && globals === null) {
      // Neither the content script nor the probe could run. That is a page
      // Chrome keeps extensions out of, not a page with nothing on it.
      return { url, scannedAt: Date.now(), pass: 'deep', hits: [], primary: null, error: 'unreachable' };
    }
    if (!light) light = emptySignals(url);

    // The document that answered is the truth. If the tab navigated while the
    // popup was opening, label the result with the page it describes.
    const docUrl = light.url || url;
    const merged = mergeDeepSignals(light, globals || {});
    merged.url = docUrl;
    const result = detect(merged);
    this.cacheResult(tabId, { url: docUrl, result, signals: light, globals: globals || {} });
    await this.applyBadge(tabId, result);
    return result;
  }

  /**
   * Light scan from content-script signals, then a background deep pass so the
   * badge reflects runtime proof too.
   * @param {number} tabId
   * @param {object} signals
   */
  async lightScan(tabId, signals) {
    const url = signals.url || '';
    if (isRestrictedUrl(url)) return null;
    const cached = this.tabCache.get(tabId);

    let result;
    if (cached && sameDocument(cached.url, url) && cached.result.pass === 'deep' && cached.globals) {
      // Monotonic: never let a later light post knock a deep result back down.
      // Re-run the engine on the fresh DOM with the last runtime globals.
      result = detect({ ...mergeDeepSignals(signals, cached.globals), url });
      this.cacheResult(tabId, { url, result, signals, globals: cached.globals });
    } else {
      result = detect({ ...signals, pass: 'light' });
      this.cacheResult(tabId, { url, result, signals: { ...signals, pass: 'light' } });
    }
    await this.applyBadge(tabId, result);
    this.scheduleDeep(tabId, url, signals);
    return result;
  }

  /**
   * @param {number} tabId
   * @param {string} url
   * @param {object | null} signals
   * @param {number} [delay]
   */
  scheduleDeep(tabId, url, signals, delay = this.backgroundDelayMs) {
    this.cancelScheduled(tabId);
    const timer = setTimeout(() => {
      this.timers.delete(tabId);
      this.backgroundDeep(tabId, url, signals).catch(() => {});
    }, delay);
    this.timers.set(tabId, timer);
  }

  /** @param {number} tabId */
  cancelScheduled(tabId) {
    const t = this.timers.get(tabId);
    if (t) clearTimeout(t);
    this.timers.delete(tabId);
  }

  /**
   * @param {number} tabId
   * @param {string} url
   * @param {object | null} signals
   */
  async backgroundDeep(tabId, url, signals) {
    // Skip if the tab moved on in the meantime.
    if (this.chrome && this.chrome.tabs && this.chrome.tabs.get) {
      try {
        const tab = await this.chrome.tabs.get(tabId);
        if (!tab || !sameDocument(tab.url || '', url)) return null;
      } catch {
        return null;
      }
    }
    return this.deepScan(tabId, url, { signals });
  }

  /**
   * Get cached result or run scan if stale/forced.
   * @param {object} params
   * @param {number} params.tabId
   * @param {string} [params.url]
   * @param {boolean} [params.forceDeep]
   */
  async getResult({ tabId, url = '', forceDeep = false }) {
    const cached = this.tabCache.get(tabId);
    const stale = !cached || !sameDocument(cached.url, url) || cached.result.pass !== 'deep';
    if (forceDeep || stale) {
      this.cancelScheduled(tabId);
      return this.deepScan(tabId, url);
    }
    return cached.result;
  }

  /**
   * Raw inputs for tooling (golden corpus capture, browser tests).
   * @param {number} tabId
   */
  async capture(tabId) {
    const light = await this.collectFromContent(tabId);
    const globals = await this.probeMainWorld(tabId);
    return { light, globals };
  }

  /**
   * Invalidate tab cache on tab close or navigation.
   * @param {number} tabId
   * @param {string} [newUrl] when given, keep the entry if it is for the same document
   */
  invalidateTab(tabId, newUrl) {
    if (!newUrl) {
      this.cancelScheduled(tabId);
      this.tabCache.delete(tabId);
      return;
    }
    const cached = this.tabCache.get(tabId);
    if (cached && !sameDocument(cached.url, newUrl)) {
      this.cancelScheduled(tabId);
      this.tabCache.delete(tabId);
    }
  }

  /**
   * The tab finished loading. After an SPA route change nothing re-runs the
   * content script, so rescan when the cache no longer describes this URL.
   * @param {number} tabId
   * @param {string} url
   */
  onTabComplete(tabId, url) {
    if (isRestrictedUrl(url)) return;
    const cached = this.tabCache.get(tabId);
    if (cached && sameDocument(cached.url, url)) return;
    if (this.timers.has(tabId)) return;
    this.clearBadge(tabId);
    this.scheduleDeep(tabId, url, null, this.spaDelayMs);
  }
}
