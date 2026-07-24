/**
 * WhatStack Scan Orchestrator — manages tab scan caching, light/deep orchestration,
 * content script fallback injection, MAIN-world evaluation, and badge application.
 */

import {
  detect,
  mergeDeepSignals,
  badgeCount,
  mainWorldProbeSource,
} from './detect.js';

export function isRestrictedUrl(url) {
  if (!url) return true;
  return /^(chrome|chrome-extension|edge|about|devtools|view-source):/i.test(url);
}

export class ScanOrchestrator {
  /**
   * @param {object} [chromeApi] Optional Chrome API adapter for testing
   */
  constructor(chromeApi = typeof chrome !== 'undefined' ? chrome : null) {
    this.chrome = chromeApi;
    /** @type {Map<number, { url: string, result: import('./detect.js').ScanResult, signals?: object }>} */
    this.tabCache = new Map();
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
      ? `WhatStack: ${result.primary.name}${count ? ` · ${count} signals` : ''}`
      : count
        ? `WhatStack: ${count} stack signals`
        : 'WhatStack: no high/medium signals';
    try {
      await this.chrome.action.setBadgeText({ tabId, text });
      await this.chrome.action.setBadgeBackgroundColor({ tabId, color: '#2563eb' });
      await this.chrome.action.setTitle({ tabId, title });
    } catch {
      /* tab gone or unavailable */
    }
  }

  /**
   * Execute MAIN-world probe via scripting API.
   * @param {number} tabId
   */
  async probeMainWorld(tabId) {
    if (!this.chrome || !this.chrome.scripting) return {};
    try {
      const [{ result }] = await this.chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: mainWorldProbeSource(),
      });
      return result || {};
    } catch {
      return {};
    }
  }

  /**
   * Collect light signals from content script, with fallback injection.
   * @param {number} tabId
   */
  async collectFromContent(tabId) {
    if (!this.chrome || !this.chrome.tabs) return null;
    try {
      const response = await this.chrome.tabs.sendMessage(tabId, { type: 'COLLECT_SIGNALS' });
      if (response && response.ok && response.signals) return response.signals;
    } catch {
      /* content script may be missing — inject */
    }

    if (!this.chrome.scripting) return null;
    try {
      await this.chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/content-script.js'],
      });
      const response = await this.chrome.tabs.sendMessage(tabId, { type: 'COLLECT_SIGNALS' });
      if (response && response.ok && response.signals) return response.signals;
    } catch {
      /* failure */
    }
    return null;
  }

  /**
   * Perform a deep scan for a tab.
   * @param {number} tabId
   * @param {string} url
   */
  async deepScan(tabId, url) {
    if (isRestrictedUrl(url)) {
      return {
        url,
        scannedAt: Date.now(),
        pass: 'deep',
        hits: [],
        primary: null,
        error: 'restricted',
      };
    }

    let light = null;
    const cached = this.tabCache.get(tabId);
    if (cached && cached.url === url && cached.signals) {
      light = cached.signals;
    }
    if (!light) {
      light = await this.collectFromContent(tabId);
    }
    if (!light) {
      light = { url, scripts: [], stylesheets: [], cookies: [], metas: [], domFlags: [], html: '', globals: {}, pass: 'light' };
    }

    const globals = await this.probeMainWorld(tabId);
    const merged = mergeDeepSignals(light, globals);
    merged.url = url;
    const result = detect(merged);
    this.tabCache.set(tabId, { url, result, signals: light });
    await this.applyBadge(tabId, result);
    return result;
  }

  /**
   * Perform a light scan from content script signals.
   * @param {number} tabId
   * @param {object} signals
   */
  async lightScan(tabId, signals) {
    const url = signals.url || '';
    if (isRestrictedUrl(url)) return null;
    const withPass = { ...signals, pass: 'light' };
    const result = detect(withPass);
    this.tabCache.set(tabId, { url, result, signals: withPass });
    await this.applyBadge(tabId, result);
    return result;
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
    const stale = !cached || cached.url !== url || cached.result.pass !== 'deep';
    if (forceDeep || stale) {
      const result = await this.deepScan(tabId, url);
      return result;
    }
    return cached.result;
  }

  /**
   * Invalidate tab cache on tab close or navigation.
   * @param {number} tabId
   * @param {string} [newUrl]
   */
  invalidateTab(tabId, newUrl) {
    if (!newUrl) {
      this.tabCache.delete(tabId);
      return;
    }
    const cached = this.tabCache.get(tabId);
    if (cached && cached.url !== newUrl) {
      this.tabCache.delete(tabId);
    }
  }
}
