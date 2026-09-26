# WhatStack 1.8.0 — precision, a badge you can trust, and 18 new technologies

This release implements every finding in [AUDIT-2026-09.md](AUDIT-2026-09.md).
Each fix ships with a test that reproduces the 1.7.2 input and fails without it.

## Headline numbers (48 real sites, same harness before and after)

| | 1.7.2 | 1.8.0 |
|---|---|---|
| Badge count = popup count | 21 / 48 | **48 / 48** |
| "Tailwind MEDIUM" from class names alone | 17 | 2 (Tailwind-only syntax present) |
| Confirmed wrong results from the audit | 9 | **0** |
| Sites with nothing detected | 3 | 2 (amazon.in, zomato.com) |
| Deep scan median / p95 | 46 / 208 ms | 60 / 243 ms |
| Technologies | 64 | **82** |
| Tests | 134 | **433** (+ 17 real-browser checks) |

## Precision

- **`window.next` is a hint, not proof.** DOM clobbering (`<a id="next">`) or another
  runtime's `window.next` (linear.app: `1.0.0-beta.9`) no longer produces
  *Next.js + React HIGH*. Next.js is promoted to high only with strong proof.
- **Clobber-safe probe.** Elements, collections and `window` are never treated as
  libraries, and each global needs its library's shape (`axios.get`, `bootstrap.Modal`,
  callable `gtag`, …). `<div id="bootstrap">` is no longer Bootstrap HIGH.
- **URL rules match host and path, never the query or a stray word.** An image named
  `logrocket-vs-zendesk.png`, a search for `?q=qiankun`, or Clerk's own
  `…/bootstrap.js` loader no longer fire rules. Query strings are also stripped from
  evidence, so tokens stay out of exports and reports (Vercel's `?dpl=` opts in).
- **Code, not prose.** Inline rules are code-shaped, and only executable inline scripts
  are sampled — JSON / ld+json data islands are skipped. A post about
  *single-spa and module federation* no longer reports four microfrontend hits.
- **Tailwind:** no more double counting. `--tw-*` custom properties → high,
  Tailwind-only syntax (`md:flex`, `w-[42px]`, `bg-black/50`, palette colours) → medium,
  generic utility soup (shared with Bootstrap) → low.
- **Versions from the right package:** `@remix-run/react` is not React,
  `@tanstack/react-router` is not React Router, `react-bootstrap` is not Bootstrap,
  `preact-10.19.js` is not React, a pagination cursor is not a Next.js version.
  Versions outside a technology's plausible major range are dropped, and build
  metadata (`+sha-…`) is trimmed.
- **Third-party attribution:** a build tool seen only in another site's scripts, or a
  bundler global that conflicts with the page's meta-framework (Parcel on a Next.js
  site, via an embedded widget), is shown as low.
- Weak rules stay weak: `/api/auth/session`, `/graphql` endpoints, `sc-button`,
  cdnjs-hosted libraries (≠ Cloudflare hosting).

## A badge you can trust

The content script runs in an isolated world: it shares the DOM but not the page's
JavaScript, so React fibers, `el.__vue_app__` or `window.Stripe` were only visible
once the popup opened. Now:

- every page load schedules a **background MAIN-world probe** (debounced), so the
  badge counts what the popup shows;
- a later light pass **never lowers** a deep result for the same document;
- SPA route changes clear the badge and rescan; bfcache restores and prerender
  activation re-post; open tabs are re-injected on install/update;
- prerendering and non-top-frame documents can't overwrite the visible tab's badge.

## Reliability

- **Rescan is real:** a deep scan always re-collects signals.
- The service worker **always answers**; the probe and signal collection time out
  (3 s / 2.5 s), so a hung page can't leave the popup on "Scanning…".
- **Hostile pages can't break the scan:** every probe detector runs in its own
  `try`, page strings are clipped, page objects are never stringified.
- Pages Chrome won't let extensions read (Web Store, `file:`, `data:`, PDF viewer)
  show an honest message instead of "No solid stack signals".
- Results are labelled with the document that answered if the tab navigated mid-scan.
- Tooltip: "1 technology" / "5 technologies".

## New technologies (18)

- **Frameworks:** Astro, Gatsby, Qwik, Preact, Lit, Polymer, Ember, AngularJS (split
  from Angular), Alpine.js, htmx
- **CMS / site builders (new category):** WordPress, Shopify, Webflow, Framer
- **Analytics:** PostHog, Plausible, Fathom, Amplitude

Corrected detectors: Turbopack (`TURBOPACK`), SvelteKit (`__sveltekit_<hash>`),
Svelte 5 version (`__svelte.v`), React without DevTools (`_reactListening`),
Vue 2 (`el.__vue__`), webpack 4 (`webpackJsonp`), Angular emulated styles
(`_ngcontent-*`, previously a selector that could never match).

## Exports

Headline capped at 5 parts, Markdown cells escaped, JSON gains `schemaVersion: 1`,
report evidence drops query strings and backticks.

## Proof

- `tests/audit-regressions.test.js` — one test per audit finding
- `tests/main-probe.test.js` — the real MAIN-world probe, executed in `node:vm`
  (hostile getters, Proxies, clobbering, shape checks)
- `tests/signature-coverage.test.js` — **every** signature has a positive case and a
  prose / file-name / search-query case (it found three more false positives)
- `tests/corpus.test.js` — **46 real sites** captured with `npm run corpus:capture`
  and replayed offline with reviewed expectations and full snapshots
- `tests/scan-orchestrator.test.js` — caching, background deep pass, monotonic badge,
  timeouts, re-injection, SPA rescans
- `npm run test:browser` — real extension in real Chromium (headless-capable):
  badge before the popup = popup count, clobbering / prose / Bootstrap fixtures,
  SPA rebuild, restricted pages
- CI (`.github/workflows/ci.yml`): lint, type check, unit + corpus on Node 20/22,
  coverage ≥ 80 %, browser suite, store zip artifact

## Permissions

Unchanged: `scripting`, `tabs`, http/https host access. No new permission.

## Benchmark detail

Headless Chromium, unpacked extension, 7 s after load. "badge → popup" is the
toolbar badge before opening the popup, then the popup's solid count.

| Site | 1.7.2 badge → popup | 1.8.0 badge → popup | 1.8.0 result |
|---|---|---|---|
| angular.dev | 2 → 2 | 2 → 2 | Angular v22.2.0, Google Analytics |
| astro.build | 1 → 1 | 3 → 3 | Astro, Tailwind CSS, Fathom |
| auth0.com | 8 → 9 | 8 → 8 | Next.js v14.2.35, React, Webpack, styled-components, Auth0, Sentry, Google Analytics, Vercel |
| chakra-ui.com | 5 → 5 | 5 → 5 | Next.js v15.5.19, React, Webpack, Emotion, Plausible |
| clerk.com | 7 → 7 | 7 → 7 | Next.js v16.3.6, React, Turbopack, Tailwind CSS, Clerk, Google Analytics, PostHog |
| dev.to | 1 → 1 | 1 → 1 | Tailwind CSS (L), Google Analytics |
| discord.com | 1 → 3 | 5 → 5 | jQuery v3.5.1, React, Webflow, Webpack, Google Analytics |
| en.wikipedia.org | – → 1 | 1 → 1 | jQuery v3.7.1 |
| getbootstrap.com | 3 → 3 | 3 → 3 | Astro, Bootstrap, Tailwind CSS (L), Fathom |
| github.com | – → 1 | 3 → 3 | Lit v1.1.2, React, Import Maps (L), React Router v8.3.0 |
| gitlab.com | 4 → 5 | 5 → 5 | Nuxt, Vue v3.5.29, Sentry, Google Analytics, Hotjar |
| jquery.com | 1 → 1 | 2 → 2 | jQuery v4.0.0, WordPress |
| linear.app | 3 → 4 | 5 → 5 | Next.js, React, styled-components, Sentry, PostHog |
| medium.com | 1 → 1 | 2 → 2 | Tailwind CSS (M), Cloudflare |
| mui.com | 6 → 6 | 7 → 7 | Next.js v16.3.1, React, Webpack, Emotion, MUI (Material UI), Tailwind CSS, Google Analytics |
| newrelic.com | 3 → 4 | 5 → 5 | jQuery v4.0.0, Lit v2.8.0, Webpack, Tailwind CSS, Bootstrap (L), New Relic |
| nextjs.org | 5 → 5 | 4 → 4 | Next.js v16.4.0-canary.38, React, Turbopack, Tailwind CSS |
| notion.com | 3 → 4 | 5 → 5 | Next.js v16.3.2, React, Turbopack, Tailwind CSS (L), Sentry, Google Analytics |
| nuxt.com | 3 → 3 | 3 → 3 | Nuxt, Vue v3.5.42, Import Maps (L), Tailwind CSS |
| razorpay.com | 5 → 7 | 7 → 7 | React, Framer, Webpack, styled-components, Sentry v10.32.1, Google Analytics, Segment |
| react.dev | 5 → 5 | 5 → 5 | Next.js v15.1.12, React, Webpack, Tailwind CSS, Google Analytics |
| remix.run | – → – | 1 → 1 | Import Maps (L), Fathom |
| segment.com | 2 → 5 | 5 → 5 | jQuery v1.12.4-aem, Webpack, Sentry, Google Analytics, Segment |
| sentry.io | 2 → 3 | 6 → 6 | Astro, React, Tailwind CSS, Sentry, Plausible, Vercel |
| stackoverflow.com | 5 → 6 | 5 → 5 | jQuery v3.7.1, Svelte v5, Webpack, Google Analytics, Cloudflare |
| stripe.com | 4 → 5 | 5 → 5 | Next.js v14.2.32, React, Webpack, Sentry, Google Analytics (M) |
| supabase.com | 5 → 6 | 8 → 8 | Next.js v15.5.25, React, Webpack, Tailwind CSS, Sentry, PostHog, Google Analytics (M), Vercel |
| svelte.dev | 3 → 3 | 3 → 3 | Svelte v5, SvelteKit, Vercel |
| tailwindcss.com | 5 → 5 | 5 → 5 | Next.js v16.2.6, React, Turbopack, Tailwind CSS, Google Analytics |
| vercel.com | 4 → 5 | 5 → 5 | Next.js v16.4.0-canary.38, React, Turbopack, Tailwind CSS, Sentry |
| vuejs.org | – → 1 | 2 → 2 | Vue v3.5.42, Fathom |
| wordpress.org | 1 → 1 | 2 → 2 | WordPress, Import Maps (L), Google Analytics |
| www.airbnb.com | 1 → 3 | 3 → 3 | React, React Router v6, Google Analytics (M) |
| www.amazon.in | – → – | – → – | — |
| www.atlassian.com | 2 → 5 | 5 → 5 | React, Emotion, Sentry, Google Analytics, Intercom |
| www.canva.com | 1 → 1 | 1 → 1 | Cloudflare |
| www.datadoghq.com | 5 → 6 | 5 → 5 | Alpine.js v3.14.9, Webpack, Tailwind CSS, Bootstrap (L), Datadog RUM, Google Analytics |
| www.figma.com | 5 → 6 | 6 → 6 | Next.js v15.5.24, React, Webpack, Emotion, Sentry, Netlify (M) |
| www.flipkart.com | 1 → 4 | 4 → 4 | React, Webpack, React Router v7.9.5, New Relic |
| www.hotjar.com | 8 → 9 | 8 → 8 | Next.js v14.2.35, React, Microfrontend, Module Federation, Webpack, Parcel (L), Tailwind CSS, Google Analytics, Hotjar |
| www.intercom.com | 8 → 9 | 9 → 9 | Next.js v16.3.2, React, Turbopack, Tailwind CSS, Datadog RUM, Sentry, Google Analytics, Intercom, Vercel |
| www.netflix.com | 1 → 3 | 3 → 3 | React, Webpack, Emotion |
| www.onlyfrontendjobs.com | 4 → 5 | 6 → 6 | Next.js v16.3.0, React, Turbopack, Tailwind CSS, Sentry, PostHog |
| www.reddit.com | 1 → 1 | 1 → 1 | Tailwind CSS (M) |
| www.shopify.com | 2 → 4 | 5 → 5 | React, Shopify, React Router v7.18.2, Tailwind CSS, Google Analytics |
| www.spotify.com | 3 → 6 | 5 → 5 | React, React Router v6, styled-components, Sentry, Google Analytics |
| www.youtube.com | – → – | 1 → 1 | Polymer v3.5.0 |
| www.zomato.com | – → – | – → – | — |
