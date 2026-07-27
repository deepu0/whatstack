# WhatStack 1.7.2 — correctness and pre-submit hardening

## Why this release exists

1.7.1 reported high-confidence frameworks on pages that merely *displayed*
framework markup as text. Seven frameworks were affected and the errors
cascaded into related runtimes. The full test suite passed the whole time,
because every fixture paired realistic `html` with matching `domFlags` — the
broken path was never exercised.

## Correctness fixes

### DOM evidence no longer scrapes the raw HTML string

`evalCheck()` matched structural markers against `signals.html`
(`documentElement.outerHTML`) as a fallback when a DOM flag was absent. That
string contains page **text** as well as page **structure**, so a tutorial
rendering `<div data-reactroot>` inside a `<pre>` matched as though the element
existed.

Confirmed false positives, all high confidence:

| Page content (as text) | Was reported |
|---|---|
| `<div data-reactroot>` | React |
| `ng-version="17.0.1"` | Angular |
| `<script id="__NEXT_DATA__">` | Next.js → React |
| `<div id="__nuxt">` | Nuxt → Vue |
| `data-sveltekit-hydrate` | SvelteKit → Svelte |
| `<style data-emotion>` | Emotion |
| prose mentioning `sc-bdVaJa` | styled-components |

DOM evidence now resolves from `domFlags` only. Nothing is lost: the content
script already performs real `querySelector` probing, so the flags were always
the authoritative source and the regex fallback added only noise.

`[sc-]` was the one pattern with no probe behind it, so it gained a real one
that matches the `sc-<hash>` class **token** — `desc-body` and `misc-panel` no
longer qualify.

### Asset evidence no longer scrapes the HTML string either

The same bug class existed on a second channel. `assetCandidates()` regexed
`src=`/`href=` attributes out of `signals.html` — and quotes are **not**
entity-escaped in DOM text nodes, so a docs page displaying

```
<script src="https://unpkg.com/react@18.2.0/umd/react.production.min.js">
```

inside a `<pre>` kept that URL verbatim in `outerHTML`. Reproduced result:
**React v18.2.0, high confidence, chosen as primary** — on a page that loads no
React at all. Worse, the scrape swallowed every `<a href>`, so a plain link to
`hotjar.com/pricing` or a `company.zendesk.com` help center fired vendor hits.

Asset evidence now comes exclusively from what the content script actually
collected: `script[src]`, preload/modulepreload links, stylesheets, and
`performance` resource entries — i.e. things the page really loaded. The CSS
pool now also draws from perf entries, which *improves* coverage of fetched
stylesheets. With that, `signals.html` had zero consumers, so the content
script **no longer ships page HTML at all** — about 500 KB less per scan
message and per cached tab, and a cleaner privacy story: WhatStack never reads
page text, period. Inline script samples are also now capped at 40 per page.

Guarded by unit tests (`dom-evidence.test.js`) and by the real-browser
`docs-next.html` fixture, which now displays a quoted CDN `src` and vendor
links and must stay clean.

### DOM patterns are now a tested contract with the probe

Collapsing the dom branch to an exact `domFlags.includes(pattern)` lookup broke
two rules whose patterns were comma-joined selector *lists* rather than the
single flag token the probe emits: Angular's `'[_ngcontent-],[_nghost-]'` lost
a weight-4 strong evidence line (Angular scored medium instead of high on pages
without `[ng-version]`), and MUI's DOM check died outright. Both patterns are
now the verbatim flag tokens.

The lesson is institutionalised in `tests/dom-flag-contract.test.js`: every
`type: 'dom'` pattern in the rule pack must exist as a flag literal in
`content-script.js`, and must round-trip through `detect()` — firing with dom
evidence, or, for weak markers on runtime-gated frameworks (`#__next`,
`[data-v-]`, `.svelte-`), being provably suppressed when alone. Drift between
the rule pack and the probe now fails loudly instead of silently never matching.

### Vue 3 production apps were undetectable

Found by the live-web smoke: vuejs.org (VitePress) detected nothing. Three
stacked causes: the `[data-v-]` probe selector matched an attribute literally
named `data-v-` (real scoped attrs are `data-v-<hash>` — an attribute-name
prefix no CSS selector can express, now a bounded element scan); Vue 3 sets no
`window.Vue` and `__VUE__` is devtools-only; and there was no probe for the one
reliable prod fingerprint — `container.__vue_app__`, set by `app.mount()`, which
also carries `.version`. The MAIN-world probe now reads it (weight-5 strong),
`[data-v-app]` (stamped on client-side mount) is a new structural check, and
`extractVersions` takes the Vue version from the app instance. Live result:
vuejs.org → `vue(high) v3.5.39`.

### Signature tightening from the audit

- `nextauth`: the `/api/auth/session` URL-shape check was weight-3 *strong* —
  enough for a high-confidence claim alone, on a route path plenty of
  hand-rolled auth also uses. Now weight-2 corroborating; the `next-auth.*`
  cookie prefix remains the strong proof.
- Removed a dead empty `if` around the LaunchDarkly probe.

### Global checks require a positive presence marker

The `global` branch accepted `typeof val === 'object'` on its own, so a probe
reporting absence as `{ present: false }` would score as a hit. Nothing emits
that shape today, but `mergeDeepSignals` merges any object straight through, so
it was one probe change away from firing. Now requires an explicit marker.

### React version no longer claims a global that isn't there

When the DevTools hook reported a registered renderer, the probe marked both
`__reactRenderer` **and** `React` with the renderer's version — so a bundled app
with no `window.React` produced evidence reading `window.React v18.3.1`. The
version now comes off `__reactRenderer` in `extractVersions`, and the synthetic
`React` mark is gone. Detection is unaffected: `__reactRenderer` is already a
weight-5 strong check on its own.

Note that React's version is only available when a renderer is registered on the
hook (React DevTools installed) or a UMD `window.React` exists. A bundled React
18 app detected through fiber keys alone exposes no version anywhere, so the row
correctly shows none.

### SPA route changes

The content script monkey-patched `history.pushState` / `replaceState`. Content
scripts run in an **isolated world**, so the patch was never visible to page
scripts — a real SPA navigation called the page's own `pushState` and the
wrapper never fired. It was dead weight that also risked conflicting with page
code. Removed.

`chrome.tabs.onUpdated` in the service worker already fires with a new URL for
history navigations and invalidates the cache, so the next popup open rescans.
The `popstate` listener does reach the isolated world and is kept.

### Unhandled promise rejection on every page

`chrome.runtime.sendMessage` returns a promise under MV3. When the service
worker is asleep or the extension context was invalidated by a reload, it
**rejects** — which a surrounding `try/catch` never sees. It surfaced as an
unhandled rejection in the page console. Now caught explicitly.

### Duplicate content-script injection

The manifest declares the content script on every page *and* `ScanOrchestrator`
re-injects it via `chrome.scripting.executeScript` when `sendMessage` finds no
receiver. On a slow page both can land, registering two `onMessage` listeners
for one `COLLECT_SIGNALS` and running the scan timers twice. Guarded with an
init flag.

### Brand icons never rendered

Every mark in `shared/brand-icons.js` was stored without an `xmlns`, and the
popup parses them with `DOMParser(svg, 'image/svg+xml')`. XML parsing puts the
root element in the **null namespace** when the document declares none, so the
result had `tagName === 'svg'` — passing the popup's guard — but was not an
`SVGElement` and never painted. Every row showed only its background colour, a
flat square. `getBrandIcon()` now adds the namespace at that boundary, and
`tests/brand-icons.test.js` guards it.

This also affected `npm run assets`, which screenshots the real popup, so the
1.7.2 listing images must be regenerated.

### Bounded tab cache

`tabCache` entries are dropped by `tabs.onRemoved`, but that event is missed
whenever the MV3 worker is asleep, so the map could only grow. Now capped at 25
with oldest-first eviction.

## Feedback loop for detection accuracy

The popup gained a **Wrong?** button. Detection quality is the whole product, and
until now there was no way for a user to tell us a call was wrong — which meant
no way to find out whether a signature is too loose or missing.

It is a link, not a request. `buildReportUrl()` composes a prefilled
`github.com/.../issues/new` URL and `chrome.tabs.create` opens it; the extension
transmits nothing, needs no new permission, and the "Local only" badge stays
literally true. The user reads the draft and presses GitHub's own submit button.

The report carries the **site origin only** — never the path or query string. A
full URL can hold a session token, an internal hostname path, or a private
document title, and a detection bug is a property of the site rather than the
route, so the precision buys nothing worth that risk. Alongside it: the reported
stack, the evidence snippet behind each hit, and the extension and Chrome
versions. The body is capped so GitHub never rejects the URL; past the cap the
table is dropped for a pointer to the JSON export.

The button is enabled when a page scans to *nothing*, since "you missed
something" is the most valuable report, and disabled only on pages that can't be
scanned at all.

`PRIVACY.md` and `store/LISTING.md` disclose this explicitly. **The published
privacy gist must be re-published to match** — the repo copy has changed.

## Dead code removed

All of this was imported-but-never-called or referenced nowhere, and some had
already drifted from the live implementation:

- `shared/detect.js` — `collectLightSignals()` and `probeDomFlags()`: a second
  copy of the content script's collector, used by nothing, already diverged
  (different truncation limits, missing probes). A trap for anyone fixing a
  collector bug in the wrong file.
- `shared/signature-matcher.js` — `matchCheck()`: never called, and had drifted
  from the live `evalCheck` (it marked script/css/meta matches as
  `runtime: true`, which changes confidence scoring).
- `shared/architecture-classifier.js` — `applyMicrofrontendClassification()`:
  duplicate of the live inline logic in `detect.js`.
- `shared/signatures.js` — `getDomProbeRules()`: zero references.

`scoreConfidence` and `calculateBadgeCount` are genuinely used and were kept.

Dropping the HTML fallback also left `evalCheck`'s `dom` branch with ~70 lines of
unreachable code: every `type: 'dom'` pattern in `signatures.js` is verbatim one
of the flag names the content script emits, so the flag-equality check at the top
of the branch already answered every case the structural table and the
per-pattern `if` blocks below it were written to handle. The branch is now a
single `domFlags.includes(pattern)` lookup, which is the actual contract. Evidence
snippets are unchanged, because equality already won every race.

## Test coverage

43 → 71 tests.

- `tests/dom-evidence.test.js` — displayed markup must never produce a hit, for
  every affected framework; genuine elements still must. 10 of these fail
  against 1.7.1.
- `tests/scenarios.test.js` — 9 real stacks (Next, Nuxt, SvelteKit, Angular,
  Vue, React, jQuery, Stripe/Sentry/GA, Module Federation) must be detected, and
  6 adversarial pages (docs site, job board, brochure site, Vite import map,
  React DevTools installed, CSS blog) must stay clean.

## Manifest

- `version` 1.7.1 → 1.7.2 (and `package.json`, which the readiness test enforces)
- `minimum_chrome_version: "102"` added — the deep scan relies on
  `chrome.scripting.executeScript({ world: 'MAIN' })`. **Verify this floor
  against your own support target before submitting.**

## Browser validation

`npm run test:browser` loads the **real unpacked extension into real Chrome**.
Playwright launches a headed persistent context on the installed `chrome`
channel (`CHROME_PATH` overrides the binary) with `--load-extension`, and drives
it against local fixture pages served over `127.0.0.1`. Nothing is stubbed: the
content script's `querySelector` calls run against real parsed HTML, the service
worker really registers, and results are read back from
`chrome.action.getBadgeText`.

The suite is built around A/B pairs — the same markup as a **real element**
versus **displayed as text** in a `<pre>`:

| Fixture | domFlags from real DOM | Detected | Badge |
|---|---|---|---|
| `real-next.html` | `script#__NEXT_DATA__, #__next, next-route-announcer` | Next.js, React | `2` |
| `docs-next.html` | *(empty)* | nothing | *(empty)* |
| `real-angular.html` | `[ng-version], ng-version:17.1.0` | Angular 17.1.0 | `1` |
| `docs-angular.html` | *(empty)* | nothing | *(empty)* |
| `real-styled.html` | `[sc-]` | styled-components | `1` |
| `docs-styled.html` | *(empty)* | nothing | *(empty)* |
| `plain.html` | *(empty)* | nothing | *(empty)* |

Run against 1.7.1, the same suite fails three cases — `docs-next.html` leaks
`nextjs, react`, `docs-angular.html` leaks `angular`, `docs-styled.html` leaks
`styled-components, emotion`. That is the shipped bug reproduced in a browser,
and the fix verified in one.

Note that on 1.7.1 `real-styled.html` reported empty `domFlags` and was detected
only by the HTML regex — it happened to be right for the wrong reason. The new
class-token probe makes that detection principled.

Three further checks cover the behaviours this release changed:

- **MAIN-world probe** — `chrome.scripting.executeScript({ world: 'MAIN' })`
  reads a page global successfully, which also functionally exercises the
  `minimum_chrome_version` floor.
- **SPA navigation** — a page-initiated `history.pushState` is reported to the
  service worker by `chrome.tabs.onUpdated` with the new URL. This is the
  assumption the removed history patch was replaced with, now confirmed rather
  than asserted.
- **Injection guard** — the content script survives being injected three times,
  still answers `COLLECT_SIGNALS` correctly, and the guard flag is asserted in
  the isolated world where the content script actually sets it. `COLLECT_SIGNALS`
  alone passes on 1.7.1 too, since `sendMessage` resolves with the first
  responder; the guard prevents duplicate listeners and doubled timers rather
  than a visible failure, so the flag assertion is what carries the check.

No extension-level errors, no service-worker console errors, no page errors
across any fixture.

## Still to do before submission

1. **Smoke-test against real websites.** Every page above is a local fixture.
   Fixtures prove the *logic* is right; they cannot prove signature coverage
   against the live web. Load unpacked and spot check a real Next.js site, an
   Angular app, a Vue/Nuxt site, a jQuery site, and a real docs page such as MDN
   or the Next.js docs.
2. **Reconsider the privacy policy URL.** It points at a
   `gist.githubusercontent.com/.../raw/` link, which serves `text/plain`.
   Reviewers generally expect a rendered page — the gist's normal HTML URL or a
   GitHub Pages link is safer.

## Known limitation, unchanged

Third-party bundles are still attributed to the host page. `content-script.js`
feeds every `performance.getEntriesByType('resource')` entry into `scripts`, so
a server-rendered site embedding a React-based support widget reports React as
the primary framework. There is no first-party/third-party origin check anywhere
in the engine.

This is a design decision, not a bug, so it was left alone — but it is the most
likely remaining source of "that's wrong" reports. Fixing it means comparing
asset origin against page origin and either downranking or separately labelling
cross-origin evidence.
