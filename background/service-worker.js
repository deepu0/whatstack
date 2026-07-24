/**
 * WhatStack service worker — message adapter delegating to ScanOrchestrator.
 */

import { ScanOrchestrator } from '../shared/scan-orchestrator.js';

const orchestrator = new ScanOrchestrator();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (!msg || !msg.type) {
      sendResponse({ ok: false });
      return;
    }

    if (msg.type === 'LIGHT_SCAN') {
      const tabId = sender.tab && sender.tab.id;
      if (typeof tabId === 'number') {
        await orchestrator.lightScan(tabId, msg.signals || {});
      }
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === 'GET_RESULT') {
      const result = await orchestrator.getResult({
        tabId: msg.tabId,
        url: msg.url || '',
        forceDeep: msg.forceDeep,
      });
      sendResponse({ ok: true, result });
      return;
    }

    if (msg.type === 'REQUEST_DEEP_SCAN') {
      const result = await orchestrator.deepScan(msg.tabId, msg.url || '');
      sendResponse({ ok: true, result });
      return;
    }

    sendResponse({ ok: false, error: 'unknown_type' });
  })();
  return true; // async
});

chrome.tabs.onRemoved.addListener((tabId) => {
  orchestrator.invalidateTab(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    orchestrator.invalidateTab(tabId, changeInfo.url);
  }
});
