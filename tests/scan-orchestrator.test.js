import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ScanOrchestrator, isRestrictedUrl } from '../shared/scan-orchestrator.js';

describe('ScanOrchestrator & Restricted URL evaluation', () => {
  it('identifies restricted browser URLs', () => {
    assert.equal(isRestrictedUrl('chrome://extensions'), true);
    assert.equal(isRestrictedUrl('chrome-extension://xyz/popup.html'), true);
    assert.equal(isRestrictedUrl('about:blank'), true);
    assert.equal(isRestrictedUrl('https://example.com'), false);
    assert.equal(isRestrictedUrl('http://localhost:3000'), false);
  });

  it('manages tab cache lifecycle and invalidation correctly', async () => {
    const mockChrome = {
      action: {
        setBadgeText: async () => {},
        setBadgeBackgroundColor: async () => {},
        setTitle: async () => {},
      },
      tabs: {
        sendMessage: async () => ({ ok: true, signals: { url: 'https://example.com', pass: 'light', scripts: [], domFlags: [] } }),
      },
      scripting: {
        executeScript: async () => [{ result: {} }],
      },
    };

    const orchestrator = new ScanOrchestrator(mockChrome);
    assert.equal(orchestrator.tabCache.size, 0);

    const result1 = await orchestrator.deepScan(1, 'https://example.com');
    assert.equal(result1.pass, 'deep');
    assert.equal(orchestrator.tabCache.size, 1);

    // Retrieve cached result
    const cached = await orchestrator.getResult({ tabId: 1, url: 'https://example.com' });
    assert.equal(cached.pass, 'deep');

    // Invalidate tab on navigation
    orchestrator.invalidateTab(1, 'https://example.com/new-path');
    assert.equal(orchestrator.tabCache.has(1), false);
  });

  it('handles restricted URL scan requests gracefully', async () => {
    const orchestrator = new ScanOrchestrator(null);
    const result = await orchestrator.deepScan(2, 'chrome://settings');
    assert.equal(result.error, 'restricted');
    assert.equal(result.pass, 'deep');
  });
});
