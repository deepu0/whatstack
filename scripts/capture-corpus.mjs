/**
 * Golden corpus capture. Loads the REAL unpacked extension, visits each site in
 * tests/corpus/sites.json, and stores exactly what detect() consumes in
 * production — the content script's light signals and the MAIN-world probe's
 * globals — so tests/corpus.test.js can replay real pages offline.
 *
 *   npm run corpus:capture                 # all sites (network required)
 *   npm run corpus:capture -- stripe.com   # one site
 *
 * Captures are scrubbed: query strings are dropped (except Vercel's dpl=, which
 * a rule reads), and only the inline-script excerpts that a signature matches
 * are kept, so no page content beyond the evidence is stored.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { SIGNATURES } from '../shared/signatures.js';
import { detect, mergeDeepSignals } from '../shared/detect.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'tests/corpus');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const SITES = JSON.parse(fs.readFileSync(path.join(DIR, 'sites.json'), 'utf8'));
const only = process.argv.slice(2);

const INLINE_PATTERNS = [
  ...SIGNATURES.flatMap((r) => r.checks.filter((c) => c.type === 'inline').map((c) => c.pattern)),
  /\bReact\.version\s*=/,
];

function scrubUrl(u) {
  const s = String(u);
  if (s.startsWith('inline:#')) return s;
  const q = s.search(/[?#]/);
  if (q === -1) return s;
  const dpl = s.match(/[?&](dpl=dpl_[\w-]+)/);
  return s.slice(0, q) + (dpl ? `?${dpl[1]}` : '');
}

/** Keep only the evidence-bearing excerpt of each inline script. */
function scrubInline(samples) {
  const out = [];
  for (const text of samples || []) {
    for (const re of INLINE_PATTERNS) {
      const flags = re.flags.replace('g', '');
      const m = new RegExp(re.source, flags).exec(text);
      if (m) {
        out.push(text.slice(Math.max(0, m.index - 120), m.index + m[0].length + 120));
        break;
      }
    }
  }
  return out;
}

export function scrubSignals(light) {
  return {
    url: scrubUrl(light.url),
    scripts: [...new Set((light.scripts || []).map(scrubUrl))],
    stylesheets: [...new Set((light.stylesheets || []).map(scrubUrl))],
    cookies: light.cookies || [],
    metas: (light.metas || []).filter((m) => /^(?:generator|next-head-count|framework)=/i.test(m)),
    inlineSamples: scrubInline(light.inlineSamples),
    domFlags: light.domFlags || [],
    globals: {},
    pass: 'light',
  };
}

export function snapshot(result) {
  return result.hits.map((h) => `${h.id}:${h.confidence}${h.version ? '@' + h.version : ''}`).sort();
}

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wscorpus-'));
const context = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1366, height: 850 },
  args: [
    `--disable-extensions-except=${ROOT}`,
    `--load-extension=${ROOT}`,
    '--disable-features=DisableLoadExtensionCommandLineSwitch',
    '--no-sandbox',
    '--no-first-run',
  ],
});
const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker', { timeout: 20000 }));
const extId = new URL(sw.url()).host;
const ext = await context.newPage();
await ext.goto(`chrome-extension://${extId}/popup/popup.html`);
const browserVersion = context.browser()?.version() || (await ext.evaluate(() => navigator.userAgent.match(/Chrom(?:e|ium)\/([\d.]+)/)?.[1]));

let written = 0;
for (const site of SITES) {
  if (only.length && !only.includes(site.host)) continue;
  const page = await context.newPage();
  try {
    await page.goto(`https://${site.host}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(7000);
    const url = page.url();
    const cap = await ext.evaluate(async (u) => {
      const tab = (await chrome.tabs.query({})).find((t) => t.url === u);
      return chrome.runtime.sendMessage({ type: 'CAPTURE_SIGNALS', tabId: tab.id });
    }, url);
    if (!cap || !cap.ok || !cap.light) throw new Error('capture failed');
    const signals = scrubSignals(cap.light);
    const globals = cap.globals || {};
    const result = detect(mergeDeepSignals(signals, globals));
    const file = path.join(DIR, `${site.host}.json`);
    const record = {
      host: site.host,
      capturedAt: new Date().toISOString().slice(0, 10),
      whatstack: MANIFEST.version,
      chromium: browserVersion,
      expect: site.expect || {},
      snapshot: snapshot(result),
      signals,
      globals,
    };
    fs.writeFileSync(file, JSON.stringify(record, null, 1) + '\n');
    written++;
    console.log(`${site.host.padEnd(26)} ${record.snapshot.join(' ')}`);
  } catch (e) {
    console.log(`${site.host.padEnd(26)} SKIPPED (${String(e.message || e).slice(0, 80)})`);
  }
  await page.close();
}
await context.close();
fs.rmSync(userDataDir, { recursive: true, force: true });
console.log(`\n${written} capture(s) written to tests/corpus/`);
