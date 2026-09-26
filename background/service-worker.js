/**
 * WhatStack service worker — message adapter delegating to ScanOrchestrator.
 */

import { ScanOrchestrator } from '../shared/scan-orchestrator.js';
import { isRestrictedUrl } from '../shared/url-policy.js';

const orchestrator = new ScanOrchestrator();

/**
 * @param {any} msg
 * @param {chrome.runtime.MessageSender} sender
 */
async function handle(msg, sender) {
  if (!msg || !msg.type) return { ok: false };

  if (msg.type === 'LIGHT_SCAN') {
    const tabId = sender.tab && sender.tab.id;
    // Top frame of the visible document only: a prerendering or bfcached
    // document must not overwrite the badge of the page on screen.
    if (typeof tabId !== 'number') return { ok: false };
    if (typeof sender.frameId === 'number' && sender.frameId !== 0) return { ok: false };
    if (sender.documentLifecycle && sender.documentLifecycle !== 'active') return { ok: false };
    await orchestrator.lightScan(tabId, msg.signals || {});
    return { ok: true };
  }

  if (msg.type === 'GET_RESULT') {
    const result = await orchestrator.getResult({ tabId: msg.tabId, url: msg.url || '', forceDeep: !!msg.forceDeep });
    return { ok: true, result };
  }

  if (msg.type === 'REQUEST_DEEP_SCAN') {
    const result = await orchestrator.deepScan(msg.tabId, msg.url || '');
    return { ok: true, result };
  }

  // Tooling only (corpus capture, browser suite): raw signals + probe output.
  // Extension pages only — never a content script.
  if (msg.type === 'CAPTURE_SIGNALS') {
    // Content scripts report the page's URL as sender.url; extension pages
    // report a chrome-extension://<our id>/ URL.
    const own = chrome.runtime.getURL('');
    if (sender.id !== chrome.runtime.id || !String(sender.url || '').startsWith(own)) {
      return { ok: false, error: 'forbidden' };
    }
    return { ok: true, ...(await orchestrator.capture(msg.tabId)) };
  }

  return { ok: false, error: 'unknown_type' };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handle(msg, sender).then(sendResponse, (err) => {
    // Always answer: an unanswered message leaves the popup on "Scanning…"
    // or shows Chrome's raw "message port closed" error.
    console.warn('[WhatStack]', err);
    sendResponse({ ok: false, error: String((err && err.message) || err) });
  });
  return true; // async
});

chrome.tabs.onRemoved.addListener((tabId) => {
  orchestrator.invalidateTab(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    // A new document (including a reload of the same URL) or an SPA route
    // change. Drop what we knew; the next LIGHT_SCAN or onTabComplete rebuilds it.
    orchestrator.invalidateTab(tabId);
  }
  if (changeInfo.status === 'complete' && tab && tab.url) {
    orchestrator.onTabComplete(tabId, tab.url);
  }
});

// Tabs that were open before install/update have no (live) content script.
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      if (typeof tab.id !== 'number' || isRestrictedUrl(tab.url || '') || tab.discarded) continue;
      chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/content-script.js'] }).catch(() => {});
    }
  } catch {
    /* best effort */
  }
});
