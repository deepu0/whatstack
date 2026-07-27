/**
 * Regenerate the Chrome Web Store listing assets from the CURRENT engine.
 *
 * The popup in every screenshot is the real popup/popup.html rendered in
 * Chromium, filled with the output of the real shared/detect.js for a realistic
 * set of page signals. Nothing about the detections is drawn by hand — if a
 * release changes what the engine reports, re-running this script changes the
 * screenshots to match.
 *
 * Usage: node scripts/make-store-assets.mjs
 * Requires: playwright (devDependency) and a Chromium build.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { detect } from '../shared/detect.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8901;
const ORIGIN = `http://127.0.0.1:${PORT}`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

// ── Page signal sets. Shaped like what content-script.js really collects. ──

const base = {
  pass: 'deep',
  scripts: [],
  stylesheets: [],
  cookies: [],
  metas: [],
  inlineSamples: [],
  domFlags: [],
  html: '',
  globals: {},
};

const SCENES = [
  {
    file: 'screenshot-1-1280x800.png',
    width: 1280,
    height: 800,
    subtitle: 'See the stack under any web app',
    signals: {
      ...base,
      url: 'https://app.example.com/dashboard',
      scripts: [
        'https://app.example.com/_next/static/chunks/main-app-4f2a1c.js',
        'https://app.example.com/_next/static/chunks/webpack-9d1b.js',
        'https://browser.sentry-cdn.com/7.99.0/bundle.min.js',
        'https://www.googletagmanager.com/gtag/js?id=G-ABCDE12345',
      ],
      stylesheets: ['https://app.example.com/_next/static/css/9a2b.css'],
      domFlags: ['script#__NEXT_DATA__', '#__next', 'next-route-announcer'],
      inlineSamples: [
        '(self.__next_f=self.__next_f||[]).push([1,"a"])',
        'self.__webpack_require__ = __webpack_require__;',
        'Sentry.init({dsn:"https://examplePublicKey@o0.ingest.sentry.io/0"})',
      ],
      globals: {
        __next_f: { present: true },
        __REACT_DEVTOOLS_GLOBAL_HOOK__: { present: true, renderers: 1 },
        __sentry__: { present: true },
      },
    },
  },
  {
    file: 'screenshot-2-1280x800.png',
    width: 1280,
    height: 800,
    subtitle: 'Remix, React Router, and more',
    signals: {
      ...base,
      url: 'https://shop.example.com/products',
      scripts: [
        'https://shop.example.com/build/root-7QJ2XZ4A.js',
        'https://shop.example.com/build/manifest-8B1C.js',
        'https://shop.example.com/build/_shared/chunk-REACT-ROUTER.js',
      ],
      domFlags: [],
      inlineSamples: [
        'window.__remixContext = {"state":{"loaderData":{}}};',
        'window.__remixManifest = {"entry":{}};',
      ],
      globals: {
        __remixContext: { present: true },
        __REACT_DEVTOOLS_GLOBAL_HOOK__: { present: true, renderers: 1 },
      },
      metas: ['server=cloudflare'],
      cookies: ['__cf_bm', '__cflb'],
    },
  },
  {
    file: 'screenshot-3-640x400.png',
    width: 640,
    height: 400,
    subtitle: 'Solid signals only — never page copy',
    signals: {
      ...base,
      url: 'https://portal.example.com/',
      scripts: [
        'https://portal.example.com/main-ABCD1234.js',
        'https://portal.example.com/polyfills-XYZ9876.js',
        'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
      ],
      stylesheets: ['https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css'],
      domFlags: ['[ng-version]', 'ng-version:17.3.0', '[_ngcontent-]', '.btn-primary'],
      globals: { ng: { present: true } },
    },
  },
];

const BULLETS = [
  'Fully local detection',
  'Confidence + evidence',
  'Copy text / MD / JSON',
  'No remote matching',
];

// ── Static server for popup assets ────────────────────────────────────

const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, ORIGIN).pathname).replace(/^\/+/, '');
  const file = path.join(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--force-color-profile=srgb', '--font-render-hinting=none'],
});

/**
 * Render the real popup against a real detect() result and return a PNG buffer.
 * @param {object} signals
 */
async function shootPopup(signals) {
  const result = detect(signals);
  const page = await browser.newPage({ viewport: { width: 360, height: 900 }, deviceScaleFactor: 2 });

  // Stand in for the extension APIs the popup uses. The RESULT is real.
  await page.addInitScript((payload) => {
    window.chrome = {
      tabs: { query: async () => [{ id: 1, url: payload.url }] },
      runtime: { sendMessage: async () => ({ ok: true, result: payload.result }) },
    };
  }, { url: signals.url, result });

  await page.goto(`${ORIGIN}/popup/popup.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.getElementById('results').hidden, null, { timeout: 5000 });
  await page.waitForTimeout(150);

  // The live popup caps at 560px and scrolls. For a still image, show the whole
  // result rather than clipping a row in half.
  const box = await page.evaluate(() => {
    const s = document.createElement('style');
    s.textContent = 'body{max-height:none!important;overflow:visible!important}.header{position:static!important}';
    document.head.appendChild(s);
    return { h: Math.ceil(document.body.getBoundingClientRect().height) };
  });
  await page.setViewportSize({ width: 360, height: box.h });
  const buf = await page.screenshot({ type: 'png' });
  await page.close();

  const names = result.hits
    .filter((h) => h.confidence !== 'low')
    .map((h) => `${h.name}(${h.confidence})`)
    .join(', ');
  return { buf, names };
}

/**
 * Compose a listing screenshot around a popup image.
 */
function frameHtml({ width, height, subtitle, popupDataUrl }) {
  const compact = width < 800;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden}
    body{
      background:
        radial-gradient(1200px 600px at 12% -10%, #1b2440 0%, rgba(27,36,64,0) 60%),
        radial-gradient(900px 500px at 100% 110%, #1a2b3f 0%, rgba(26,43,63,0) 60%),
        #0c0f14;
      color:#e8eef7;
      font-family:"Segoe UI",system-ui,-apple-system,sans-serif;
      display:flex;align-items:center;gap:${compact ? 24 : 56}px;
      padding:${compact ? '28px 32px' : '56px 64px'};
    }
    .copy{flex:1 1 auto;min-width:0}
    h1{margin:0;font-size:${compact ? 34 : 52}px;letter-spacing:-.02em;font-weight:800}
    .sub{margin:${compact ? 8 : 12}px 0 0;font-size:${compact ? 15 : 20}px;color:#8b9bb0;max-width:${compact ? 260 : 460}px}
    ul{list-style:none;margin:${compact ? 20 : 40}px 0 0;padding:0;display:grid;gap:${compact ? 10 : 16}px}
    li{display:flex;align-items:center;gap:12px;font-size:${compact ? 14 : 17}px;color:#cfdae9}
    li::before{content:"";width:8px;height:8px;border-radius:50%;background:#3b82f6;flex:0 0 auto;
      box-shadow:0 0 0 4px rgba(59,130,246,.18)}
    .shot{flex:0 0 auto;width:${compact ? 300 : 380}px;display:flex;justify-content:center}
    .shot img{
      width:${compact ? 300 : 380}px;height:auto;display:block;border-radius:14px;
      border:1px solid #243041;
      box-shadow:0 30px 70px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.03);
    }
  </style></head><body>
    <div class="copy">
      <h1>WhatStack</h1>
      <p class="sub">${subtitle}</p>
      <ul>${BULLETS.map((b) => `<li>${b}</li>`).join('')}</ul>
    </div>
    <div class="shot"><img src="${popupDataUrl}"></div>
  </body></html>`;
}

const outShots = path.join(root, 'store/screenshots');
fs.mkdirSync(outShots, { recursive: true });

for (const scene of SCENES) {
  const { buf, names } = await shootPopup(scene.signals);
  const dataUrl = `data:image/png;base64,${buf.toString('base64')}`;

  const page = await browser.newPage({
    viewport: { width: scene.width, height: scene.height },
    deviceScaleFactor: 1,
  });
  await page.setContent(frameHtml({ ...scene, popupDataUrl: dataUrl }), { waitUntil: 'load' });
  await page.waitForTimeout(200);
  const out = path.join(outShots, scene.file);
  await page.screenshot({ path: out, type: 'png', clip: { x: 0, y: 0, width: scene.width, height: scene.height } });
  await page.close();
  console.log(`${scene.file}  ${scene.width}x${scene.height}  detected: ${names}`);
}

// ── Promo tile (no detections shown; regenerated for consistency) ──────

{
  const width = 440;
  const height = 280;
  const logo = fs.readFileSync(path.join(root, 'icons/icon128.png')).toString('base64');
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box}
      html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}
      body{background:#0c0f14;font-family:"Segoe UI",system-ui,-apple-system,sans-serif;color:#e8eef7;padding:14px}
      .card{width:100%;height:100%;border-radius:14px;border:1px solid #3b3f8f;
        background:radial-gradient(600px 300px at 0% 0%, #1b2440 0%, #121826 60%, #0f1420 100%);
        padding:22px 26px;display:flex;flex-direction:column;justify-content:center;gap:14px}
      .brand{display:flex;align-items:center;gap:14px}
      .brand img{width:56px;height:56px;border-radius:14px;box-shadow:0 8px 22px rgba(99,102,241,.45)}
      .brand h1{margin:0;font-size:30px;font-weight:800;letter-spacing:-.02em}
      .brand p{margin:2px 0 0;font-size:13px;color:#8b9bb0}
      .row1{font-size:17px;font-weight:700}
      .row2{font-size:14px;color:#8b9bb0;margin-top:-6px}
      .pill{align-self:flex-start;background:#2563eb;color:#fff;font-size:14px;font-weight:700;
        padding:9px 18px;border-radius:999px}
    </style></head><body>
      <div class="card">
        <div class="brand">
          <img src="data:image/png;base64,${logo}">
          <div><h1>WhatStack</h1><p>Local stack detection</p></div>
        </div>
        <div class="row1">React · Next · Remix · Vue</div>
        <div class="row2">Angular · TanStack · Sentry · more</div>
        <div class="pill">Fully on-device</div>
      </div>
    </body></html>`,
    { waitUntil: 'load' },
  );
  await page.waitForTimeout(150);
  const out = path.join(root, 'store/promo/promo-tile-440x280.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, type: 'png', clip: { x: 0, y: 0, width, height } });
  await page.close();
  console.log(`promo-tile-440x280.png  ${width}x${height}`);
}

await browser.close();
server.close();
console.log('\nStore assets regenerated from the current engine.');
