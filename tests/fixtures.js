/**
 * Representative page signal fixtures for shipped detect().
 */

/** @returns {import('../shared/detect.js').PageSignals} */
export function nextjsFixture() {
  return {
    url: 'https://example.com/',
    pass: 'deep',
    scripts: [
      '/_next/static/chunks/main-app.js',
      '/_next/static/css/app.css',
      'inline:#__NEXT_DATA__',
    ],
    stylesheets: ['/_next/static/css/app.css'],
    cookies: [],
    metas: [],
    inlineSamples: [],
    domFlags: ['script#__NEXT_DATA__', '#__next'],
    html: '<div id="__next"></div><script id="__NEXT_DATA__" type="application/json">{}</script>',
    globals: {
      __NEXT_DATA__: { present: true },
      // Next implies React; optional solid renderer signal
      __reactRenderer: { present: true, count: 1 },
    },
  };
}

/**
 * Job board that *talks about* Vue/React/Angular in copy — must NOT detect Vue/Angular.
 * Mirrors onlyfrontendjobs.com style noise.
 */
export function jobBoardCopyFixture() {
  return {
    url: 'https://www.onlyfrontendjobs.com/jobs',
    pass: 'deep',
    scripts: [
      'https://www.onlyfrontendjobs.com/_next/static/chunks/965f53b383dad562.js?dpl=dpl_x',
      'https://www.onlyfrontendjobs.com/_next/image?url=https%3A%2F%2Fimg.logo.dev%2Ftarget.com',
    ],
    stylesheets: ['https://www.onlyfrontendjobs.com/_next/static/css/app.css'],
    cookies: [],
    metas: [
      'description=375 hand-picked frontend developer jobs with real salaries — React, Vue, Angular & Svelte roles',
      'og:description=Hire for Vue.js and React.js jobs',
    ],
    inlineSamples: ['(self.__next_f=self.__next_f||[]).push([0,"1"])'],
    domFlags: ['#__next', 'next-route-announcer'],
    html: `<html><body>
      <div id="__next"><next-route-announcer></next-route-announcer>
      <p>Jobs: React.js, Vue.js, Angular, Svelte — apply now</p>
      <script src="/_next/static/chunks/main.js"></script>
      </div></body></html>`,
    globals: {
      __next_f: { present: true },
      next: { present: true, version: '14.2.5' },
      __reactFiber: { present: true },
    },
  };
}

/** Modern App Router: no __NEXT_DATA__, only /_next/ assets + flight */
export function nextjsAppRouterMinifiedFixture() {
  return {
    url: 'https://app.example/',
    pass: 'deep',
    scripts: [
      'https://app.example/_next/static/chunks/webpack-abc123.js',
      'https://app.example/_next/static/chunks/main-app-def456.js',
    ],
    stylesheets: ['https://app.example/_next/static/css/app.css'],
    cookies: [],
    metas: [],
    inlineSamples: ['(self.__next_f=self.__next_f||[]).push([0])'],
    domFlags: ['#__next', 'next-route-announcer'],
    html:
      '<div id="__next"><next-route-announcer></next-route-announcer></div>' +
      '<script src="/_next/static/chunks/main-app.js"></script>',
    globals: {
      __next_f: { present: true },
      webpackChunk_N_E: { present: true },
      __reactFiber: { present: true },
    },
  };
}

export function reactSpaFixture() {
  return {
    url: 'https://spa.example/',
    pass: 'deep',
    scripts: ['https://unpkg.com/react@18/umd/react.production.min.js', 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js'],
    stylesheets: [],
    cookies: [],
    metas: [],
    domFlags: ['[data-reactroot]'],
    html: '<div data-reactroot></div>',
    globals: {
      React: { present: true, version: '18.2.0' },
      ReactDOM: { present: true },
      // RDT-style: renderer registered (not merely the hook object)
      __reactRenderer: { present: true, version: '18.2.0', count: 1 },
    },
  };
}

export function vueFixture() {
  return {
    url: 'https://vue.example/',
    pass: 'deep',
    scripts: ['https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js'],
    stylesheets: [],
    cookies: [],
    metas: [],
    domFlags: ['[data-v-]'],
    html: '<div id="app" data-v-7ba5bd90>Hello</div>',
    globals: {
      Vue: { present: true, version: '3.4.0' },
      __VUE__: { present: true },
    },
  };
}

export function angularFixture() {
  return {
    url: 'https://ng.example/',
    pass: 'deep',
    scripts: ['main.abc123.js'],
    stylesheets: [],
    cookies: [],
    metas: [],
    domFlags: ['[ng-version]', 'ng-version:17.0.0', '[_ngcontent-]'],
    html: '<app-root ng-version="17.0.0"></app-root>',
    globals: {
      getAllAngularRootElements: { present: true },
      __ng_version_attr: { present: true, version: '17.0.0' },
    },
  };
}

/**
 * IRCTC-style Angular app where React DevTools extension injects the hook
 * but no React renderer is registered — must NOT report React.
 */
export function angularWithEmptyReactDevtoolsHookFixture() {
  return {
    url: 'https://www.irctc.co.in/eticket/train-search',
    pass: 'deep',
    scripts: [
      'https://www.irctc.co.in/eticket/main.js',
      'https://www.irctc.co.in/eticket/polyfills.js',
    ],
    stylesheets: [],
    cookies: [],
    metas: [],
    inlineSamples: [],
    domFlags: ['[ng-version]', 'ng-version:15.2.0', '[_ngcontent-]'],
    html: '<app-root ng-version="15.2.0" class="ng-tns-c0-0"></app-root>',
    globals: {
      // Hook present (extension) but empty renderers — NOT React
      __REACT_DEVTOOLS_GLOBAL_HOOK__: { present: true },
      getAllAngularRootElements: { present: true },
      __ng_version_attr: { present: true, version: '15.2.0' },
      ng: { present: true },
    },
  };
}

export function svelteKitFixture() {
  return {
    url: 'https://svelte.example/',
    pass: 'deep',
    scripts: ['/_app/immutable/entry/start.js'],
    stylesheets: [],
    cookies: [],
    metas: [],
    domFlags: ['[data-sveltekit-hydrate]', '.svelte-'],
    html: '<div data-sveltekit-hydrate="abc" class="svelte-1abc">x</div>',
    globals: {
      __sveltekit: { present: true },
      __svelte: { present: true },
    },
  };
}

export function jqueryFixture() {
  return {
    url: 'https://legacy.example/',
    pass: 'deep',
    scripts: ['https://code.jquery.com/jquery-3.7.1.min.js'],
    stylesheets: [],
    cookies: [],
    metas: [],
    domFlags: [],
    html: '<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>',
    globals: {
      jQuery: { present: true, version: '3.7.1' },
      $: { present: true, version: '3.7.1' },
    },
  };
}

/** Multi-category: Next + Redux + Tailwind + GA + Vercel */
export function fullStackFixture() {
  return {
    url: 'https://app.vercel.app/',
    pass: 'deep',
    scripts: [
      '/_next/static/chunks/webpack.js',
      'inline:#__NEXT_DATA__',
      'https://www.googletagmanager.com/gtag/js?id=G-XXX',
      'https://va.vercel-scripts.com/v1/script.js',
      'https://cdn.example/redux.min.js',
    ],
    stylesheets: ['/styles/tailwind.css'],
    cookies: ['_ga', '__vercel_toolbar'],
    metas: ['generator=Next.js'],
    domFlags: ['script#__NEXT_DATA__', '#__next', 'tailwind-utilities'],
    html: '<div id="__next" class="flex items-center justify-between bg-slate-900"></div><script id="__NEXT_DATA__"></script>',
    globals: {
      __NEXT_DATA__: { present: true },
      __REACT_DEVTOOLS_GLOBAL_HOOK__: { present: true },
      __REDUX_DEVTOOLS_EXTENSION__: { present: true },
      gtag: { present: true },
    },
  };
}

export function analyticsOnlyFixture() {
  return {
    url: 'https://marketing.example/',
    pass: 'light',
    scripts: [
      'https://cdn.segment.com/analytics.js/v1/abc/analytics.min.js',
      'https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js',
    ],
    stylesheets: [],
    cookies: [],
    metas: [],
    domFlags: [],
    html: '',
    globals: {
      mixpanel: { present: true },
    },
  };
}

export function bootstrapUiFixture() {
  return {
    url: 'https://bs.example/',
    pass: 'deep',
    scripts: ['https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'],
    stylesheets: ['https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css'],
    cookies: [],
    metas: [],
    domFlags: ['.btn-primary'],
    html: '<button class="btn btn-primary">Go</button>',
    globals: { bootstrap: { present: true } },
  };
}

/** Webpack Module Federation shell */
export function moduleFederationFixture() {
  return {
    url: 'https://shell.example/',
    pass: 'deep',
    scripts: [
      'https://shell.example/remoteEntry.js',
      'https://cdn.example/mfe-cart/remoteEntry.js',
      'https://shell.example/main.js',
    ],
    stylesheets: [],
    cookies: [],
    metas: [],
    inlineSamples: [],
    domFlags: [],
    html: '<div id="root"></div><script src="/remoteEntry.js"></script>',
    globals: {
      __FEDERATION__: { present: true },
      __reactRenderer: { present: true, count: 1 },
    },
  };
}

/** single-spa root config */
export function singleSpaFixture() {
  return {
    url: 'https://spa-root.example/',
    pass: 'deep',
    scripts: ['https://cdn.jsdelivr.net/npm/single-spa@5.9.0/lib/system/single-spa.min.js'],
    stylesheets: [],
    cookies: [],
    metas: [],
    inlineSamples: [],
    domFlags: ['[data-single-spa]'],
    html: '<div id="single-spa-application:app" data-single-spa></div>',
    globals: {
      singleSpa: { present: true },
      singleSpaNavigate: { present: true },
    },
  };
}

/** Solid multi-category stack: Next + webpack + Sentry + Stripe */
export function richStackFixture() {
  return {
    url: 'https://app.example/checkout',
    pass: 'deep',
    scripts: [
      '/_next/static/chunks/main.js',
      'https://browser.sentry-cdn.com/7.0.0/bundle.min.js',
      'https://js.stripe.com/v3/',
      'https://cdn.auth0.com/js/auth0-spa-js/2.0/auth0-spa-js.production.js',
    ],
    stylesheets: [],
    cookies: [],
    metas: ['generator=Next.js'],
    inlineSamples: ['__webpack_require__.r=function'],
    domFlags: ['script#__NEXT_DATA__', '#__next', '[data-emotion]'],
    html:
      '<div id="__next" data-emotion="css-abc"></div><script id="__NEXT_DATA__"></script>',
    globals: {
      __NEXT_DATA__: { present: true },
      __webpack_require__: { present: true },
      webpackChunk: { present: true },
      Sentry: { present: true },
      Stripe: { present: true },
      auth0: { present: true },
      __reactRenderer: { present: true, count: 1 },
    },
  };
}

/** New Relic browser agent (NREUM snippet + agent CDN + beacon) */
export function newRelicFixture() {
  return {
    url: 'https://shop.example/',
    pass: 'deep',
    scripts: [
      'https://js-agent.newrelic.com/nr-spa-1.250.0.min.js',
      'https://bam.nr-data.net/1/abc123?a=1',
      'https://shop.example/static/app.js',
    ],
    stylesheets: [],
    cookies: [],
    metas: [],
    inlineSamples: [
      'window.NREUM||(NREUM={});NREUM.info={"beacon":"bam.nr-data.net","licenseKey":"a44ba31e2d","applicationID":"87109248","agent":"js-agent.newrelic.com/nr-1071.min.js"}',
    ],
    domFlags: [],
    html: '<html><head></head><body><div id="app"></div></body></html>',
    globals: {
      NREUM: {
        present: true,
        // shape mirrors real agent; probe marks NREUM when present in fixtures via global check
      },
      newrelic: { present: true },
      __nr_require: { present: true },
    },
  };
}

/** Marketing page that only *mentions* tools in copy — must stay clean */
export function toolNamesInCopyOnlyFixture() {
  return {
    url: 'https://blog.example/tools',
    pass: 'deep',
    scripts: ['https://blog.example/static/app.js'],
    stylesheets: [],
    cookies: [],
    metas: [
      'description=We use Sentry Stripe Auth0 Webpack Vite New Relic and LaunchDarkly at our company',
    ],
    inlineSamples: [],
    domFlags: [],
    html: '<article><p>Sentry Stripe Auth0 Webpack Vite New Relic LaunchDarkly Intercom</p></article>',
    globals: {},
  };
}

/** Plain Angular monolith — no MFE */
export function noMicrofrontendFixture() {
  return {
    url: 'https://www.irctc.co.in/eticket/train-search',
    pass: 'deep',
    scripts: ['https://www.irctc.co.in/eticket/main.js'],
    stylesheets: [],
    cookies: [],
    metas: [],
    inlineSamples: [],
    domFlags: ['[ng-version]', 'ng-version:15.2.0'],
    html: '<app-root ng-version="15.2.0"></app-root>',
    globals: {
      getAllAngularRootElements: { present: true },
      __ng_version_attr: { present: true, version: '15.2.0' },
    },
  };
}
