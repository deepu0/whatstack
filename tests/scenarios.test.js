import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detect } from '../shared/detect.js';
import { shapeForPopup } from '../shared/result-shape.js';

const base = {
  pass: 'deep', scripts: [], stylesheets: [], cookies: [],
  metas: [], inlineSamples: [], domFlags: [], html: '', globals: {},
};
const P = (o) => ({ ...base, ...o });

// ── Real stacks: each SHOULD detect the named tech ───────────────────
const positives = {
  'Next.js app router': [P({
    url: 'https://shop.example/',
    scripts: ['/_next/static/chunks/main-app-1f2.js', '/_next/static/css/a.css'],
    domFlags: ['#__next', 'next-route-announcer'],
    inlineSamples: ['(self.__next_f=self.__next_f||[]).push([1,"a"])'],
    globals: { __next_f: { present: true }, __reactFiber: { present: true } },
  }), ['nextjs', 'react']],

  'Nuxt 3': [P({
    url: 'https://site.example/',
    scripts: ['/_nuxt/entry.a1b2.js'],
    domFlags: ['#__nuxt'],
    globals: { __NUXT__: { present: true }, __VUE__: { present: true } },
  }), ['nuxt', 'vue']],

  'SvelteKit': [P({
    url: 'https://site.example/',
    scripts: ['/_app/immutable/entry/start.a1.js'],
    domFlags: ['[data-sveltekit-hydrate]', '.svelte-'],
  }), ['sveltekit', 'svelte']],

  'Angular 17': [P({
    url: 'https://app.example/',
    scripts: ['/main-ABCD1234.js', '/polyfills-XYZ.js'],
    domFlags: ['[ng-version]', 'ng-version:17.1.0', '[_ngcontent-]'],
    globals: { ng: { present: true } },
  }), ['angular']],

  'Vue 3 + Vite SPA': [P({
    url: 'https://app.example/',
    scripts: ['/assets/index-4f2a.js'],
    domFlags: ['[data-v-]'],
    globals: { __VUE__: { present: true } },
  }), ['vue']],

  'React SPA (CRA)': [P({
    url: 'https://app.example/',
    scripts: ['/static/js/main.8f2b.chunk.js'],
    domFlags: ['[data-reactroot]'],
    globals: { __reactRenderer: { present: true, count: 1, version: '18.2.0' } },
  }), ['react']],

  'jQuery legacy site': [P({
    url: 'https://old.example/',
    scripts: ['https://code.jquery.com/jquery-3.6.0.min.js'],
    globals: { jQuery: { present: true, version: '3.6.0' } },
  }), ['jquery']],

  'Stripe checkout + Sentry + GA': [P({
    url: 'https://shop.example/checkout',
    scripts: [
      'https://js.stripe.com/v3/',
      'https://browser.sentry-cdn.com/7.0.0/bundle.min.js',
      'https://www.googletagmanager.com/gtag/js?id=G-1',
    ],
  }), ['stripe', 'sentry', 'google-analytics']],

  'Module Federation MFE': [P({
    url: 'https://portal.example/',
    scripts: ['/remoteEntry.js', '/static/js/main.js'],
    inlineSamples: ['__webpack_require__.federation'],
    globals: { __FEDERATION__: { present: true } },
  }), ['microfrontend']],
};

// ── Adversarial: each MUST detect NOTHING of the named tech ──────────
const negatives = {
  'MDN-style docs page showing React markup as text': [P({
    url: 'https://developer.example/docs/react',
    scripts: ['/static/docs.js'],
    html: '<pre>&lt;div data-reactroot&gt;&lt;/div&gt;</pre><p>React uses __NEXT_DATA__ in Next.js</p>',
    metas: ['description=Learn React, Vue, Angular and Next.js'],
  }), ['react', 'nextjs', 'vue', 'angular']],

  'Job board listing framework names in copy': [P({
    url: 'https://jobs.example/',
    scripts: ['/static/app.js'],
    metas: ['description=React, Vue, Angular, Svelte roles'],
    html: '<body><h1>Vue.js and React.js jobs</h1></body>',
  }), ['react', 'vue', 'angular', 'svelte']],

  'Plain static HTML brochure site': [P({
    url: 'https://brochure.example/',
    scripts: ['/js/site.js', '/img/logo.png'],
    html: '<body><h1>Welcome</h1></body>',
  }), ['react', 'vue', 'angular', 'jquery', 'nextjs']],

  'Vite SPA using a native import map (NOT a microfrontend)': [P({
    url: 'https://app.example/',
    scripts: ['/assets/index.js'],
    domFlags: ['script[type="importmap"]'],
  }), ['microfrontend']],

  'React DevTools installed but page is not React': [P({
    url: 'https://plain.example/',
    scripts: ['/site.js'],
    globals: { __REACT_DEVTOOLS_GLOBAL_HOOK__: { present: true } },
  }), ['react']],

  'Page whose text mentions sc- and data-emotion classes': [P({
    url: 'https://css-blog.example/',
    scripts: ['/blog.js'],
    html: '<p>styled-components emits sc-bdVaJa; emotion uses data-emotion="css".</p>',
  }), ['styled-components', 'emotion']],
};

describe('real-world stacks are detected', () => {
  for (const [label, [signals, expected]] of Object.entries(positives)) {
    it(label, () => {
      const result = detect(signals);
      const got = new Set(result.hits.filter((h) => h.confidence !== 'low').map((h) => h.id));
      const missing = expected.filter((id) => !got.has(id));
      assert.deepEqual(missing, [], `missing ${missing.join(', ')}`);
      assert.ok(shapeForPopup(result).headline.length > 0, 'expected a non-empty headline');
    });
  }
});

describe('pages that only talk about a stack are not credited with it', () => {
  for (const [label, [signals, forbidden]] of Object.entries(negatives)) {
    it(label, () => {
      const result = detect(signals);
      const got = new Set(result.hits.map((h) => h.id));
      const leaked = forbidden.filter((id) => got.has(id));
      assert.deepEqual(
        leaked,
        [],
        `leaked ${leaked.join(', ')} — all hits: ${result.hits.map((h) => h.id).join(', ')}`,
      );
    });
  }
});
