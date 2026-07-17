# WhatStack engine audit

**Date:** 2026-07-17  
**Scope:** `shared/detect.js`, `shared/signatures.js`, content MAIN probes, resolve pipeline  
**Tests:** `npm test` (30 cases after audit fixes)

---

## Verdict

| Area | Rating | Notes |
|------|--------|--------|
| Overall engine health | **Good** | Solid architecture; known false-positive classes fixed |
| False-positive resistance | **Strong** | Asset-only scripts; no prose matching; RDT/Redux hook traps addressed |
| False-negative risk | **Medium** | Minified-only state libs, custom MFEs, delayed remotes still hard |
| Maintainability | **Good** | Signatures declarative; resolveStack for family logic |
| Local-only policy | **Pass** | No remote signature fetch |

**Ship stance:** Ready for continued private use and iteration. Not “complete catalog,” but detection policy is sound.

---

## Architecture (what the engine does)

```
Page
  → content (light): DOM flags, script src, preload, perf resources, inline bodies, cookies, meta
  → service worker: detect(light) → badge
  → popup open: MAIN-world probe + merge → detect(deep) → shape → UI
```

**Invariants (by design):**

1. `script` / `css` checks only against **asset-like** URLs (never HTML body prose).  
2. Frameworks with `requiresRuntime` need runtime/asset proof or are dropped.  
3. Meta-frameworks (Next / Nuxt / SvelteKit) suppress competing frameworks without independent proof.  
4. React requires **DevTools-style solid proof** (renderer / fiber / UMD / CDN / Next imply) — **not** bare `__REACT_DEVTOOLS_GLOBAL_HOOK__`.  
5. Matching is fully local (bundled signatures + probes).

---

## Automated verification (this audit)

| Check | Result |
|-------|--------|
| `npm test` | **30/30 pass** (after audit fixes) |
| `scripts/manifest-audit.js` | PASS — MV3, all paths exist |
| `scripts/local-only-audit.js` | PASS — no remote detection APIs |

---

## Strengths

1. **Prose isolation** — job boards listing “Vue.js / React.js” no longer fire frameworks.  
2. **React DevTools alignment** — hook alone ≠ React; needs `renderers` / fiber / real UMD.  
3. **Family resolve** — Next→React, Nuxt→Vue, SvelteKit→Svelte; MFE umbrella from platforms.  
4. **SDK validation** — Sentry/Stripe/NR/etc. check real APIs, not random globals.  
5. **New Relic** — CDN + `bam.nr-data.net` + `NREUM` config + agent APIs + inline snippet.  
6. **Evidence model** — every hit can show *why* (type + snippet).  
7. **Test fixtures** — positive + negative (IRCTC-style Angular, copy-only tools, empty RDT hook).

---

## Issues found & fixed in this audit

| Severity | Issue | Fix |
|----------|--------|-----|
| **High** | Redux DevTools extension injects `__REDUX_DEVTOOLS_EXTENSION__` on **every** page → false Redux | Stop using bare extension hooks; require `__reduxStore` (dispatch+getState) or real Redux asset path |
| **Medium** | `NREUM={}` empty object could mark New Relic | Require `info.licenseKey` / `applicationID` / beacon / agent / init |

---

## Residual risks (not fixed — known limits)

| Risk | Why | Mitigation later |
|------|-----|------------------|
| **State libs in prod bundles** | Zustand/Redux often leave no globals | Accept best-effort; optional source-map (opt-in) |
| **Delayed scripts** | Agents load after 1.5s rescan | Second delayed rescan or MutationObserver |
| **`window.next` alone** | Weight 2 runtime; rare non-Next pollution | Prefer strong Next signals only for high |
| **`#__next` alone** | Dropped without other Next proof | OK |
| **styled-components `sc-` classes** | Medium flaky if only class heuristic | Prefer `data-styled` / script path |
| **Tailwind utility density** | Low confidence only | Keep collapsed / labeled |
| **SystemJS alone** | Not auto-promoted to Microfrontend | OK by design |
| **iframe MFEs** | No solid fingerprint | Document as out of scope |
| **global `analytics` / Segment** | Weak if ever re-added | Keep Segment on CDN path only |
| **Performance resource list** | Can include third-party “react” in unrelated URLs | Patterns require path context (`/react@`, CDN host) |

---

## Category coverage snapshot

| Category | Examples | FP posture |
|----------|----------|------------|
| Frameworks | Next, React, Vue, Angular, Svelte, jQuery, Solid | Strong |
| Architecture | MFE platforms + umbrella | Strong (no claim on “not MFE”) |
| Build | Webpack, Vite, Parcel, Turbopack | Strong |
| State / data | Redux (store/asset), Pinia, RQ, Apollo… | Medium (prod silence) |
| UI | Tailwind (low), Bootstrap, MUI, Emotion, sc | Mixed |
| Auth / payments / obs | Auth0, Clerk, Stripe, Sentry, NR, DD… | Strong |
| Analytics / hosting | GA, Segment, Vercel, CF… | Strong |

---

## Recommendations (priority)

1. **Done in audit:** Redux hook FP + NREUM tightness.  
2. **Optional next:** second light rescan at ~3–5s for late NR/Sentry agents.  
3. **Optional:** drop low-confidence UI heuristics from default badge count (already excluded).  
4. **Before public release:** manual smoke on 10–15 real sites (Next, Angular, Vue, NR, Stripe, job board).  
5. **Do not** reintroduce bare DevTools extension hooks as positive signals.

---

## Manual smoke checklist (owner)

- [ ] onlyfrontendjobs.com → Next + React, **not** Vue from copy  
- [ ] irctc train-search → Angular, **not** React from RDT hook  
- [ ] Site with Sentry/NR browser agent → Observability row  
- [ ] Plain blog mentioning tools → empty or minimal stack  
- [ ] Module Federation demo → Architecture / Microfrontend  

---

## Sign-off

Engine policy is **consistent and defensive**. Remaining gaps are **coverage** (more signatures / late load), not broken foundations. Safe to keep iterating on private repo; re-audit before Chrome Web Store if detection surface grows a lot.
