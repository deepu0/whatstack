# WhatStack

Chrome extension (Manifest V3) that answers: **what stack is this page using?**

Fully **local** detection — frameworks, architecture (microfrontends), build tools, state/data, UI, auth, payments, observability, analytics, and hosting hints. No cloud matching, no page upload.

## Load unpacked (development)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → this repository root
4. After pulls/commits: click **Reload** on the extension card, then hard-refresh the tab

## Features

- Hybrid scan: light pass on navigate (badge) + deep pass when the popup opens
- Confidence tiers + expandable evidence (why it matched)
- Core stack headline + Copy / Markdown / JSON export
- React detection aligned with React DevTools (renderer registered, not bare hook)
- Microfrontend platforms: Module Federation, single-spa, qiankun, SystemJS
- Observability includes Sentry, Datadog, **New Relic**, LogRocket, and more

## Develop / test

```bash
npm test
node scripts/manifest-audit.js
node scripts/local-only-audit.js
```

## Layout

```
manifest.json
background/service-worker.js   # cache, badge, deep scan
content/content-script.js      # light signals
popup/                         # toolbar UI
shared/detect.js               # pure detection engine
shared/signatures.js           # local rule pack
shared/result-shape.js         # popup shaping + exports
shared/brand-icons.js          # tech marks (local SVG)
tests/                         # node:test fixtures
scripts/                       # structural / local-only audits
icons/                         # toolbar + brand assets
```

## Privacy

Detection runs only on your machine using DOM, script URLs, cookies (names), and MAIN-world probes. Matching uses bundled signatures — no remote signature fetch for detection.

## License

Private / unpublished until ready for Chrome Web Store. Add a license file before public release.
