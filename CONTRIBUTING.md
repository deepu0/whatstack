# Contributing to WhatStack

## Commits

Prefer small, focused commits:

- `feat:` new detection or UX
- `fix:` false positive / miss
- `test:` fixtures and coverage
- `docs:` README / comments
- `chore:` tooling, ignore, packaging

## Detection rules

Before adding a signature:

1. Prefer **asset URLs** and **runtime globals** over page text
2. Never match marketing copy (e.g. “we use React”)
3. For React-like hooks, require real registration (see DevTools renderer rule)
4. Match URLs on host / package boundaries — rules see the URL **without** its
   query string (set `matchQuery: true` only if the query is the evidence)
5. Globals need a shape check in the probe (`typeof x.method === 'function'`):
   any element with an `id` becomes a window property
6. Add a case to `POSITIVE` in `tests/signature-coverage.test.js` — the gate
   also runs a prose / file-name / search-query case against every rule
7. Add a brand mark in `shared/brand-icons.js`
8. Run `npm run check`; if the golden corpus snapshot changes on purpose,
   review it and run `npm run corpus:update`

## Releases

Bump `manifest.json`, `package.json` and `package-lock.json` together
(`npm version <x.y.z> --no-git-tag-version`, then the manifest) and add
`docs/RELEASE-<x.y.z>.md`; `scripts/check-version.mjs` enforces it. Do not
commit private keys (`.pem`) or store credentials.
