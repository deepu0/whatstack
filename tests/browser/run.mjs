/**
 * End-to-end test: loads the REAL unpacked extension into REAL Chromium,
 * navigates to local fixture pages, and reads back what the extension
 * actually did — the badge it set, and the result of a real deep scan
 * (content script + MAIN-world probe + engine, through the service worker).
 *
 * No stubs. The content script's querySelector calls run against real
 * parsed HTML, and the probe runs against the page's real JS heap.
 *
 *   npm run test:browser              # headed (needs a display)
 *   HEADLESS=1 npm run test:browser   # new headless Chromium (CI)
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
import { shapeForPopup } from '../../shared/result-shape.js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const EXT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
const HEADLESS = process.env.HEADLESS === '1' || process.env.CI === 'true';

// fixture -> { expect: [ids that MUST be found], forbid: [ids that must NOT be], forbidSolid: [ids that may only be low] }
const CASES = {
  'real-next.html': { expect: ['nextjs', 'react'], forbid: [] },
  'docs-next.html': { expect: [], forbid: ['nextjs', 'react', 'hotjar', 'zendesk'] },
  'real-angular.html': { expect: ['angular'], forbid: [] },
  'docs-angular.html': { expect: [], forbid: ['angular'] },
  'real-styled.html': { expect: ['styled-components'], forbid: [] },
  'docs-styled.html': { expect: [], forbid: ['styled-components', 'emotion'] },
  'plain.html': { expect: [], forbid: ['react', 'vue', 'angular', 'nextjs', 'jquery'] },
  // 1.8.0 — adversarial pages from the Sep 2026 audit
  'clobber.html': {
    expect: [],
    forbid: ['nextjs', 'react', 'bootstrap', 'axios', 'angular', 'stripe', 'sentry', 'logrocket', 'module-federation'],
  },
  'prose-island.html': {
    expect: [],
    forbid: ['single-spa', 'module-federation', 'qiankun', 'microfrontend', 'logrocket', 'zendesk', 'parcel', 'turbopack'],
  },
  'bootstrap-classes.html': { expect: [], forbid: [], forbidSolid: ['tailwind'] },
  'real-tailwind.html': { expect: ['tailwind'], forbid: ['bootstrap'], solid: ['tailwind'] },
  // Runtime-only proof: the badge must count it too (background deep pass)
  'runtime-react.html': { expect: ['react'], forbid: [], solid: ['react'] },
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
  const name = path.basename(new URL(req.url, 'http://x').pathname);
  if (name === 'favicon.ico') {
    res.writeHead(204).end();
    return;
  }
  const file = path.join(fixtureDir, name);
  if (!fs.existsSync(file)) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(name)] || 'text/plain; charset=utf-8' });
  res.end(fs.readFileSync(file));
});
// Port 0: parallel runs never collide.
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;
console.log(`fixture server: ${ORIGIN}   headless: ${HEADLESS}\n`);

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsprofile-'));
// Default to Playwright's bundled Chromium, NOT the installed `chrome` channel.
// Branded Chrome stable/beta disabled --load-extension around M137.
// Headless extension support needs the new headless mode (channel 'chromium').
const context = await chromium.launchPersistentContext(userDataDir, {
  executablePath: process.env.CHROME_PATH || undefined,
  channel: !process.env.CHROME_PATH && HEADLESS ? 'chromium' : undefined,
  headless: HEADLESS,
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    // Chrome ~137+ ignores --load-extension unless this feature is disabled.
    '--disable-features=DisableLoadExtensionCommandLineSwitch',
    '--no-sandbox',
    '--no-first-run',
  ],
});

// Collect anything the extension logs — errors here are store-review blockers.
const extErrors = [];
context.on('weberror', (e) => extErrors.push('weberror: ' + e.error().message));

let [sw] = context.serviceWorkers();
if (!sw) sw = await context.waitForEvent('serviceworker', { timeout: 15000 });
const extId = new URL(sw.url()).host;
console.log(`extension loaded: id=${extId}  version=${MANIFEST.version}\n`);
sw.on('console', (m) => {
  if (m.type() === 'error') extErrors.push('sw console: ' + m.text());
});

// An extension page to talk to the service worker exactly like the popup does.
const ext = await context.newPage();
await ext.goto(`chrome-extension://${extId}/popup/popup.html`, { waitUntil: 'load' });

/** Poll instead of sleeping a fixed time. */
async function until(fn, { timeout = 6000, every = 100 } = {}) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await new Promise((r) => setTimeout(r, every));
  }
  return last;
}

async function tabFor(page) {
  const url = page.url();
  return until(() =>
    sw.evaluate(async (u) => {
      const t = (await chrome.tabs.query({})).find((x) => x.url === u);
      return t ? { id: t.id, url: t.url } : null;
    }, url),
  );
}
const badgeOf = (tabId) => sw.evaluate((id) => chrome.action.getBadgeText({ tabId: id }), tabId);
const titleOf = (tabId) => sw.evaluate((id) => chrome.action.getTitle({ tabId: id }), tabId);

async function deepScan(tab) {
  return ext.evaluate(
    (t) => chrome.runtime.sendMessage({ type: 'GET_RESULT', tabId: t.id, url: t.url, forceDeep: true }),
    tab,
  );
}

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`      ✗ ${msg}`);
};

for (const [fixture, rule] of Object.entries(CASES)) {
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon/i.test(t)) pageErrors.push('console: ' + t);
  });

  await page.goto(`${ORIGIN}/${fixture}`, { waitUntil: 'load' });
  const tab = await tabFor(page);

  // What the user sees BEFORE opening the popup: the light pass, then the
  // background deep pass (content script posts at idle and again at +1.5s).
  // Wait for the badge to settle, then compare it to the popup's own count.
  const loadedAt = Date.now();
  let prev = null;
  const preBadge = await until(async () => {
    const b = await badgeOf(tab.id);
    const settled = Date.now() - loadedAt > 2300 && b === prev;
    prev = b;
    return settled ? { b } : null;
  }, { timeout: 6000, every: 400 });
  const response = await deepScan(tab);
  const result = response && response.result;
  const shaped = shapeForPopup(result);
  const ids = new Set((result?.hits || []).map((h) => h.id));
  const conf = Object.fromEntries((result?.hits || []).map((h) => [h.id, h.confidence]));
  const expectedBadge = shaped.highMediumCount ? String(Math.min(shaped.highMediumCount, 99)) : '';
  const badge = await until(async () => {
    const b = await badgeOf(tab.id);
    return b === expectedBadge ? { b } : null;
  }, { timeout: 4000 });
  const title = await titleOf(tab.id);

  const before = failures;
  console.log(`${fixture}`);
  console.log(`      detected: ${result?.hits.map((h) => `${h.id}(${h.confidence})`).join(', ') || '(nothing)'}`);
  console.log(`      headline: ${shaped.headline || '(empty)'}   badge: "${badge ? badge.b : await badgeOf(tab.id)}"  title: ${title}`);
  if (!response || !response.ok) fail(`deep scan failed: ${JSON.stringify(response)}`);
  for (const id of rule.expect) if (!ids.has(id)) fail(`MISSING ${id}`);
  for (const id of rule.forbid) if (ids.has(id)) fail(`LEAKED ${id} (${conf[id]})`);
  for (const id of rule.forbidSolid || []) if (conf[id] && conf[id] !== 'low') fail(`${id} should be low at most, got ${conf[id]}`);
  for (const id of rule.solid || []) if (conf[id] === 'low') fail(`${id} should be high/medium, got low`);
  if (!badge) fail(`badge "${await badgeOf(tab.id)}" != popup count "${expectedBadge}"`);
  if (!preBadge || preBadge.b !== expectedBadge) {
    fail(`badge before opening the popup "${preBadge && preBadge.b}" != popup count "${expectedBadge}"`);
  }
  if (/\b1 technologies\b|stack signals/.test(title)) fail(`tooltip wording: ${title}`);
  if (pageErrors.length) fail(`PAGE ERRORS: ${pageErrors.join(' | ')}`);
  console.log(`${failures === before ? 'PASS' : 'FAIL'}  ${fixture}\n`);
  await page.close();
}

console.log('--- targeted checks ---\n');

// 1. MAIN-world probe reads page globals (validates minimum_chrome_version floor too).
{
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/plain.html`, { waitUntil: 'load' });
  await page.evaluate(() => {
    window.__probeTarget = { version: '9.9.9' };
  });
  const tab = await tabFor(page);
  const probe = await sw.evaluate(async (id) => {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: id },
      world: 'MAIN',
      func: () => (window.__probeTarget ? window.__probeTarget.version : null),
    });
    return result;
  }, tab.id);
  const ok = probe === '9.9.9';
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  MAIN-world probe reads page globals (got ${probe})`);
  await page.close();
}

// 2. SPA navigation: onUpdated reports it AND the badge is rebuilt for the new route.
{
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/real-next.html`, { waitUntil: 'load' });
  const tab = await tabFor(page);
  await until(async () => (await badgeOf(tab.id)) !== '');
  await sw.evaluate(() => {
    globalThis.__spaSeen = [];
    globalThis.__spaListener = (tabId, changeInfo) => {
      if (changeInfo.url) globalThis.__spaSeen.push(changeInfo.url);
    };
    chrome.tabs.onUpdated.addListener(globalThis.__spaListener);
  });
  await page.evaluate(() => history.pushState({}, '', '/spa-route-a'));
  const seen = await until(() =>
    sw.evaluate(() => (globalThis.__spaSeen.some((u) => u.includes('/spa-route-a')) ? globalThis.__spaSeen : null)),
  );
  await sw.evaluate(() => chrome.tabs.onUpdated.removeListener(globalThis.__spaListener));
  const rebuilt = await until(async () => ((await badgeOf(tab.id)) !== '' ? true : null), { timeout: 5000 });
  const ok = !!seen && !!rebuilt;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  SPA pushState: onUpdated fires and the badge is rebuilt for the new route`);
  console.log(`      urls seen by service worker: ${JSON.stringify(seen)}  badge rebuilt: ${!!rebuilt}`);
  await page.close();
}

// 3. Injection guard: extra injections never register a second responder.
{
  const page = await context.newPage();
  await page.goto(`${ORIGIN}/real-angular.html`, { waitUntil: 'load' });
  const tab = await tabFor(page);
  const res = await sw.evaluate(async (id) => {
    await chrome.scripting.executeScript({ target: { tabId: id }, files: ['content/content-script.js'] });
    await chrome.scripting.executeScript({ target: { tabId: id }, files: ['content/content-script.js'] });
    // Read the guard in the ISOLATED world (executeScript's default) — where content scripts run.
    const [{ result: guard }] = await chrome.scripting.executeScript({
      target: { tabId: id },
      func: () => !!(window.__whatstackContentScript && window.__whatstackContentScript.alive()),
    });
    const reply = await chrome.tabs.sendMessage(id, { type: 'COLLECT_SIGNALS' });
    return { guard, ok: !!(reply && reply.ok) };
  }, tab.id);
  const ok = res.ok && res.guard === true;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  content script survives triple injection, still answers once (guard: ${res.guard})`);
  await page.close();
}

// 4. Restricted page: an honest error, not an empty "nothing found".
{
  const res = await ext.evaluate(() =>
    chrome.runtime.sendMessage({ type: 'GET_RESULT', tabId: -1, url: 'https://chromewebstore.google.com/detail/x', forceDeep: true }),
  );
  const ok = res && res.ok && res.result && res.result.error === 'restricted';
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  Web Store page reports "restricted" (${JSON.stringify(res && res.result && res.result.error)})`);
}

// 5. Popup wiring in the extension's own runtime: report control, brand marks
//    through a REAL DOMParser, and a report URL that leaks no path or query.
{
  const page = await context.newPage();
  const popupErrors = [];
  page.on('pageerror', (e) => popupErrors.push(e.message));
  await page.goto(`chrome-extension://${extId}/popup/popup.html`, { waitUntil: 'load' });

  const res = await page.evaluate(async (version) => {
    const icons = await import('/shared/brand-icons.js');
    const shape = await import('/shared/result-shape.js');
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
          evidence: [{ type: 'script', snippet: 'https://x.com/app.js?session=abc', weight: 5 }],
        },
      ],
    });
    const reportUrl = shape.buildReportUrl(shaped, { version });
    return {
      hasReportButton: !!document.getElementById('report'),
      iconCount: Object.keys(icons.BRAND_ICONS).length,
      brokenIcons: broken,
      reportUrl,
    };
  }, MANIFEST.version);

  const decoded = decodeURIComponent(res.reportUrl);
  const leaks = /token=secret|status\/123|s=46|session=abc/.test(decoded);
  const ok =
    res.hasReportButton &&
    res.brokenIcons.length === 0 &&
    res.reportUrl.startsWith('https://github.com/') &&
    decoded.includes('https://x.com') &&
    !leaks &&
    !popupErrors.length;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  popup wiring: report button, ${res.iconCount - res.brokenIcons.length}/${res.iconCount} brand marks render, no URL leak (${leaks ? 'LEAK' : 'clean'})`);
  if (res.brokenIcons.length) console.log(`      NOT RENDERABLE: ${res.brokenIcons.join(', ')}`);
  if (popupErrors.length) console.log(`      POPUP ERRORS: ${popupErrors.join(' | ')}`);
  await page.close();
}

// Console errors from the extension itself are store-review blockers — checked
// last so errors raised during any check above fail the run.
console.log('\nextension-level errors:', extErrors.length ? extErrors : 'none');
if (extErrors.length) failures++;

await context.close();
server.close();
fs.rmSync(userDataDir, { recursive: true, force: true });

console.log(`\n${failures === 0 ? 'ALL BROWSER CASES PASS' : failures + ' CASE(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
