# Chrome Web Store listing kit — WhatStack

**Version:** 1.7.2  
**Privacy policy URL (public):** https://gist.githubusercontent.com/deepu0/6c31c2c0d5d776bc5272b2752a965854/raw/PRIVACY.md  
**Privacy policy page (prefer this in CWS UI):** https://gist.github.com/deepu0/6c31c2c0d5d776bc5272b2752a965854  
**Upload package:** `dist/whatstack-1.7.2.zip` (rebuild: `npm run pack`)

---

## Short description (max 132 characters)

```
See what any website is built with — frameworks, tools, and libraries. Instant, private stack detection.
```

Character count: 105

---

## Detailed description (paste into store)

```
WhatStack tells you what a website is built with — instantly, on the page you’re already viewing.

Open any site, click the toolbar icon, and get a clear breakdown of its frontend stack: frameworks, UI libraries, data tools, auth and payments, analytics, and more. No DevTools digging. No guesswork from the marketing page. No account.

WHY INSTALL IT
• Research competitors and products — learn real stacks, not job-post fluff
• Speed up technical interviews, sales calls, and client discovery
• Learn by example — see how production sites actually ship
• Share findings with your team as text, Markdown, or JSON
• Stay private — detection runs only on your device; nothing is uploaded for scanning

WHAT YOU GET
• A one-line headline of the core stack (e.g. Next.js + React + Tailwind)
• Categories with confidence (high / medium / low) so weak signals don’t look like facts
• Expandable evidence for every hit — why WhatStack thinks that library is present
• A badge on the toolbar as you browse, with a deeper scan when you open the popup

WHAT IT DETECTS (examples)
• Frameworks: React, Next.js, Remix, Vue, Nuxt, Angular, Svelte/SvelteKit, Astro, Gatsby, Qwik, Preact, Lit, Polymer, Ember, TanStack Start, Alpine.js, htmx, jQuery, Solid
• CMS & site builders: WordPress, Shopify, Webflow, Framer
• Architecture: Module Federation, single-spa, qiankun, SystemJS
• Build: Webpack, Vite, Parcel, Turbopack
• Data: TanStack Query/Router/Table/Form/Virtual (including production builds with no package names), Apollo, Redux, SWR, Axios
• UI: Tailwind, Bootstrap, MUI, Emotion, styled-components
• Auth & payments: Auth0, Clerk, Firebase, Stripe, Razorpay
• Observability: Sentry, Datadog, New Relic, LogRocket
• Analytics & hosting: Google Analytics, Segment, PostHog, Plausible, Fathom, Amplitude, Vercel, Cloudflare, and more

BUILT FOR TRUST
WhatStack analyzes publicly visible page signals on your machine only. It does not upload page content or stack results, does not sell data, and has no ads. If a result looks wrong, “Wrong?” opens a draft GitHub issue you review and submit yourself — site origin only, never the full URL.

Note: some minified production apps leave no fingerprints. A miss does not always mean the library is absent; a mention in marketing copy alone is not treated as a real install.

HOW TO USE
1. Install WhatStack
2. Visit any website
3. Click the WhatStack icon
4. Read the headline and categories
5. Optional: copy results or report a miss

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
| Does the extension collect user data? | No (no remote collection). The “Wrong?” button opens a prefilled GitHub issue in a new tab containing the site origin and the detection result; the extension transmits nothing itself and the user submits it. |
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
2. Upload `dist/whatstack-1.7.2.zip`  
3. Paste short + detailed description from this file  
4. Upload screenshots + promo tile  
5. Set privacy policy URL (prefer the HTML gist page above; re-publish gist first so it matches `PRIVACY.md`)  
6. Complete single purpose + permission justifications  
7. Submit for review  

Developer fee and dashboard login require the publisher’s Google account.
