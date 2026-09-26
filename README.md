# WhatStack

Chrome extension (Manifest V3) that answers: **what stack is this page using?**

Fully **local** detection of 82 technologies — frameworks, CMS / site builders, architecture (microfrontends), build tools, state/data, UI, auth, payments, observability, analytics, and hosting hints. No cloud matching, no page upload.

## Load unpacked (development)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → this repository root
4. After pulls/commits: click **Reload** on the extension card, then hard-refresh the tab

## Features

- Hybrid scan: light pass on navigate, then a background MAIN-world probe, so the
  **badge counts what the popup shows**; the popup always runs a fresh deep scan
- Confidence tiers + expandable evidence (why it matched)
- Evidence from asset URLs (host + path, never the query), runtime objects with the
  right shape, and probed DOM flags — never page text, data islands or file names
- Core stack headline + Copy / Markdown / JSON export
- React detection aligned with React DevTools (renderer registered, not bare hook)
- Microfrontend platforms: Module Federation, single-spa, qiankun, SystemJS
- Observability includes Sentry, Datadog, **New Relic**, LogRocket, and more

## Develop / test

```bash
npm ci
npm test                 # unit, coverage gate, golden corpus (node:test, offline)
npm run check            # lint + type check + tests + audits
npm run test:coverage    # fails under 80% lines
npx playwright install chromium
npm run test:browser     # real unpacked extension in real Chromium
HEADLESS=1 npm run test:browser   # same, headless (CI)
npm run corpus:capture   # re-capture real sites into tests/corpus (network)
```

`npm run test:browser` uses Playwright's bundled Chromium — branded Chrome
stable ignores `--load-extension`. Set `CHROME_PATH` to use another
Chromium-family build. It serves `tests/browser/fixtures/` over localhost and
checks that pages which merely *display* or *mention* a framework produce no
detections, that real ones do, and that the badge matches the popup.

**Golden corpus.** `tests/corpus/*.json` are real sites captured by
`scripts/capture-corpus.mjs` (light signals + probe globals, query strings and
non-evidence text removed). `npm test` replays them offline. When a change
alters a snapshot on purpose, review it and run `npm run corpus:update`.

Detection evidence comes from real `querySelector` probes only — never from the
page's HTML as text. `tests/dom-evidence.test.js` is the guard for that.

## Layout

```
manifest.json
background/service-worker.js   # message adapter, tab lifecycle
content/content-script.js      # light signals (isolated world)
popup/                         # toolbar UI
shared/detect.js               # pure engine + MAIN-world probe source
shared/signatures.js           # local rule pack (82 technologies)
shared/signature-matcher.js    # evidence → confidence
shared/architecture-classifier.js  # badge count
shared/scan-orchestrator.js    # light/deep passes, cache, badge, timeouts
shared/url-policy.js           # which pages can be scanned
shared/result-shape.js         # popup shaping + exports + report link
shared/brand-icons.js          # tech marks (local SVG)
tests/                         # node:test suites + fixtures
tests/corpus/                  # golden corpus of real captured sites
tests/browser/                 # real-Chromium end-to-end suite
scripts/                       # audits, packaging, store assets
icons/                         # toolbar + brand assets
store/                         # listing copy, screenshots, promo tile
```

## Reporting a wrong detection

The popup's **Wrong?** button opens a prefilled issue on this repo — site origin
only, plus what was reported and the evidence behind it. The extension makes no
outbound request of its own; you review the draft and submit it, which is what
keeps the "Local only" badge honest. `buildReportUrl()` in
[shared/result-shape.js](shared/result-shape.js) builds it, and
[tests/report.test.js](tests/report.test.js) asserts the full URL, path and query
never make it in.

Incoming reports are the feedback loop for signature accuracy: a false positive
means a rule is too loose, a miss means a signature is absent or the library
leaves no fingerprint.

## Privacy

Detection runs only on your machine using DOM, script URLs, cookies (names), and MAIN-world probes. Matching uses bundled signatures — no remote signature fetch.

The canonical policy lives in this repo: [PRIVACY.md](./PRIVACY.md). A [read-only gist mirror](https://gist.github.com/deepu0/6c31c2c0d5d776bc5272b2752a965854) exists only because the Chrome Web Store requires a publicly reachable policy URL; if the two ever differ, the repo version wins.

## Package for Chrome Web Store

```bash
npm test
npm run test:browser
npm run assets   # regenerate store screenshots from the current engine
npm run pack
# → dist/whatstack-<version>.zip
```

`npm run assets` renders the real popup against real `detect()` output, so the
listing screenshots always match what the shipped engine reports.

Listing kit (descriptions, permission justifications, screenshots): [store/LISTING.md](./store/LISTING.md)  
Pre-submit checklist: [docs/PRE-SUBMIT-AUDIT.md](./docs/PRE-SUBMIT-AUDIT.md)

## Status

Live on the [Chrome Web Store](https://chromewebstore.google.com/detail/whatstack/kpmbanlddakoocgimdenfeppfaidmcgk) — 5 users as of Sep 19, 2026.

## License

No LICENSE file yet — all rights reserved until one is added.
