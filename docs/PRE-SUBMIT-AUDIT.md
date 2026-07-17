# Pre-submit audit (Chrome Web Store)

**Date:** 2026-07-17  
**Version:** 1.7.1  
**Repo:** https://github.com/deepu0/whatstack  
**Privacy policy URL:** https://gist.githubusercontent.com/deepu0/6c31c2c0d5d776bc5272b2752a965854/raw/PRIVACY.md  
**Upload package:** `dist/whatstack-1.7.1.zip` (`npm run pack`)

---

## Go / No-go

| Gate | Status |
|------|--------|
| Automated tests | **PASS** 39/39 (includes store-readiness) |
| Manifest structural | **PASS** MV3, all paths resolve |
| Local-only detection | **PASS** no remote signature fetch |
| Unused permissions | **PASS** — only `scripting` + `tabs` |
| Package zip | **PASS** — 14 runtime files, 41.8 KB |
| Privacy policy public URL | **PASS** — gist HTTP 200, hash matches repo |
| Listing assets | **PASS** — 1280×800 ×2, 640×400, promo 440×280 |
| Listing copy | **PASS** — `store/LISTING.md` |

**Verdict:** **PUBLISH-READY.** Upload zip + paste listing kit. Dashboard “Submit for review” requires the publisher’s Google account (not automatable here).

---

## Automated results

```
npm test                         → 39 pass
node scripts/manifest-audit.js   → PASS
node scripts/local-only-audit.js → PASS
npm run pack                     → dist/whatstack-1.7.1.zip
```

---

## Security / privacy review

| Item | Finding |
|------|---------|
| Remote code | None |
| Detection network | None in runtime paths |
| Data exfiltration | Not implemented |
| Host permissions | Broad `http(s)://*/*` — justified for stack detection |
| Brand icons | DOMParser (no raw `innerHTML` HTML injection) |

---

## Store listing checklist

- [ ] Developer account + one-time fee (account-bound)
- [x] Privacy policy URL: https://gist.githubusercontent.com/deepu0/6c31c2c0d5d776bc5272b2752a965854/raw/PRIVACY.md
- [x] Screenshots in `store/screenshots/` (1280×800 and 640×400)
- [x] Promo tile `store/promo/promo-tile-440x280.png`
- [x] Detailed description + single purpose in `store/LISTING.md`
- [x] Zip package via `npm run pack`
- [ ] Declare in CWS UI: no remote code, no user data sold
- [ ] Click **Submit for review** in CWS dashboard

---

## Manual smoke (recommended once after upload)

1. Load `dist/whatstack-1.7.1.zip` contents unpacked  
2. chatgpt.com → Remix preferred over Next  
3. Job board → no Vue from copy  
4. Angular site → no React from DevTools hook alone  
5. Copy JSON works  

---

## Account-bound limit

Chrome Web Store Developer Dashboard submit cannot be completed without the publisher’s Google login and developer registration fee. This audit delivers the complete upload package and listing kit.
