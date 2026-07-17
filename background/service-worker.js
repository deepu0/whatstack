/**
 * WhatStack service worker — cache, badge, light/deep orchestration.
 */

import {
  detect,
  mergeDeepSignals,
  badgeCount,
  mainWorldProbeSource,
} from '../shared/detect.js';

/** @type {Map<number, { url: string, result: import('../shared/detect.js').ScanResult, signals?: object }>} */
const tabCache = new Map();

function isRestrictedUrl(url) {
  if (!url) return true;
  return /^(chrome|chrome-extension|edge|about|devtools|view-source):/i.test(url);
}

/**
 * @param {number} tabId
 * @param {import('../shared/detect.js').ScanResult} result
 */
async function applyBadge(tabId, result) {
  const count = badgeCount(result);
  const text = count > 0 ? String(Math.min(count, 99)) : '';
  const title = result.primary
    ? `WhatStack: ${result.primary.name}${count ? ` · ${count} signals` : ''}`
    : count
      ? `WhatStack: ${count} stack signals`
      : 'WhatStack: no high/medium signals';
  try {
    await chrome.action.setBadgeText({ tabId, text });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#2563eb' });
    await chrome.action.setTitle({ tabId, title });
  } catch {
    /* tab gone */
  }
}

/**
 * @param {object} signals
 */
function runDetect(signals) {
  return detect(signals);
}

/**
 * MAIN-world globals via scripting API.
 * @param {number} tabId
 */
async function probeMainWorld(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
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
 * Ask content script for fresh light signals.
 * @param {number} tabId
 */
async function collectFromContent(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'COLLECT_SIGNALS' });
    if (response && response.ok && response.signals) return response.signals;
  } catch {
    /* content script may be missing — inject */
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/content-script.js'],
    });
    const response = await chrome.tabs.sendMessage(tabId, { type: 'COLLECT_SIGNALS' });
    if (response && response.ok && response.signals) return response.signals;
  } catch {
    /* fail */
  }
  return null;
}

/**
 * Deep scan: light signals + MAIN globals.
 * @param {number} tabId
 * @param {string} url
 */
async function deepScan(tabId, url) {
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
  const cached = tabCache.get(tabId);
  if (cached && cached.url === url && cached.signals) {
    light = cached.signals;
  }
  if (!light) {
    light = await collectFromContent(tabId);
  }
  if (!light) {
    light = { url, scripts: [], stylesheets: [], cookies: [], metas: [], domFlags: [], html: '', globals: {}, pass: 'light' };
  }

  const globals = await probeMainWorld(tabId);
  const merged = mergeDeepSignals(light, globals);
  merged.url = url;
  const result = runDetect(merged);
  tabCache.set(tabId, { url, result, signals: light });
  await applyBadge(tabId, result);
  return result;
}

/**
 * Light scan from content script message.
 * @param {number} tabId
 * @param {object} signals
 */
async function lightScan(tabId, signals) {
  const url = signals.url || '';
  if (isRestrictedUrl(url)) return;
  const withPass = { ...signals, pass: 'light' };
  const result = runDetect(withPass);
  tabCache.set(tabId, { url, result, signals: withPass });
  await applyBadge(tabId, result);
  return result;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (!msg || !msg.type) {
      sendResponse({ ok: false });
      return;
    }

    if (msg.type === 'LIGHT_SCAN') {
      const tabId = sender.tab && sender.tab.id;
      if (typeof tabId === 'number') {
        await lightScan(tabId, msg.signals || {});
      }
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === 'GET_RESULT') {
      const tabId = msg.tabId;
      const url = msg.url || '';
      const cached = tabCache.get(tabId);
      const stale = !cached || cached.url !== url || cached.result.pass !== 'deep';
      if (msg.forceDeep || stale) {
        const result = await deepScan(tabId, url);
        sendResponse({ ok: true, result });
        return;
      }
      sendResponse({ ok: true, result: cached.result });
      return;
    }

    if (msg.type === 'REQUEST_DEEP_SCAN') {
      const result = await deepScan(msg.tabId, msg.url || '');
      sendResponse({ ok: true, result });
      return;
    }

    sendResponse({ ok: false, error: 'unknown_type' });
  })();
  return true; // async
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabCache.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    // Invalidate deep cache on navigation
    const cached = tabCache.get(tabId);
    if (cached && cached.url !== changeInfo.url) {
      tabCache.delete(tabId);
    }
  }
});
