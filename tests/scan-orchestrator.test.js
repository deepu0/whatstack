import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ScanOrchestrator, isRestrictedUrl, technologiesLabel } from '../shared/scan-orchestrator.js';
import { sameDocument } from '../shared/url-policy.js';

const NEXT_SIGNALS = (url = 'https://example.com/') => ({
  url,
  pass: 'light',
  scripts: ['https://example.com/_next/static/chunks/main.js'],
  stylesheets: [],
  cookies: [],
  metas: [],
  inlineSamples: [],
  domFlags: [],
  globals: {},
});

/**
 * Fake chrome.* with call recording. `probe` is what the MAIN-world probe returns
 * (or a function / 'throw' / 'hang'); `collect` likewise for COLLECT_SIGNALS.
 */
function fakeChrome({ probe = {}, collect = NEXT_SIGNALS(), tabUrl = 'https://example.com/', injectOk = true } = {}) {
  const calls = { badge: [], title: [], executeFiles: 0, probes: 0, collects: 0 };
  const settle = (spec, fallback) => {
    if (spec === 'throw') return Promise.reject(new Error('Cannot access contents of the page'));
    if (spec === 'hang') return new Promise(() => {});
    return Promise.resolve(typeof spec === 'function' ? spec() : spec ?? fallback);
  };
  const api = {
    calls,
    action: {
      setBadgeText: async ({ tabId, text }) => calls.badge.push([tabId, text]),
      setBadgeBackgroundColor: async () => {},
      setTitle: async ({ title }) => calls.title.push(title),
    },
    tabs: {
      get: async (id) => ({ id, url: tabUrl }),
      sendMessage: (tabId, msg) => {
        calls.collects++;
        if (msg.type !== 'COLLECT_SIGNALS') return Promise.resolve(null);
        return settle(collect, null).then((s) => (s && s.url ? { ok: true, signals: s } : s));
      },
    },
    scripting: {
      executeScript: (opts) => {
        if (opts.files) {
          calls.executeFiles++;
          return injectOk ? Promise.resolve([{}]) : Promise.reject(new Error('blocked'));
        }
        calls.probes++;
        return settle(probe, {}).then((r) => [{ result: r }]);
      },
    },
  };
  return api;
}
const fast = { backgroundDelayMs: 5, spaDelayMs: 5, probeTimeoutMs: 60, collectTimeoutMs: 60 };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

describe('URL policy', () => {
  it('identifies restricted browser URLs', () => {
    for (const u of [
      'chrome://extensions',
      'chrome-extension://xyz/popup.html',
      'about:blank',
      'view-source:https://example.com',
      'file:///Users/me/a.html',
      'data:text/html,hi',
      'blob:https://example.com/abc',
      'https://chromewebstore.google.com/detail/whatstack/abc',
      'https://chrome.google.com/webstore/detail/abc',
      '',
    ]) {
      assert.equal(isRestrictedUrl(u), true, u);
    }
    assert.equal(isRestrictedUrl('https://example.com'), false);
    assert.equal(isRestrictedUrl('http://localhost:3000'), false);
    assert.equal(isRestrictedUrl('https://google.com/webstore'), false);
  });

  it('sameDocument ignores the fragment only', () => {
    assert.equal(sameDocument('https://a.test/x#1', 'https://a.test/x#2'), true);
    assert.equal(sameDocument('https://a.test/x', 'https://a.test/y'), false);
  });

  it('tooltip wording is pluralised', () => {
    assert.equal(technologiesLabel(1), '1 technology');
    assert.equal(technologiesLabel(5), '5 technologies');
  });
});

describe('ScanOrchestrator', () => {
  it('manages tab cache lifecycle and invalidation', async () => {
    const o = new ScanOrchestrator(fakeChrome(), fast);
    const r = await o.deepScan(1, 'https://example.com/');
    assert.equal(r.pass, 'deep');
    assert.equal(o.tabCache.size, 1);
    const cached = await o.getResult({ tabId: 1, url: 'https://example.com/' });
    assert.equal(cached, r, 'fresh deep result is reused without forceDeep');
    o.invalidateTab(1, 'https://example.com/#section');
    assert.equal(o.tabCache.has(1), true, 'hash change is the same document');
    o.invalidateTab(1, 'https://example.com/new-path');
    assert.equal(o.tabCache.has(1), false);
    await o.deepScan(1, 'https://example.com/');
    o.invalidateTab(1);
    assert.equal(o.tabCache.has(1), false, 'tab close drops the entry');
  });

  it('restricted URLs short-circuit', async () => {
    const r = await new ScanOrchestrator(null).deepScan(2, 'chrome://settings');
    assert.equal(r.error, 'restricted');
  });

  it('evicts oldest past the cap and re-inserts on update (LRU)', async () => {
    const o = new ScanOrchestrator(fakeChrome(), fast);
    o.maxCachedTabs = 3;
    for (const id of [1, 2, 3]) await o.deepScan(id, 'https://example.com/');
    await o.deepScan(1, 'https://example.com/'); // 1 is now most recent
    await o.deepScan(4, 'https://example.com/');
    assert.deepEqual([...o.tabCache.keys()], [3, 1, 4]);
  });

  it('badge: count, 99 cap, pluralised title, empty when nothing solid', async () => {
    const chromeApi = fakeChrome();
    const o = new ScanOrchestrator(chromeApi, fast);
    const hits = Array.from({ length: 120 }, (_, i) => ({ id: 'x' + i, name: 'X', category: 'ui', confidence: 'high', evidence: [] }));
    await o.applyBadge(7, { pass: 'deep', hits, primary: null });
    assert.deepEqual(chromeApi.calls.badge.at(-1), [7, '99']);
    assert.equal(chromeApi.calls.title.at(-1), 'WhatStack: 120 technologies');
    await o.applyBadge(7, { pass: 'deep', hits: hits.slice(0, 1), primary: { id: 'x0', name: 'X' } });
    assert.equal(chromeApi.calls.title.at(-1), 'WhatStack: X · 1 technology');
    await o.applyBadge(7, { pass: 'deep', hits: [], primary: null });
    assert.deepEqual(chromeApi.calls.badge.at(-1), [7, '']);
  });

  it('deep scan always re-collects (Rescan sees late scripts)', async () => {
    let n = 0;
    const chromeApi = fakeChrome({
      collect: () => {
        n++;
        const s = NEXT_SIGNALS();
        if (n > 1) s.scripts.push('https://js.stripe.com/v3/');
        return s;
      },
    });
    const o = new ScanOrchestrator(chromeApi, fast);
    const first = await o.getResult({ tabId: 1, url: 'https://example.com/', forceDeep: true });
    assert.equal(first.hits.find((h) => h.id === 'stripe'), undefined);
    const second = await o.getResult({ tabId: 1, url: 'https://example.com/', forceDeep: true });
    assert.ok(second.hits.find((h) => h.id === 'stripe'), 'Rescan picked up the late Stripe script');
  });

  it('re-injects the content script when nothing answers, then retries', async () => {
    let answered = false;
    const chromeApi = fakeChrome({ collect: () => (answered ? NEXT_SIGNALS() : Promise.reject(new Error('no receiver'))) });
    const orig = chromeApi.scripting.executeScript;
    chromeApi.scripting.executeScript = (opts) => {
      if (opts.files) answered = true;
      return orig(opts);
    };
    const o = new ScanOrchestrator(chromeApi, fast);
    const r = await o.deepScan(1, 'https://example.com/');
    assert.equal(chromeApi.calls.executeFiles, 1);
    assert.ok(r.hits.find((h) => h.id === 'nextjs'));
  });

  it('reports "unreachable" when neither the content script nor the probe can run', async () => {
    const o = new ScanOrchestrator(fakeChrome({ collect: 'throw', probe: 'throw', injectOk: false }), fast);
    const r = await o.deepScan(1, 'https://example.com/');
    assert.equal(r.error, 'unreachable');
    assert.equal(o.tabCache.has(1), false);
  });

  it('a hung page times out instead of hanging the popup', async () => {
    const o = new ScanOrchestrator(fakeChrome({ collect: 'hang', probe: 'hang' }), fast);
    const started = Date.now();
    const r = await o.deepScan(1, 'https://example.com/');
    assert.ok(Date.now() - started < 1000);
    assert.equal(r.error, 'unreachable');
  });

  it('a probe failure keeps the light evidence', async () => {
    const o = new ScanOrchestrator(fakeChrome({ probe: 'throw' }), fast);
    const r = await o.deepScan(1, 'https://example.com/');
    assert.ok(r.hits.find((h) => h.id === 'nextjs'));
    assert.equal(r.error, undefined);
  });

  it('labels the result with the document that answered (navigation mid-scan)', async () => {
    const o = new ScanOrchestrator(fakeChrome({ collect: NEXT_SIGNALS('https://example.com/new') }), fast);
    const r = await o.deepScan(1, 'https://example.com/old');
    assert.equal(r.url, 'https://example.com/new');
    assert.equal(o.tabCache.get(1).url, 'https://example.com/new');
  });

  it('light scan schedules a background deep pass so the badge counts runtime proof', async () => {
    const chromeApi = fakeChrome({ probe: { __reactRenderer: { present: true, version: '18.3.1' }, Stripe: { present: true } } });
    const o = new ScanOrchestrator(chromeApi, fast);
    const light = await o.lightScan(1, NEXT_SIGNALS());
    assert.equal(light.pass, 'light');
    await wait(40);
    const entry = o.tabCache.get(1);
    assert.equal(entry.result.pass, 'deep');
    assert.ok(entry.result.hits.find((h) => h.id === 'stripe'));
    assert.equal(chromeApi.calls.probes, 1);
  });

  it('coalesces the load-time and +1.5s light posts into one probe', async () => {
    const chromeApi = fakeChrome();
    const o = new ScanOrchestrator(chromeApi, { ...fast, backgroundDelayMs: 20 });
    await o.lightScan(1, NEXT_SIGNALS());
    await o.lightScan(1, NEXT_SIGNALS());
    await wait(60);
    assert.equal(chromeApi.calls.probes, 1);
  });

  it('a later light post never knocks a deep result back down (monotonic)', async () => {
    const chromeApi = fakeChrome({ probe: { Stripe: { present: true } } });
    const o = new ScanOrchestrator(chromeApi, { ...fast, backgroundDelayMs: 10_000 });
    await o.deepScan(1, 'https://example.com/');
    const before = o.tabCache.get(1).result.hits.length;
    const after = await o.lightScan(1, NEXT_SIGNALS());
    assert.equal(after.pass, 'deep');
    assert.equal(after.hits.length, before);
    assert.ok(after.hits.find((h) => h.id === 'stripe'), 'runtime-only hit kept');
    o.cancelScheduled(1);
  });

  it('skips the background pass if the tab navigated away', async () => {
    const chromeApi = fakeChrome({ tabUrl: 'https://elsewhere.test/' });
    const o = new ScanOrchestrator(chromeApi, fast);
    await o.lightScan(1, NEXT_SIGNALS());
    await wait(40);
    assert.equal(chromeApi.calls.probes, 0);
  });

  it('restricted light posts are ignored', async () => {
    const o = new ScanOrchestrator(fakeChrome(), fast);
    assert.equal(await o.lightScan(1, { url: 'chrome://newtab' }), null);
  });

  it('SPA route change: onTabComplete clears the badge and rescans once', async () => {
    const chromeApi = fakeChrome({ collect: NEXT_SIGNALS('https://example.com/route-b'), tabUrl: 'https://example.com/route-b' });
    const o = new ScanOrchestrator(chromeApi, fast);
    await o.deepScan(1, 'https://example.com/route-a');
    o.invalidateTab(1); // what onUpdated(status:'loading') does
    o.onTabComplete(1, 'https://example.com/route-b');
    o.onTabComplete(1, 'https://example.com/route-b'); // duplicate event
    assert.deepEqual(chromeApi.calls.badge.at(-1), [1, '']);
    await wait(40);
    assert.equal(o.tabCache.get(1).url, 'https://example.com/route-b');
    assert.equal(chromeApi.calls.probes, 2, 'one scan for route-a, one for route-b');
  });

  it('onTabComplete does nothing when the cache already describes the page', async () => {
    const chromeApi = fakeChrome();
    const o = new ScanOrchestrator(chromeApi, fast);
    await o.deepScan(1, 'https://example.com/');
    o.onTabComplete(1, 'https://example.com/');
    await wait(30);
    assert.equal(chromeApi.calls.probes, 1);
  });

  it('capture() returns raw light signals and probe globals for tooling', async () => {
    const o = new ScanOrchestrator(fakeChrome({ probe: { __NEXT_DATA__: { present: true } } }), fast);
    const { light, globals } = await o.capture(1);
    assert.equal(light.url, 'https://example.com/');
    assert.ok(globals.__NEXT_DATA__);
  });
});
