# Pre-submit audit (Chrome Web Store)

**Date:** 2026-07-26  
**Version:** 1.7.2  
**Repo:** https://github.com/deepu0/whatstack  
**Privacy policy URL:** https://gist.githubusercontent.com/deepu0/6c31c2c0d5d776bc5272b2752a965854/raw/PRIVACY.md  
**Upload package:** `dist/whatstack-1.7.2.zip` (`npm run pack`)

---

## Go / No-go

| Gate | Status |
|------|--------|
| Automated tests | **PASS** 134/134 (`npm test`, includes store-readiness + probe/rule-pack contract) |
| Real-browser tests | **PASS** 11/11 (`npm run test:browser`, real unpacked extension in Playwright Chromium; branded Chrome ≥137 no longer honours `--load-extension`) |
| Manifest structural | **PASS** — 16 paths, 0 missing |
| Local-only detection | **PASS** — no remote signature fetch |
| Unused permissions | **PASS** — only `scripting` + `tabs` |
| Package zip | **PASS** — 21 entries, 46.5 KB |
| Privacy policy public URL | **RE-PUBLISH** — `PRIVACY.md` now discloses the “Wrong?” report flow, so the gist no longer matches the repo copy |
| Listing assets | **PASS** — regenerated after the brand-icon namespace fix; marks render |
| Live-web smoke | **PASS** — real extension via `REQUEST_DEEP_SCAN`: nextjs.org → Next+React+Turbopack, vuejs.org → Vue v3.5.39, angular.dev → Angular v22, example.com → clean |
| Listing copy | **PASS** — `store/LISTING.md` |

**Verdict:** **PUBLISH-READY pending the manual smoke test below.** Upload the zip
and paste the listing kit. Dashboard “Submit for review” requires the publisher’s
Google account (not automatable here).

---

## Automated results

```
npm test                         → 134 pass, 0 fail
npm run test:browser             → ALL BROWSER CASES PASS (11/11)
node scripts/manifest-audit.js   → PASS (16 paths, missing=0)
node scripts/local-only-audit.js → PASS (matching is local)
npm run pack                     → dist/whatstack-1.7.2.zip
npm run assets                   → store screenshots + promo tile
```

`npm run test:browser` loads the real unpacked extension into real Chromium and
drives it against local fixture pages — the content script's `querySelector`
calls run against real parsed HTML, the service worker really registers, and
results are read back from `chrome.action.getBadgeText`.

### Regression evidence for the 1.7.2 DOM-evidence fix

The same browser suite run against 1.7.1 sources fails three cases, which is the
shipped bug reproduced in a browser:

| Fixture | 1.7.1 | 1.7.2 |
|---|---|---|
| `docs-next.html` | leaks `nextjs`, `react` | clean |
| `docs-angular.html` | leaks `angular` | clean |
| `docs-styled.html` | leaks `styled-components`, `emotion` | clean |
| `real-next.html` / `real-angular.html` / `real-styled.html` | detected | still detected |

---

## Security / privacy review

| Item | Finding |
|------|---------|
| Remote code | None |
| Detection network | None in runtime paths |
| Data exfiltration | Not implemented |
| Page HTML | **Not collected.** Evidence comes from probed DOM flags and real asset URLs only; the content script no longer ships `outerHTML` at all |
| “Wrong?” report button | No outbound request from the extension — `chrome.tabs.create` opens a prefilled GitHub issue the user submits. Site **origin only**, no path or query. Disclosed in `PRIVACY.md` and the listing. |
| Host permissions | Broad `http(s)://*/*` — justified for stack detection |
| Brand icons | DOMParser (no raw `innerHTML` HTML injection) |
| `minimum_chrome_version` | `102` — required for `executeScript({ world: 'MAIN' })`; verify against your support target |

---

## Store listing checklist

- [ ] Developer account + one-time fee (account-bound)
- [x] Privacy policy URL: https://gist.githubusercontent.com/deepu0/6c31c2c0d5d776bc5272b2752a965854/raw/PRIVACY.md
- [x] Screenshots in `store/screenshots/` (1280×800 ×2 and 640×400) — regenerated post icon fix
- [x] Promo tile `store/promo/promo-tile-440x280.png`
- [x] Detailed description + single purpose in `store/LISTING.md`
- [x] Zip package via `npm run pack`
- [ ] Declare in CWS UI: no remote code, no user data sold
- [ ] Click **Submit for review** in CWS dashboard

---

## Open items before submitting

1. **Optional wider smoke.** The automated live smoke covers Next, Vue, Angular
   and a plain-HTML negative through the real deep-scan path. Still worth a
   human spot check of chatgpt.com (Remix preferred over Next) and the popup's
   Copy / MD / JSON buttons on a real site.
2. **Re-publish the privacy gist.** `PRIVACY.md` gained a “Reporting a wrong
   detection” section, so the public gist is now out of date. Update it before
   submitting — the listing links reviewers straight to it.
3. **Privacy policy URL format.** The current URL is a
   `gist.githubusercontent.com/.../raw/` link, which serves `text/plain`.
   Reviewers generally expect a rendered page; the gist's HTML URL
   (`https://gist.github.com/deepu0/6c31c2c0d5d776bc5272b2752a965854`) or a
   GitHub Pages link is safer. Changing it means updating
   `store/privacy-url.txt`, `store/LISTING.md`, `README.md`, this file, and the
   assertion in `tests/store-readiness.test.js`.

---

## Known limitation, unchanged in 1.7.2

Third-party bundles are attributed to the host page. `content-script.js` feeds
every `performance.getEntriesByType('resource')` entry into `scripts`, so a site
embedding a React-based support widget lists React among its frameworks — and
claims it as *primary* when the host page has no higher-ranked framework of its
own (verified: an Angular host keeps Angular as primary). There is no
first-party/third-party origin check in the engine. This is a design decision,
not a regression, but it is the most likely remaining source of "that's wrong"
reports.

---

## Account-bound limit

Chrome Web Store Developer Dashboard submit cannot be completed without the
publisher's Google login and developer registration fee. This audit delivers the
complete upload package and listing kit.
