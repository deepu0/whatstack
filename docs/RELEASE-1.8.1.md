# WhatStack 1.8.1 — TanStack in production

1.8.0 only recognised TanStack from package names in asset URLs
(`@tanstack/react-query@…`) and from dev-only globals. Production apps ship
hashed chunks, so real TanStack Start, Router and Query apps showed nothing:
tanstack.com itself reported only Tailwind, Sentry and Google Analytics.

## What changed

- **TanStack Router / Start production globals.** Production apps expose
  `window.__TSR_ROUTER__` (a router with `routesById` + `buildLocation`) and
  `window.__TSS_START_OPTIONS__`. 1.8.0 looked for `__TANSTACK_ROUTER__` /
  `__TANSTACK_START__`, which don't exist in production builds.
- **A bounded React-tree walk.** TanStack Query, data routers, Redux and Apollo
  have no global in production, but their clients are passed to a provider
  component. The MAIN-world probe walks the React tree from the root fiber
  (at most 6,000 fibers or 25 ms) and accepts only objects with the library's
  shape: a QueryClient has `getQueryCache` + `getMutationCache`, a TanStack
  router has `routesById` + `buildLocation`, a React Router data router has
  `routes`, `navigate`, `subscribe` and `state`, a Redux store has
  `dispatch` / `getState` / `subscribe`, an Apollo client has `watchQuery` /
  `query` / `cache`. Works when React hydrates `document` (TanStack Start).
- **Manual chunk names** (`tanstack-router-B-OQbHRF.js`, `tanstack-query-….js`)
  count as evidence; image names still never do.
- **Foreign webpack globals.** A consent banner's `webpackChunk_osano_…` on a
  Vite-built TanStack Start site is shown as low, like Parcel on Next.js in 1.8.0.

## Measured (real extension, headless Chromium)

| Site | 1.8.0 | 1.8.1 |
|---|---|---|
| tanstack.com | Tailwind, Sentry, GA, Cloudflare | **TanStack Start, Router, Query**, React, Tailwind, Sentry, GA, Cloudflare |
| railway.com | — (not in corpus) | **TanStack Start, Router, Query**, React, … (webpack from a consent banner → low) |
| bolt.new | React, React Router 7.18.2, … | … + **TanStack Query** |
| onlyfrontendjobs.com | Next.js, React, … | … + **TanStack Query** (confirmed: `@tanstack/react-query` in its package.json) |
| airbnb.com, flipkart.com | React, React Router | … + **Redux** |
| netflix.com | React, Webpack, Emotion | … + **Apollo Client** |
| spotify.com | React, React Router, … | … + **Redux, TanStack Query** |

No other result in the 49-site golden corpus changed (nextjs.org's Vercel hint
came from a lazily loaded image and did not load during the second capture).

## Not verifiable from here

- **chatgpt.com (logged out)** is OpenAI's own lightweight "Octane" shell, with
  no TanStack, React Router or Remix markers. The logged-in app may differ.
- **lovable.dev** serves a Cloudflare challenge to headless browsers.

Both can be checked in a real browser; see the README.
