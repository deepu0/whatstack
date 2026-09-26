/**
 * Coverage gate (CONTRIBUTING.md): every signature needs
 *   1. a positive case that fires it at medium/high, and
 *   2. a prose case — its name in page text, metadata, a data island, an image
 *      file name and a search query — that must NOT fire it.
 * A new signature without both fails this file.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SIGNATURES } from '../shared/signatures.js';
import { detect } from '../shared/detect.js';

const base = (over = {}) => ({
  url: 'https://site.example/',
  pass: 'deep',
  scripts: [],
  stylesheets: [],
  cookies: [],
  metas: [],
  inlineSamples: [],
  domFlags: [],
  globals: {},
  ...over,
});
const g = (...names) => ({ globals: Object.fromEntries(names.map((n) => [n, { present: true }])) });

/**
 * Realistic first-party evidence per rule — asset URLs as real sites ship them,
 * or the runtime object the probe reports.
 * @type {Record<string, Partial<import('../shared/detect.js').PageSignals>>}
 */
const POSITIVE = {
  nextjs: { scripts: ['https://site.example/_next/static/chunks/main-app-1f2a3b.js'] },
  react: g('__reactContainer'),
  vue: g('__vue_app__'),
  nuxt: { scripts: ['https://site.example/_nuxt/entry.abc123.js'] },
  angular: { domFlags: ['[ng-version]'] },
  svelte: g('__svelte'),
  sveltekit: { scripts: ['https://site.example/_app/immutable/entry/start.abc.js'] },
  solid: { scripts: ['https://cdn.jsdelivr.net/npm/solid-js@1.8.17/dist/solid.js'] },
  jquery: { scripts: ['https://code.jquery.com/jquery-3.7.1.min.js'] },
  remix: g('__remixContext'),
  'react-router': g('__reactRouterDataRouter'),
  redux: g('__reduxStore'),
  zustand: { scripts: ['https://esm.sh/zustand@4.5.2'] },
  pinia: g('__PINIA__'),
  mobx: g('__MOBX__'),
  vuex: { scripts: ['https://unpkg.com/vuex@4.1.0/dist/vuex.global.js'] },
  'tanstack-query': { scripts: ['https://esm.sh/@tanstack/react-query@5.56.2'] },
  'tanstack-router': { scripts: ['https://esm.sh/@tanstack/react-router@1.58.0'] },
  'tanstack-table': { scripts: ['https://esm.sh/@tanstack/react-table@8.20.5'] },
  'tanstack-form': { scripts: ['https://esm.sh/@tanstack/react-form@0.33.0'] },
  'tanstack-virtual': { scripts: ['https://esm.sh/@tanstack/react-virtual@3.10.8'] },
  'tanstack-start': g('__TANSTACK_START__'),
  tanstack: { scripts: ['https://esm.sh/@tanstack/query-core@5.56.2'] },
  swr: { scripts: ['https://esm.sh/swr@2.2.5'] },
  apollo: g('__APOLLO_CLIENT__'),
  urql: { scripts: ['https://esm.sh/urql@4.1.0'] },
  graphql: { scripts: ['https://esm.sh/graphql@16.9.0'] },
  axios: g('axios'),
  tailwind: { domFlags: ['tailwind-vars'] },
  bootstrap: { stylesheets: ['https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css'] },
  mui: { domFlags: ['[class*="MuiButton-"]'] },
  chakra: { scripts: ['https://esm.sh/@chakra-ui/react@2.8.2'] },
  'google-analytics': { scripts: ['https://www.googletagmanager.com/gtag/js?id=G-XXXX'] },
  segment: { scripts: ['https://cdn.segment.com/analytics.js/v1/abc/analytics.min.js'] },
  mixpanel: { scripts: ['https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js'] },
  hotjar: { scripts: ['https://static.hotjar.com/c/hotjar-123.js'] },
  vercel: { scripts: ['https://site.example/_vercel/insights/script.js'] },
  netlify: { domFlags: ['[data-netlify]'] },
  cloudflare: { scripts: ['https://static.cloudflareinsights.com/beacon.min.js'] },
  'module-federation': { scripts: ['https://mfe.site.example/cart/remoteEntry.js'] },
  'single-spa': g('singleSpa'),
  qiankun: g('__POWERED_BY_QIANKUN__'),
  systemjs: { domFlags: ['script[type="systemjs-importmap"]'] },
  'import-map': { domFlags: ['script[type="importmap"]'] },
  microfrontend: g('__MICRO_FRONTEND__'),
  webpack: g('__webpack_require__'),
  vite: { scripts: ['https://site.example/@vite/client'] },
  parcel: g('parcelRequire'),
  turbopack: g('__turbopack'),
  emotion: { domFlags: ['[data-emotion]'] },
  'styled-components': { domFlags: ['[data-styled]'] },
  auth0: { scripts: ['https://cdn.auth0.com/js/auth0-spa-js/2.1/auth0-spa-js.production.js'] },
  clerk: g('Clerk'),
  firebase: { scripts: ['https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'] },
  nextauth: { cookies: ['next-auth.session-token'] },
  stripe: { scripts: ['https://js.stripe.com/v3/'] },
  razorpay: { scripts: ['https://checkout.razorpay.com/v1/checkout.js'] },
  sentry: { scripts: ['https://browser.sentry-cdn.com/8.30.0/bundle.min.js'] },
  datadog: { scripts: ['https://www.datadoghq-browser-agent.com/us1/v5/datadog-rum.js'] },
  newrelic: { scripts: ['https://js-agent.newrelic.com/nr-spa-1.260.1.min.js'] },
  logrocket: { scripts: ['https://cdn.logrocket.io/LogRocket.min.js'] },
  launchdarkly: { scripts: ['https://clientstream.launchdarkly.com/eval/abc'] },
  intercom: { scripts: ['https://widget.intercom.io/widget/abc123'] },
  zendesk: { scripts: ['https://static.zdassets.com/ekr/snippet.js?key=abc'] },
  angularjs: g('angularjs'),
  astro: { domFlags: ['astro-island'] },
  gatsby: { domFlags: ['#___gatsby'] },
  qwik: { domFlags: ['[q:container]'] },
  preact: { scripts: ['https://esm.sh/preact@10.24.0'] },
  lit: { scripts: ['https://esm.sh/lit@3.2.0'] },
  polymer: g('Polymer'),
  ember: g('Ember'),
  alpine: { scripts: ['https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/cdn.min.js'] },
  htmx: { scripts: ['https://unpkg.com/htmx.org@2.0.3'] },
  wordpress: { metas: ['generator=WordPress 6.6.2'] },
  shopify: { scripts: ['https://cdn.shopify.com/s/files/1/0/t/1/assets/theme.js'] },
  webflow: { domFlags: ['html[data-wf-site]'] },
  framer: { metas: ['generator=Framer 400ebe4'] },
  posthog: { scripts: ['https://us-assets.i.posthog.com/static/array.js'] },
  plausible: { scripts: ['https://plausible.io/js/script.js'] },
  fathom: { scripts: ['https://cdn.usefathom.com/script.js'] },
  amplitude: { scripts: ['https://cdn.amplitude.com/libs/analytics-browser-2.11.1-min.js.gz'] },
};

/** Rules whose confidence is capped by design. */
const EXPECTED_LOW = new Set(['import-map']);

/** A hostile page: the technology is only TALKED about. */
function proseCase(rule) {
  const words = [rule.name, rule.id].join(' ');
  const slug = rule.id.replace(/[^a-z0-9]+/gi, '-');
  return base({
    url: `https://blog.example/posts/why-we-chose-${slug}?ref=${slug}`,
    metas: [`description=A guide to ${words}`, `og:title=${rule.name} vs everything`, `keywords=${words}`],
    inlineSamples: [
      `{"title":"Migrating to ${rule.name}","tags":["${rule.id}","${rule.name}"],"body":"We use ${words} in production."}`,
      `document.title = "${rule.name} — a ${rule.id} tutorial";`,
    ],
    scripts: [
      `https://blog.example/images/${slug}-logo.png`,
      `https://blog.example/images/posts/${slug}-vs-others.jpg`,
      `https://blog.example/api/search?q=${encodeURIComponent(words)}`,
      `https://blog.example/assets/app.js?utm_campaign=${slug}`,
    ],
  });
}

describe('signature coverage gate', () => {
  it('every signature has a positive case', () => {
    const missing = SIGNATURES.map((r) => r.id).filter((id) => !POSITIVE[id]);
    assert.deepEqual(missing, [], `add POSITIVE cases for: ${missing.join(', ')}`);
  });

  it('no stale positive cases', () => {
    const known = new Set(SIGNATURES.map((r) => r.id));
    assert.deepEqual(Object.keys(POSITIVE).filter((id) => !known.has(id)), []);
  });

  for (const rule of SIGNATURES) {
    it(`${rule.id}: fires on real evidence`, () => {
      const r = detect(base(POSITIVE[rule.id] || {}));
      const h = r.hits.find((x) => x.id === rule.id);
      assert.ok(h, `${rule.id} did not fire: ${JSON.stringify(POSITIVE[rule.id])}`);
      if (!EXPECTED_LOW.has(rule.id)) assert.notEqual(h.confidence, 'low', `${rule.id} only reached low`);
    });

    it(`${rule.id}: never fires on prose, file names or search queries`, () => {
      const r = detect(proseCase(rule));
      const h = r.hits.find((x) => x.id === rule.id);
      assert.equal(h, undefined, h && `${rule.id} fired from prose: ${JSON.stringify(h.evidence)}`);
    });
  }
});
