/**
 * End-to-end test: loads the REAL unpacked extension into REAL Chrome,
 * navigates to local fixture pages, and reads back what the extension
 * actually did — the badge it set, and the signals its content script
 * genuinely collected from a real DOM.
 *
 * No stubs. The content script's querySelector calls run against real
 * parsed HTML, which is the path the node test suite cannot exercise.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import { detect } from '../../shared/detect.js';
import { shapeForPopup } from '../../shared/result-shape.js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const EXT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ORIGIN = 'http://127.0.0.1:8899';

// fixture -> { expect: [ids that MUST be found], forbid: [ids that must NOT be] }
const CASES = {
  'real-next.html':    { expect: ['nextjs'], forbid: [] },
  'docs-next.html':    { expect: [], forbid: ['nextjs', 'react', 'hotjar', 'zendesk'] },
  'real-angular.html': { expect: ['angular'], forbid: [] },
  'docs-angular.html': { expect: [], forbid: ['angular'] },
  'real-styled.html':  { expect: ['styled-components'], forbid: [] },
  'docs-styled.html':  { expect: [], forbid: ['styled-components', 'emotion'] },
  'plain.html':        { expect: [], forbid: ['react', 'vue', 'angular', 'nextjs', 'jquery'] },
};

// Serve fixtures from inside this process — content_scripts only match
// http/https, so file:// URLs would not exercise the extension at all.
const fixtureDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};
const server = http.createServer((req, res) => {
  // Fixtures reference framework-shaped URLs (/_next/static/chunks/x.js) because
  // the path itself is evidence the engine reads. Only the basename is on disk.
  const name = path.basename(new URL(req.url, ORIGIN).pathname);
  if (name === 'favicon.ico') {
    res.writeHead(204).end();
    return;
  }
  const file = path.join(fixtureDir, name);
  if (!fs.existsSync(file)) {
    res.writeHead(404).end('not found');
    return;
  }
  // Serve the correct MIME per extension. A script or stylesheet sent as
  // text/html is refused by Chrome and surfaces as a page console error,
  // which this suite counts as a failure.
  res.writeHead(200, { 'content-type': MIME[path.extname(name)] || 'text/plain; charset=utf-8' });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(8899, '127.0.0.1', r));
console.log(`fixture server: ${ORIGIN}\n`);

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsprofile-'));
// Default to Playwright's bundled Chromium, NOT the installed `chrome` channel.
// Branded Chrome stable/beta disabled --load-extension around M137, so on any
// current stable Chrome the browser launches, loads no extension at all, and the
// only symptom is a service-worker timeout that reads like an extension bug.
// Chrome for Testing / Chromium builds still honour the switch.
// Set CHROME_PATH to point at your own Chromium-family binary.
const context = await chromium.launchPersistentContext(userDataDir, {
  executablePath: process.env.CHROME_PATH || undefined,
  headless: false,
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    // Chrome ~137+ ignores --load-extension unless this feature is disabled.
    // Without it the browser starts fine, loads nothing, and the only symptom
    // is a service-worker timeout that looks like a bug in the extension.
    '--disable-features=DisableLoadExtensionCommandLineSwitch',
    '--no-sandbox',
    '--no-first-run',
  ],
});

// Collect anything the extension logs — errors here are store-review blockers.
const extErrors = [];
context.on('weberror', (e) => extErrors.push('weberror: ' + e.error().message));

// Wait for the MV3 service worker to register.
let [sw] = context.serviceWorkers();
if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15000 });
const extId = new URL(sw.url()).host;
console.log(`extension loaded: id=${extId}`);
console.log(`service worker:   ${sw.url()}\n`);

sw.on('console', (m) => {
  if (m.type() === 'error') extErrors.push('sw console: ' + m.text());
});

let failures = 0;

for (const [fixture, rule] of Object.entries(CASES)) {
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    const t = m.text();
    // favicon.ico 404s are fixture noise, not extension behaviour
    if (m.type() === 'error' && !/favicon/i.test(t)) pageErrors.push('console: ' + t);
  });

  await page.goto(`${ORIGIN}/${fixture}`, { waitUntil: 'load' });
  // content script runs at document_idle and re-posts at 1.5s
  await page.waitForTimeout(2200);

  // Ask the REAL content script, in the REAL page, for the signals it collected.
  const collected = await sw.evaluate(async (origin) => {
    const tabs = await chrome.tabs.query({ url: origin + '/*' });
    const tab = tabs.find((t) => t.active) || tabs[tabs.length - 1];
    const signals = await chrome.tabs.sendMessage(tab.id, { type: 'COLLECT_SIGNALS' });
    const badge = await chrome.action.getBadgeText({ tabId: tab.id });
    const title = await chrome.action.getTitle({ tabId: tab.id });
    return { signals: signals && signals.signals, badge, title, url: tab.url };
  }, ORIGIN);

  const signals = collected.signals;
  const result = detect({ ...signals, pass: 'deep' });
  const ids = new Set(result.hits.map((h) => h.id));

  const missing = rule.expect.filter((id) => !ids.has(id));
  const leaked = rule.forbid.filter((id) => ids.has(id));
  const ok = !missing.length && !leaked.length && !pageErrors.length;
  if (!ok) failures++;

  console.log(`${ok ? 'PASS' : 'FAIL'}  ${fixture}`);
  console.log(`      domFlags from real DOM: [${(signals.domFlags || []).join(', ')}]`);
  console.log(`      detected: ${result.hits.map((h) => `${h.id}(${h.confidence})`).join(', ') || '(nothing)'}`);
  console.log(`      headline: ${shapeForPopup(result).headline || '(empty)'}`);
  console.log(`      badge:    "${collected.badge}"  title: ${collected.title}`);
  if (missing.length) console.log(`      MISSING:  ${missing.join(', ')}`);
  if (leaked.length) console.log(`      LEAKED:   ${leaked.join(', ')}`);
  if (pageErrors.length) console.log(`      PAGE ERRORS: ${pageErrors.join(' | ')}`);
  console.log();

  await page.close();
}

// ── Behaviours changed in 1.7.2 — verify each in the real browser ──────

console.log('--- targeted checks ---\n');

// 1. MAIN-world probe. The deep scan depends on
//    chrome.scripting.executeScript({ world: 'MAIN' }). This also functionally
//    validates the minimum_chrome_version floor.
{
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/plain.html`, { waitUntil: 'load' });
  await page.evaluate(() => {
    window.__probeTarget = { version: '9.9.9' };
  });
  const probe = await sw.evaluate(async (origin) => {
    const [tab] = await chrome.tabs.query({ url: origin + '/*', active: true });
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: () => (window.__probeTarget ? window.__probeTarget.version : null),
    });
    return result;
  }, ORIGIN);
  const ok = probe === '9.9.9';
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  MAIN-world probe reads page globals (got ${probe})`);
  await page.close();
}

// 2. SPA navigation. 1.7.2 removed the history.pushState patch (it lived in the
//    isolated world and never saw page-initiated navigations). The replacement
//    assumption is that chrome.tabs.onUpdated reports the new URL. Verify it.
{
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/real-next.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  await sw.evaluate(() => {
    globalThis.__spaSeen = [];
    globalThis.__spaListener = (tabId, changeInfo) => {
      if (changeInfo.url) globalThis.__spaSeen.push(changeInfo.url);
    };
    chrome.tabs.onUpdated.addListener(globalThis.__spaListener);
  });

  // A page-initiated SPA route change, exactly as a framework router would do.
  await page.evaluate(() => history.pushState({}, '', '/spa-route-a'));
  await page.waitForTimeout(900);

  const seen = await sw.evaluate(() => {
    chrome.tabs.onUpdated.removeListener(globalThis.__spaListener);
    return globalThis.__spaSeen;
  });
  const ok = seen.some((u) => u.includes('/spa-route-a'));
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  tabs.onUpdated reports SPA pushState navigation`);
  console.log(`      urls seen by service worker: ${JSON.stringify(seen)}`);
  await page.close();
}

// 3. Double-injection guard. The manifest declares the content script AND the
//    orchestrator re-injects on sendMessage failure; without a guard that
//    registers two COLLECT_SIGNALS responders.
{
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/real-angular.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  const res = await sw.evaluate(async (origin) => {
    const [tab] = await chrome.tabs.query({ url: origin + '/*', active: true });
    // force-inject twice more on top of the declared instance
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/content-script.js'] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/content-script.js'] });
    // Read the guard in the ISOLATED world (executeScript's default) — that is
    // where content scripts run. Reading it from MAIN would always see false.
    const [{ result: guard }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => !!window.__whatstackContentScriptLoaded,
    });
    const reply = await chrome.tabs.sendMessage(tab.id, { type: 'COLLECT_SIGNALS' });
    return { guard, ok: !!(reply && reply.ok) };
  }, ORIGIN);

  const ok = res.ok && res.guard === true;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  content script survives triple injection, still answers once`);
  console.log(`      init guard set: ${res.guard}`);
  await page.close();
}

// Console errors from the extension itself are store-review blockers, so they
// fail the run rather than just printing.
if (extErrors.length) failures++;
// 4. Popup wiring, in the extension's own runtime. The popup reads the ACTIVE
//    tab, which is itself when opened as a tab, so this asserts the parts that
//    don't depend on a scan: that the report control is present, that brand
//    marks survive a REAL DOMParser (node has none, so no unit test can prove
//    this), and that the shipped report URL leaks no path or query.
{
  const page = await context.newPage();
  const popupErrors = [];
  page.on('pageerror', (e) => popupErrors.push(e.message));
  await page.goto(`chrome-extension://${extId}/popup/popup.html`, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  const res = await page.evaluate(async () => {
    const icons = await import('/shared/brand-icons.js');
    const shape = await import('/shared/result-shape.js');

    // The bug this guards: an <svg> parsed without a namespace has tagName
    // 'svg' but is not an SVGElement, so it never paints — the row shows only
    // its background colour.
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const broken = [];
    for (const id of Object.keys(icons.BRAND_ICONS)) {
      const doc = new DOMParser().parseFromString(icons.getBrandIcon(id).svg, 'image/svg+xml');
      const el = doc.documentElement;
      if (el.namespaceURI !== SVG_NS || !(el instanceof SVGElement)) broken.push(id);
    }

    const shaped = shape.shapeForPopup({
      url: 'https://x.com/someone/status/123?s=46&token=secret',
      pass: 'deep',
      primary: { id: 'react', name: 'React' },
      hits: [
        {
          id: 'react',
          name: 'React',
          category: 'framework',
          confidence: 'high',
          evidence: [{ type: 'global', snippet: 'window.__reactFiber', weight: 5 }],
        },
      ],
    });
    const reportUrl = shape.buildReportUrl(shaped, { version: '1.7.2' });

    return {
      hasReportButton: !!document.getElementById('report'),
      iconCount: Object.keys(icons.BRAND_ICONS).length,
      brokenIcons: broken,
      reportUrl,
    };
  });

  const leaks = /token=secret|status\/123|s=46/.test(decodeURIComponent(res.reportUrl));
  const ok =
    res.hasReportButton &&
    res.brokenIcons.length === 0 &&
    res.reportUrl.startsWith('https://github.com/') &&
    decodeURIComponent(res.reportUrl).includes('https://x.com') &&
    !leaks &&
    !popupErrors.length;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  popup wiring: report button, icon namespace, no URL leak`);
  console.log(`      report button present: ${res.hasReportButton}`);
  console.log(`      brand marks in SVG namespace: ${res.iconCount - res.brokenIcons.length}/${res.iconCount}`);
  if (res.brokenIcons.length) console.log(`      NOT RENDERABLE: ${res.brokenIcons.join(', ')}`);
  console.log(`      report url leaks path/query: ${leaks}`);
  if (popupErrors.length) console.log(`      POPUP ERRORS: ${popupErrors.join(' | ')}`);
  await page.close();
}

console.log('\nextension-level errors:', extErrors.length ? extErrors : 'none');
await context.close();
server.close();
fs.rmSync(userDataDir, { recursive: true, force: true });

console.log(`\n${failures === 0 ? 'ALL BROWSER CASES PASS' : failures + ' CASE(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
