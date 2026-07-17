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
4. Add a **positive fixture** and a **non-flaky prose-only** case when relevant
5. Run `npm test`

## Publishing (later)

Chrome Web Store packaging is out of scope until the product owner is satisfied. Do not commit private keys (`.pem`) or store credentials.
