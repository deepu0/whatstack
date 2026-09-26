# Chrome Web Store listing kit — WhatStack

**Version:** 1.8.1  
**Privacy policy URL (public):** https://gist.githubusercontent.com/deepu0/6c31c2c0d5d776bc5272b2752a965854/raw/PRIVACY.md  
**Privacy policy page (prefer this in CWS UI):** https://gist.github.com/deepu0/6c31c2c0d5d776bc5272b2752a965854  
**Upload package:** `dist/whatstack-1.8.1.zip` (rebuild: `npm run pack`)

---

## Short description (max 132 characters)

```
See what any website is built with — frameworks, tools, and libraries. Instant, private stack detection.
```

Character count: 105

---

## Detailed description (paste into store)

Chrome Web Store policy rejects long lists of technology names as keyword spam
(1.8.1 was rejected for the old "WHAT IT DETECTS" lists, violation "Yellow
Argon"). Describe categories in prose; name at most one example stack.
`tests/store-readiness.test.js` enforces this.

```
WhatStack tells you what a website is built with — instantly, on the page you’re already viewing.

Open any site, click the toolbar icon, and get a clear breakdown of its frontend stack. No DevTools digging, no guesswork from the marketing page, no account.

WHY INSTALL IT
• Research competitors and products — learn real stacks, not job-post fluff
• Speed up technical interviews, sales calls, and client discovery
• Learn by example — see how production sites actually ship
• Share findings with your team as text, Markdown, or JSON
• Stay private — detection runs only on your device; nothing is uploaded

WHAT YOU GET
• A one-line summary of the core stack, for example “Next.js · React · Webpack”
• Results grouped by category, each with a confidence level (high, medium or low), so weak signals never look like facts
• The evidence behind every result — expand a row to see exactly what was matched on the page
• A toolbar badge that shows how many technologies were found as you browse

WHAT IT RECOGNIZES
More than 80 technologies across twelve categories: frameworks, CMS and site builders, micro-frontend architecture, build tools, state management, data fetching and routing, UI and CSS libraries, authentication, payments, error monitoring, analytics, and hosting.

WhatStack only counts real evidence — scripts the page actually loads, objects running on the page, and markers in its structure. Words on the page, file names and search terms never count. Some heavily minified sites leave no fingerprints, so a missing result does not always mean a tool is absent.

BUILT FOR TRUST
Everything runs on your machine. WhatStack does not upload page content or results, does not sell data, and has no ads. If a result looks wrong, the “Wrong?” button opens a draft GitHub issue that you review and submit yourself — it includes the site’s origin only, never the full URL.

HOW TO USE
1. Install WhatStack
2. Visit any website
3. Click the WhatStack icon
4. Read the summary and the categories
5. Optional: copy the results or report a miss

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
Used to run a read-only, on-device probe in the page after it loads and when the user opens the popup, and to inject the content script into already-open tabs after install or update. The probe only reads framework-related objects; it does not modify the page or track the user.
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
2. Upload `dist/whatstack-1.8.1.zip`  
3. Paste short + detailed description from this file  
4. Upload screenshots + promo tile  
5. Set privacy policy URL (prefer the HTML gist page above; re-publish gist first so it matches `PRIVACY.md`)  
6. Complete single purpose + permission justifications  
7. Submit for review  

Developer fee and dashboard login require the publisher’s Google account.
