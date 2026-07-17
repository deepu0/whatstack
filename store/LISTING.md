# Chrome Web Store listing kit — WhatStack

**Version:** 1.7.1  
**Privacy policy URL (public):** https://gist.githubusercontent.com/deepu0/6c31c2c0d5d776bc5272b2752a965854/raw/PRIVACY.md  
**Privacy policy page:** https://gist.github.com/deepu0/6c31c2c0d5d776bc5272b2752a965854  
**Upload package:** `dist/whatstack-1.7.1.zip` (rebuild: `npm run pack`)

---

## Short description (max 132 characters)

```
See what a site is built with — React, Next, Remix, Vue, Angular, TanStack & more. Fully local stack detection.
```

Character count: 111

---

## Detailed description (paste into store)

```
WhatStack shows the frontend tech stack of the page you’re viewing — frameworks, microfrontends, build tools, state/data libraries, UI kits, auth, payments, observability, analytics, and hosting hints.

HOW IT WORKS
• Light scan as you browse (toolbar badge)
• Deep scan when you open the popup (includes MAIN-world probes)
• Results grouped by category with confidence (high / medium / low)
• Expand any hit to see evidence (script URL, global, DOM marker, etc.)
• Copy results as plain text, Markdown, or JSON

WHAT WE DETECT (examples)
• Frameworks: React, Next.js, Remix, Vue, Nuxt, Angular, Svelte/SvelteKit, TanStack Start, jQuery, Solid
• Architecture: Module Federation, single-spa, qiankun, SystemJS
• Build: Webpack, Vite, Parcel, Turbopack
• Data: TanStack Query/Router/Table/Form/Virtual, Apollo, SWR, Axios
• UI: Tailwind, Bootstrap, MUI, Emotion, styled-components
• Auth / payments: Auth0, Clerk, Firebase, Stripe, Razorpay
• Observability: Sentry, Datadog, New Relic, LogRocket
• Analytics & hosting: GA, Segment, Vercel, Cloudflare, and more

PRIVACY-FIRST
Detection runs entirely on your device. WhatStack does not upload page content or stack results to any server. Matching uses bundled signatures only — no remote signature service and no ads.

ACCURACY
We prefer solid signals (runtime globals, asset URLs, structural DOM markers). Marketing copy that only *mentions* a technology (e.g. job listings) is ignored. Some minified production libraries leave no fingerprints — absence of a hit does not always mean absence of the library.

HOW TO USE
1. Install the extension
2. Open any http(s) website
3. Click the WhatStack icon in the toolbar
4. Review the core stack headline and categories
5. Optional: Copy / MD / JSON to share findings

Single purpose: identify the frontend technology stack of the web page you are viewing.
```

---

## Category

Developer Tools

---

## Single purpose statement (questionnaire)

```
WhatStack’s single purpose is to identify the frontend technology stack of the web page the user is currently viewing, using on-device analysis of publicly visible page structure and script assets.
```

---

## Permission justifications

### Host permissions (`http://*/*`, `https://*/*`)

```
Required to run a content script on pages the user visits so WhatStack can inspect public DOM markers, script/style URLs, cookie names, and (for deep scan) limited page globals. This is necessary to detect stack technologies on arbitrary sites the user chooses to open. Data stays on the device; nothing is uploaded for detection.
```

### `scripting`

```
Used to run optional MAIN-world probes when the user opens the popup (deep scan) and to inject the content script if it was not already present. Probes only read framework-related globals; they do not modify page behavior for tracking.
```

### `tabs`

```
Used to identify the active tab, associate scan results with that tab, and update the toolbar badge/title for the current page.
```

---

## Data use / privacy questionnaire answers

| Question | Answer |
|----------|--------|
| Does the extension collect user data? | No (no remote collection) |
| Personally identifiable information? | No |
| Health / financial / authentication data? | No |
| Personal communications? | No |
| Location? | No |
| Web history sold to third parties? | No |
| Remote code? | No |
| Privacy policy | https://gist.githubusercontent.com/deepu0/6c31c2c0d5d776bc5272b2752a965854/raw/PRIVACY.md |

---

## Assets

| File | Spec |
|------|------|
| `store/screenshots/screenshot-1-1280x800.png` | Popup / product mock 1280×800 |
| `store/screenshots/screenshot-2-1280x800.png` | Second feature mock 1280×800 |
| `store/screenshots/screenshot-3-640x400.png` | Compact 640×400 |
| `store/promo/promo-tile-440x280.png` | Small promo tile |
| `icons/icon128.png` | Store icon (from package) |

---

## Submit steps (human account — cannot be automated)

1. Chrome Web Store Developer Dashboard → New item  
2. Upload `dist/whatstack-1.7.1.zip`  
3. Paste short + detailed description from this file  
4. Upload screenshots + promo tile  
5. Set privacy policy URL above  
6. Complete single purpose + permission justifications  
7. Submit for review  

Developer fee and dashboard login require the publisher’s Google account.
