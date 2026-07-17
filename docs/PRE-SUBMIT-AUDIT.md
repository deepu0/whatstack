# Pre-submit audit (Chrome Web Store)

**Date:** 2026-07-17  
**Version:** 1.7.1  
**Repo:** https://github.com/deepu0/whatstack  

---

## Go / No-go

| Gate | Status |
|------|--------|
| Automated tests | **PASS** 34/34 |
| Manifest structural | **PASS** MV3, all paths resolve |
| Local-only detection | **PASS** no remote signature fetch |
| Unused permissions | **Fixed** — removed unused `storage` |
| Package size | **~224 KB** source; zip will be smaller |
| Privacy policy draft | **READY** (`PRIVACY.md`) — host URL for store |
| Store zip script | **READY** `npm run pack` |

**Verdict:** **GO for packaging and store draft**, after you:

1. Host `PRIVACY.md` (GitHub Pages / site) and paste URL in the listing  
2. Run `npm run pack` and upload `dist/whatstack-1.7.1.zip`  
3. Complete store questionnaire (single purpose, host permission justification)

---

## Automated results

```
npm test                 → 34 pass
node scripts/manifest-audit.js → PASS
node scripts/local-only-audit.js → PASS
```

---

## Security / privacy review

| Item | Finding |
|------|---------|
| Remote code | None |
| `eval` / `new Function` | None in extension runtime |
| Network for detection | None in `shared/*`, content, background, popup |
| `innerHTML` | Brand icons only; switched to `DOMParser` + `importNode` |
| Host permissions | Broad `http(s)://*/*` — **required** for content script + any-tab scan; justify in store form as “read page structure on sites user visits to identify frontend stack” |
| Data exfiltration | Not implemented |
| Web accessible resources | Empty / omitted |

---

## Permissions justification (paste into store)

**Single purpose:** Identify the frontend technology stack of the web page the user is viewing.

- **Host access:** Read DOM markers, script URLs, cookie names, and limited page globals on pages the user navigates to.  
- **scripting:** Optional MAIN-world probes for deep scan when popup opens.  
- **tabs:** Associate results with the active tab and set badge text.

---

## Product / engine readiness

| Area | Notes |
|------|--------|
| Frameworks | Next, Remix, React, Vue, Angular, Svelte, TanStack Start, jQuery, Solid… |
| Anti-flake | No prose matching; React/Redux DevTools hooks alone ≠ libraries |
| UX | Headline, confidence, evidence, Copy/MD/JSON |
| Known limits | Minified-only state libs; late agents; custom iframe MFEs |

---

## Store listing checklist (you complete)

- [ ] Developer account + one-time fee  
- [ ] Privacy policy URL (public)  
- [ ] Screenshots (1280×800 or 640×400) — popup on Next site, Angular site, empty  
- [ ] Small promo tile 440×280 (optional)  
- [ ] Detailed description + category (Developer Tools)  
- [ ] Upload zip from `npm run pack`  
- [ ] Declare: no remote code, no user data sold  
- [ ] Keep repo private until listing approved if preferred  

---

## Manual smoke before click Submit

1. Load unpacked **or** load the zip as unpacked after unpack  
2. chatgpt.com → prefer **Remix**, not Next  
3. onlyfrontendjobs → **Next**, not Vue from copy  
4. IRCTC-style Angular → **Angular**, not React from RDT hook  
5. Restricted `chrome://` → friendly error  
6. Copy JSON works  

---

## Residual non-blockers

- Logo is functional but not marketing-polished  
- `icons/variant-*` and tests stay out of store zip via pack script  
- No automated e2e against live Chrome with extension loaded (unit tests cover engine)

**Sign-off:** Engineering gates cleared for **store submission prep**. Final submit is a product/listing decision after privacy URL + screenshots.
