/**
 * WhatStack detection core — pure functions, no Chrome APIs.
 *
 * Rules of the engine:
 * 1. Script/CSS checks match ASSET URLs only — never page prose ("Vue.js jobs").
 * 2. Frameworks need runtime or asset proof when requiresRuntime is set.
 * 3. Meta-frameworks (Next/Nuxt/SvelteKit) suppress competitor frameworks unless
 *    those competitors have independent runtime evidence.
 * 4. Versions come from globals, CDN URLs, and structured markers only.
 */

import {
  SIGNATURES,
  CATEGORY_ORDER,
  META_FRAMEWORKS,
  MFE_PLATFORM_IDS,
} from './signatures.js';

/**
 * @typedef {object} PageSignals
 * @property {string} [url]
 * @property {string} [html]
 * @property {string[]} [scripts]
 * @property {string[]} [stylesheets]
 * @property {string[]} [cookies]
 * @property {string[]} [metas]
 * @property {string[]} [inlineSamples]
 * @property {Record<string, unknown>} [globals]
 * @property {string[]} [domFlags]
 * @property {Record<string, string>} [versions]
 * @property {'light'|'deep'} [pass]
 */

/**
 * @typedef {object} Evidence
 * @property {'global'|'dom'|'script'|'cookie'|'css'|'meta'|'inline'} type
 * @property {string} snippet
 * @property {number} weight
 * @property {boolean} [runtime]
 * @property {boolean} [strong]
 */

/**
 * @typedef {object} Hit
 * @property {string} id
 * @property {string} name
 * @property {string} category
 * @property {'high'|'medium'|'low'} confidence
 * @property {string} [version]
 * @property {Evidence[]} evidence
 * @property {string[]} [related]
 */

/**
 * @typedef {object} ScanResult
 * @property {string} [url]
 * @property {number} [scannedAt]
 * @property {'light'|'deep'} pass
 * @property {Hit[]} hits
 * @property {{ id: string, name: string } | null} primary
 */

/** @param {string[]} arr */
function dedupeStrings(arr) {
  return [...new Set(arr.filter(Boolean))];
}

/**
 * @param {Document} doc
 * @param {string} [href]
 * @returns {PageSignals}
 */
export function collectLightSignals(doc, href = '') {
  const scripts = [];
  const inlineSamples = [];

  doc.querySelectorAll('script[src]').forEach((el) => {
    const src = el.getAttribute('src');
    if (src) scripts.push(src);
  });

  doc.querySelectorAll('link[href]').forEach((el) => {
    const rel = (el.getAttribute('rel') || '').toLowerCase();
    const as = (el.getAttribute('as') || '').toLowerCase();
    const hrefAttr = el.getAttribute('href');
    if (!hrefAttr) return;
    if (rel.includes('modulepreload') || rel === 'preload' || rel === 'prefetch') {
      scripts.push(hrefAttr);
    }
    if (as === 'script' || as === 'style') scripts.push(hrefAttr);
  });

  doc.querySelectorAll('script').forEach((el) => {
    const id = el.getAttribute('id');
    if (id) scripts.push(`inline:#${id}`);
    if (!el.getAttribute('src')) {
      const text = (el.textContent || '').slice(0, 12_000);
      if (text.trim()) inlineSamples.push(text);
    }
  });

  try {
    const perf =
      typeof performance !== 'undefined' && performance.getEntriesByType
        ? performance.getEntriesByType('resource')
        : [];
    for (const entry of perf) {
      if (entry && entry.name) scripts.push(String(entry.name));
    }
  } catch {
    /* ignore */
  }

  const stylesheets = [];
  doc.querySelectorAll('link[rel="stylesheet"][href]').forEach((el) => {
    const hrefAttr = el.getAttribute('href');
    if (hrefAttr) stylesheets.push(hrefAttr);
  });

  const metas = [];
  doc.querySelectorAll('meta[name], meta[property]').forEach((el) => {
    const name = el.getAttribute('name') || el.getAttribute('property') || '';
    const content = el.getAttribute('content') || '';
    if (name) metas.push(`${name}=${content}`);
  });

  const cookies = [];
  try {
    const raw = typeof doc.cookie === 'string' ? doc.cookie : '';
    raw.split(';').forEach((part) => {
      const name = part.trim().split('=')[0];
      if (name) cookies.push(name);
    });
  } catch {
    /* ignore */
  }

  // Keep HTML for attribute extraction + structural markers only (not prose matching)
  const html = doc.documentElement ? doc.documentElement.outerHTML.slice(0, 400_000) : '';

  return {
    url: href || (typeof doc.location !== 'undefined' ? String(doc.location.href || '') : ''),
    html,
    scripts: dedupeStrings(scripts),
    stylesheets: dedupeStrings(stylesheets),
    cookies,
    metas,
    inlineSamples,
    domFlags: probeDomFlags(doc),
    globals: {},
    pass: 'light',
  };
}

/**
 * @param {Document} doc
 * @returns {string[]}
 */
export function probeDomFlags(doc) {
  const flags = [];
  const checks = [
    ['script#__NEXT_DATA__', 'script#__NEXT_DATA__'],
    ['#__next', '#__next'],
    ['next-route-announcer', 'next-route-announcer'],
    ['[data-nextjs-scroll-focus-boundary]', '[data-nextjs-scroll-focus-boundary]'],
    ['[data-next-page]', '[data-next-page]'],
    ['[data-reactroot]', '[data-reactroot]'],
    ['[data-reactid]', '[data-reactid]'],
    ['[ng-version]', '[ng-version]'],
    ['[class*="_ngcontent-"],[class*="_nghost-"]', '[_ngcontent-]'],
    ['#__nuxt', '#__nuxt'],
    ['[data-sveltekit-hydrate]', '[data-sveltekit-hydrate]'],
    ['[data-v-]', '[data-v-]'],
    ['[class*="svelte-"]', '.svelte-'],
    ['[class*="MuiButton-"],[class*="MuiBox-"]', '[class*="MuiButton-"]'],
    ['[data-netlify]', '[data-netlify]'],
    ['.btn-primary, .modal-dialog, .container-fluid', '.btn-primary'],
    ['[data-single-spa]', '[data-single-spa]'],
    ['script[type="systemjs-importmap"]', 'script[type="systemjs-importmap"]'],
    ['script[type="importmap"]', 'script[type="importmap"]'],
    ['[data-emotion]', '[data-emotion]'],
    ['[data-styled]', '[data-styled]'],
  ];

  for (const [selector, flag] of checks) {
    try {
      if (doc.querySelector(selector)) flags.push(flag);
    } catch {
      /* ignore */
    }
  }

  try {
    const ng = doc.querySelector('[ng-version]');
    if (ng) {
      const v = ng.getAttribute('ng-version');
      if (v) flags.push(`ng-version:${v}`);
    }
  } catch {
    /* ignore */
  }

  // Tailwind: require multiple utility classes across elements (still low-weight)
  try {
    const all = doc.querySelectorAll('[class]');
    const utilRe =
      /\b(?:flex|grid|items-center|justify-between|bg-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}|text-(?:xs|sm|base|lg|xl)|p-\d|px-\d|py-\d|m-\d|rounded(?:-\w+)?|shadow(?:-\w+)?)\b/;
    let hits = 0;
    const limit = Math.min(all.length, 100);
    for (let i = 0; i < limit; i++) {
      if (utilRe.test(all[i].getAttribute('class') || '')) hits++;
    }
    if (hits >= 12) flags.push('tailwind-utilities');
  } catch {
    /* ignore */
  }

  return flags;
}

/**
 * MAIN-world probe — serialized into the page via chrome.scripting.
 */
export function mainWorldProbeSource() {
  return function probeMainWorld() {
    const g = typeof globalThis !== 'undefined' ? globalThis : window;
    /** @type {Record<string, unknown>} */
    const present = {};

    const mark = (name, extra) => {
      present[name] = extra && typeof extra === 'object' ? { present: true, ...extra } : { present: true };
    };

    const tryGet = (name) => {
      try {
        return g[name];
      } catch {
        return undefined;
      }
    };

    // jQuery
    const jq = tryGet('jQuery');
    if (typeof jq === 'function' && jq.fn && jq.fn.jquery) {
      mark('jQuery', { version: String(jq.fn.jquery) });
      mark('$', { version: String(jq.fn.jquery) });
    }

    // ── React (aligned with React DevTools) ──────────────────────────
    // The RDT extension injects window.__REACT_DEVTOOLS_GLOBAL_HOOK__ on
    // EVERY page. That alone is NOT React. React registers itself via
    // hook.inject(renderer) → hook.renderers becomes non-empty.
    // Ref: React DevTools backend — Components tab only activates with renderers.
    (function detectReactLikeDevTools() {
      let rendererCount = 0;
      let reactVersion = null;
      const hook = tryGet('__REACT_DEVTOOLS_GLOBAL_HOOK__');
      if (hook && hook.renderers) {
        try {
          const renderers = hook.renderers;
          if (typeof renderers.size === 'number') {
            rendererCount = renderers.size;
            if (typeof renderers.forEach === 'function') {
              renderers.forEach(function (r) {
                if (r && r.version) reactVersion = String(r.version);
              });
            } else if (typeof renderers.values === 'function') {
              for (const r of renderers.values()) {
                if (r && r.version) reactVersion = String(r.version);
              }
            }
          } else if (typeof renderers.forEach === 'function') {
            renderers.forEach(function (r) {
              rendererCount += 1;
              if (r && r.version) reactVersion = String(r.version);
            });
          } else if (typeof renderers === 'object') {
            rendererCount = Object.keys(renderers).length;
            for (const k of Object.keys(renderers)) {
              const r = renderers[k];
              if (r && r.version) reactVersion = String(r.version);
            }
          }
        } catch {
          /* ignore */
        }
        // Fiber roots (when RDT exposes them)
        try {
          if (rendererCount === 0 && typeof hook.getFiberRoots === 'function' && hook.renderers) {
            const ids =
              typeof hook.renderers.keys === 'function'
                ? Array.from(hook.renderers.keys())
                : Object.keys(hook.renderers || {});
            for (const id of ids) {
              const roots = hook.getFiberRoots(id);
              if (roots && (roots.size > 0 || (typeof roots === 'object' && Object.keys(roots).length))) {
                rendererCount = Math.max(rendererCount, 1);
              }
            }
          }
        } catch {
          /* ignore */
        }
      }

      if (rendererCount > 0) {
        mark(
          '__reactRenderer',
          reactVersion
            ? { version: reactVersion, count: rendererCount }
            : { count: rendererCount },
        );
        if (reactVersion) mark('React', { version: reactVersion });
      }

      // UMD globals — only if they look like real React (createElement / version)
      const React = tryGet('React');
      if (
        React &&
        (typeof React === 'object' || typeof React === 'function') &&
        (React.version || typeof React.createElement === 'function')
      ) {
        mark('React', React.version ? { version: String(React.version) } : undefined);
      }
      const ReactDOM = tryGet('ReactDOM');
      if (
        ReactDOM &&
        (typeof ReactDOM.render === 'function' ||
          typeof ReactDOM.createRoot === 'function' ||
          typeof ReactDOM.hydrate === 'function' ||
          typeof ReactDOM.hydrateRoot === 'function' ||
          ReactDOM.version)
      ) {
        mark('ReactDOM', ReactDOM.version ? { version: String(ReactDOM.version) } : undefined);
      }

      // Host-instance fiber keys (React 16+) — verify value looks fiber-like
      try {
        const roots = [
          document.querySelector('#__next'),
          document.querySelector('#root'),
          document.querySelector('#app'),
          document.querySelector('[data-reactroot]'),
          document.querySelector('[data-reactroot]'),
        ].filter(Boolean);
        // Prefer specific roots; only fall back to a shallow body child scan
        if (!roots.length && document.body) {
          const kids = document.body.children;
          const limit = Math.min(kids.length, 12);
          for (let i = 0; i < limit; i++) roots.push(kids[i]);
        }
        const fiberKey = /^__reactFiber/;
        const containerKey = /^__reactContainer/;
        const legacyKey = /^__reactInternalInstance/;
        for (const el of roots) {
          if (!el) continue;
          const keys = Object.keys(el);
          for (const k of keys) {
            if (fiberKey.test(k) || legacyKey.test(k)) {
              try {
                const fiber = el[k];
                // Fiber nodes have tag (number) and return/child/sibling or elementType/type
                if (
                  fiber &&
                  typeof fiber === 'object' &&
                  (typeof fiber.tag === 'number' ||
                    fiber.elementType !== undefined ||
                    fiber.type !== undefined ||
                    fiber.memoizedState !== undefined ||
                    fiber.memoizedProps !== undefined)
                ) {
                  mark('__reactFiber');
                  break;
                }
              } catch {
                /* ignore */
              }
            }
            if (containerKey.test(k)) {
              try {
                const c = el[k];
                if (c && typeof c === 'object') {
                  mark('__reactContainer');
                  break;
                }
              } catch {
                /* ignore */
              }
            }
          }
          if (present.__reactFiber || present.__reactContainer) break;
        }
      } catch {
        /* ignore */
      }
    })();

    // Next.js
    const nextData = tryGet('__NEXT_DATA__');
    if (nextData && typeof nextData === 'object') {
      const ver = nextData.version || (nextData.runtimeConfig && nextData.runtimeConfig.version);
      mark('__NEXT_DATA__', ver ? { version: String(ver) } : undefined);
    }
    if (tryGet('__next_f') !== undefined) mark('__next_f');
    if (tryGet('webpackChunk_N_E') !== undefined) mark('webpackChunk_N_E');
    const next = tryGet('next');
    if (next !== undefined && next !== null) {
      const ver = next && typeof next === 'object' && next.version ? String(next.version) : undefined;
      mark('next', ver ? { version: ver } : undefined);
    }

    // Vue
    const Vue = tryGet('Vue');
    if (Vue && (typeof Vue === 'object' || typeof Vue === 'function')) {
      // Guard: plain objects named Vue in ads shouldn't look like the library
      const looksLikeVue =
        Vue.version ||
        typeof Vue.createApp === 'function' ||
        typeof Vue.component === 'function' ||
        typeof Vue.use === 'function';
      if (looksLikeVue) mark('Vue', Vue.version ? { version: String(Vue.version) } : undefined);
    }
    if (tryGet('__VUE__') !== undefined) mark('__VUE__');
    if (tryGet('__NUXT__') !== undefined) mark('__NUXT__');

    // Angular
    if (typeof tryGet('getAllAngularRootElements') === 'function') {
      mark('getAllAngularRootElements');
    }
    const ng = tryGet('ng');
    if (ng && typeof ng === 'object') mark('ng');

    // Svelte
    if (tryGet('__svelte') !== undefined) mark('__svelte');
    if (tryGet('__sveltekit') !== undefined) mark('__sveltekit');

    // Microfrontends / composition
    if (tryGet('__FEDERATION__') !== undefined && tryGet('__FEDERATION__') !== null) {
      mark('__FEDERATION__');
    }
    if (tryGet('__FEDERATION_DEVTOOLS__') !== undefined) mark('__FEDERATION_DEVTOOLS__');
    if (tryGet('__VMOK__') !== undefined) mark('__VMOK__');
    if (tryGet('__POWERED_BY_QIANKUN__')) mark('__POWERED_BY_QIANKUN__');
    if (tryGet('__INJECTED_PUBLIC_PATH_BY_QIANKUN__') !== undefined) {
      mark('__INJECTED_PUBLIC_PATH_BY_QIANKUN__');
    }
    if (tryGet('__MICRO_FRONTEND__') !== undefined) mark('__MICRO_FRONTEND__');
    if (tryGet('__MICROFRONTEND__') !== undefined) mark('__MICROFRONTEND__');

    const singleSpa = tryGet('singleSpa');
    if (
      singleSpa &&
      typeof singleSpa === 'object' &&
      (typeof singleSpa.registerApplication === 'function' ||
        typeof singleSpa.start === 'function' ||
        typeof singleSpa.getAppNames === 'function')
    ) {
      mark('singleSpa');
    }
    if (typeof tryGet('singleSpaNavigate') === 'function') mark('singleSpaNavigate');

    // SystemJS — only if it looks like the loader (not random System object)
    const System = tryGet('System');
    if (
      System &&
      typeof System === 'object' &&
      (typeof System.import === 'function' || typeof System.register === 'function')
    ) {
      mark('System');
    }

    // Build tools
    if (typeof tryGet('__webpack_require__') === 'function' || tryGet('__webpack_require__')) {
      mark('__webpack_require__');
    }
    try {
      const keys = Object.keys(g);
      if (keys.some((k) => k === 'webpackChunk' || k.startsWith('webpackChunk'))) {
        mark('webpackChunk');
      }
    } catch {
      /* ignore */
    }
    if (tryGet('parcelRequire')) mark('parcelRequire');
    if (tryGet('__turbopack') !== undefined) mark('__turbopack');
    if (tryGet('__vite_plugin_react_preamble_installed__')) {
      mark('__vite_plugin_react_preamble_installed__');
    }

    // Observability / payments / auth — only real SDKs
    const Sentry = tryGet('Sentry');
    if (
      Sentry &&
      typeof Sentry === 'object' &&
      (typeof Sentry.init === 'function' ||
        typeof Sentry.captureException === 'function' ||
        typeof Sentry.SDK_VERSION === 'string')
    ) {
      mark('Sentry', Sentry.SDK_VERSION ? { version: String(Sentry.SDK_VERSION) } : undefined);
    }
    if (tryGet('__SENTRY__')) mark('__SENTRY__');
    if (tryGet('DD_RUM')) mark('DD_RUM');
    if (tryGet('DD_LOGS')) mark('DD_LOGS');
    // New Relic Browser agent
    // Docs: NREUM config + js-agent.newrelic.com loader; beacons → bam.nr-data.net
    const NREUM = tryGet('NREUM');
    if (NREUM && typeof NREUM === 'object') {
      const info = NREUM.info || {};
      // Require real agent config — empty NREUM={} is not enough
      const hasAgent = !!(
        info.licenseKey ||
        info.applicationID ||
        info.beacon ||
        info.errorBeacon ||
        info.agent ||
        NREUM.init ||
        NREUM.loader_config
      );
      if (hasAgent) {
        mark('NREUM', info.applicationID ? { applicationID: String(info.applicationID) } : undefined);
      }
    }
    const newrelic = tryGet('newrelic');
    if (
      newrelic &&
      typeof newrelic === 'object' &&
      (typeof newrelic.noticeError === 'function' ||
        typeof newrelic.setCustomAttribute === 'function' ||
        typeof newrelic.addPageAction === 'function' ||
        typeof newrelic.setPageViewName === 'function' ||
        typeof newrelic.interaction === 'function')
    ) {
      mark('newrelic');
    }
    if (typeof tryGet('__nr_require') === 'function') mark('__nr_require');
    if (tryGet('LogRocket')) mark('LogRocket');

    const Stripe = tryGet('Stripe');
    if (typeof Stripe === 'function') mark('Stripe');
    if (typeof tryGet('Razorpay') === 'function') mark('Razorpay');

    const Clerk = tryGet('Clerk');
    if (Clerk && typeof Clerk === 'object') mark('Clerk');
    const auth0 = tryGet('auth0');
    if (auth0 && (typeof auth0 === 'object' || typeof auth0 === 'function')) mark('auth0');
    const firebase = tryGet('firebase');
    if (firebase && typeof firebase === 'object' && (firebase.apps || firebase.initializeApp)) {
      mark('firebase');
    }

    if (typeof tryGet('Intercom') === 'function') mark('Intercom');
    if (tryGet('intercomSettings')) mark('intercomSettings');
    if (typeof tryGet('zE') === 'function') mark('zE');
    if (tryGet('LDClient') || (tryGet('LDClient') === undefined && tryGet('launchDarkly'))) {
      /* LD often on window as LDClient after init */
    }
    try {
      if (g.LDClient) mark('LDClient');
    } catch {
      /* ignore */
    }

    // Redux: extension injects __REDUX_DEVTOOLS_EXTENSION__ on every page.
    // Only mark when a store is actually connected or library APIs exist.
    try {
      const rde = tryGet('__REDUX_DEVTOOLS_EXTENSION__');
      if (rde && typeof rde === 'function') {
        // Connected apps often expose lastAction / stores via extension internals;
        // also accept explicit store on window used by some apps.
      }
      const store =
        tryGet('__REDUX_STORE__') ||
        tryGet('store') ||
        tryGet('__store__');
      if (
        store &&
        typeof store === 'object' &&
        typeof store.dispatch === 'function' &&
        typeof store.getState === 'function'
      ) {
        mark('__reduxStore');
      }
    } catch {
      /* ignore */
    }

    // State / data / analytics
    for (const name of [
      '__PINIA__',
      '__MOBX__',
      '__APOLLO_CLIENT__',
      'axios',
      'gtag',
      'mixpanel',
      'bootstrap',
      'ReactQuery',
    ]) {
      if (tryGet(name) !== undefined && tryGet(name) !== null) mark(name);
    }

    try {
      const el = document.querySelector('[ng-version]');
      if (el) mark('__ng_version_attr', { version: el.getAttribute('ng-version') || undefined });
    } catch {
      /* ignore */
    }

    return present;
  };
}

function textMatches(pattern, text) {
  if (pattern instanceof RegExp) return pattern.test(text);
  return text.includes(String(pattern));
}

/**
 * Real asset URL/path — not prose.
 * @param {string} s
 */
export function isAssetLike(s) {
  if (!s || typeof s !== 'string') return false;
  const t = s.trim();
  if (!t || t.length > 2500) return false;
  if (t.startsWith('inline:#')) return true;
  if (/^(https?:)?\/\//i.test(t)) return true;
  if (t.startsWith('/') || t.startsWith('./') || t.startsWith('../')) return true;
  if (/\/_next\/|\/_nuxt\/|\/_app\//i.test(t)) return true;
  if (/\.(?:js|mjs|cjs|css|map)(?:\?|#|$)/i.test(t)) return true;
  if (/(?:unpkg\.com|jsdelivr\.net|cdnjs\.|esm\.sh|skypack\.dev|jspm\.dev|code\.jquery\.com)/i.test(t)) {
    return true;
  }
  if (/(?:^|\/)(?:node_modules|static|chunks|assets)\//i.test(t)) return true;
  return false;
}

/**
 * @param {string} html
 * @returns {string[]}
 */
export function extractAttrAssets(html) {
  if (!html) return [];
  const out = [];
  const re = /\b(?:src|href)=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

/**
 * @param {PageSignals} signals
 */
export function assetCandidates(signals) {
  const fromSignals = (signals.scripts || []).filter(isAssetLike);
  const fromHtml = extractAttrAssets(signals.html || '').filter(isAssetLike);
  const fromCss = (signals.stylesheets || []).filter(isAssetLike);
  return [...new Set([...fromSignals, ...fromHtml, ...fromCss])];
}

function clip(s, n = 120) {
  const t = String(s || '');
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function matchSnippet(text, pattern) {
  if (pattern instanceof RegExp) {
    const m = text.match(pattern);
    return m ? m[0] : String(pattern);
  }
  const i = text.indexOf(String(pattern));
  if (i >= 0) return text.slice(Math.max(0, i - 20), i + String(pattern).length + 20);
  return String(pattern);
}

function normalizeVersion(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  const m = s.match(/\d+\.\d+(?:\.\d+)?(?:[-+][a-z0-9.]+)?/i);
  return m ? m[0] : null;
}

/**
 * @param {PageSignals} signals
 * @returns {Record<string, string>}
 */
export function extractVersions(signals) {
  /** @type {Record<string, string>} */
  const versions = { ...(signals.versions || {}) };
  const g = signals.globals || {};

  const take = (id, v) => {
    if (versions[id]) return;
    const n = normalizeVersion(v);
    if (n) versions[id] = n;
  };

  if (g.jQuery && g.jQuery.version) take('jquery', g.jQuery.version);
  else if (g.$ && g.$.version) take('jquery', g.$.version);
  if (g.React && g.React.version) take('react', g.React.version);
  if (g.ReactDOM && g.ReactDOM.version) take('react', g.ReactDOM.version);
  if (g.Vue && g.Vue.version) take('vue', g.Vue.version);
  if (g.next && g.next.version) take('nextjs', g.next.version);
  if (g.__NEXT_DATA__ && g.__NEXT_DATA__.version) take('nextjs', g.__NEXT_DATA__.version);
  if (g.__ng_version_attr && g.__ng_version_attr.version) take('angular', g.__ng_version_attr.version);

  const ngFlag = (signals.domFlags || []).find((d) => d.startsWith('ng-version:'));
  if (ngFlag) take('angular', ngFlag.slice('ng-version:'.length));

  const urls = assetCandidates(signals);
  const pairRules = [
    ['react', /(?:^|[\/@])react(?:-dom)?@([\d.]+)/i],
    ['react', /react(?:-dom)?(?:\.production|\.development)?(?:\.min)?\.js/i], // no version
    ['react', /react(?:-dom)?[_-]([\d.]+)(?:\.min)?\.js/i],
    ['vue', /(?:^|[\/@])vue@([\d.]+)/i],
    ['jquery', /jquery[_-]([\d.]+)(?:\.min)?\.js/i],
    ['angular', /@angular\/core@([\d.]+)/i],
    ['nextjs', /(?:^|[\/@])next@([\d.]+)/i],
    ['svelte', /(?:^|[\/@])svelte@([\d.]+)/i],
    ['bootstrap', /bootstrap[@\/_-]([\d.]+)/i],
    ['redux', /(?:^|[\/@])redux@([\d.]+)/i],
  ];
  for (const url of urls) {
    for (const [id, re] of pairRules) {
      const m = url.match(re);
      if (m && m[1]) take(id, m[1]);
    }
  }

  // unpkg / jsdelivr: /react@18.2.0/ or /vue@3.4.0/
  for (const url of urls) {
    const m = url.match(/\/(react(?:-dom)?|vue|next|svelte|jquery|axios|redux|zustand)@([\d.]+)/i);
    if (m) {
      const map = {
        react: 'react',
        'react-dom': 'react',
        vue: 'vue',
        next: 'nextjs',
        svelte: 'svelte',
        jquery: 'jquery',
        axios: 'axios',
        redux: 'redux',
        zustand: 'zustand',
      };
      const id = map[m[1].toLowerCase()];
      if (id) take(id, m[2]);
    }
  }

  for (const sample of signals.inlineSamples || []) {
    const nextV = sample.match(/["']next["']\s*:\s*["']([\d.]+)["']/i);
    if (nextV) take('nextjs', nextV[1]);
    const reactV = sample.match(/React\.version\s*=\s*["']([\d.]+)["']/);
    if (reactV) take('react', reactV[1]);
  }

  return versions;
}

/**
 * @param {PageSignals} signals
 * @param {import('./signatures.js').SignatureRule} rule
 * @param {import('./signatures.js').SignatureCheck} check
 * @returns {Evidence|null}
 */
function evalCheck(signals, rule, check) {
  const { type, pattern, weight, strong, runtime } = check;
  const cookies = signals.cookies || [];
  const metas = signals.metas || [];
  const domFlags = signals.domFlags || [];
  const globals = signals.globals || {};
  const html = signals.html || '';
  const inlineSamples = signals.inlineSamples || [];
  const stylesheets = signals.stylesheets || [];

  const pack = (snippet) => ({
    type,
    snippet: clip(snippet),
    weight,
    strong: !!strong,
    runtime: !!runtime,
  });

  if (type === 'script') {
    for (const s of assetCandidates(signals)) {
      if (textMatches(pattern, s)) return pack(s);
    }
    return null;
  }

  if (type === 'inline') {
    for (const sample of inlineSamples) {
      if (textMatches(pattern, sample)) return pack(matchSnippet(sample, pattern));
    }
    return null;
  }

  if (type === 'css') {
    const cssPool = [...stylesheets, ...extractAttrAssets(html)].filter(isAssetLike);
    for (const s of cssPool) {
      if (textMatches(pattern, s)) return { ...pack(s), type: 'css' };
    }
    return null;
  }

  if (type === 'cookie') {
    for (const c of cookies) {
      if (textMatches(pattern, c)) return pack(c.split('=')[0]);
    }
    return null;
  }

  if (type === 'meta') {
    for (const m of metas) {
      if (textMatches(pattern, m)) return pack(m);
    }
    return null;
  }

  if (type === 'global') {
    const key = typeof pattern === 'string' ? pattern : null;
    if (key && Object.prototype.hasOwnProperty.call(globals, key)) {
      const val = globals[key];
      if (val && (val === true || val.present || typeof val === 'object')) {
        const version =
          val && typeof val === 'object' && val.version ? ` v${val.version}` : '';
        return pack(`window.${key}${version}`);
      }
    }
    if (key === 'ng' && globals.__ng_version_attr) {
      return pack(`ng-version=${globals.__ng_version_attr.version || ''}`);
    }
    return null;
  }

  if (type === 'dom') {
    const patStr = typeof pattern === 'string' ? pattern : String(pattern);

    // Direct flag match
    for (const f of domFlags) {
      if (f === patStr || f === pattern) return pack(f);
      if (patStr === 'tailwind-utilities' && f === 'tailwind-utilities') return pack(f);
      if (patStr === '[data-v-]' && (f === '[data-v-]' || f.startsWith('[data-v'))) return pack(f);
      if (patStr === '.svelte-' && f === '.svelte-') return pack(f);
      if (patStr === '.btn-primary' && f === '.btn-primary') return pack(f);
      if (patStr.includes('MuiButton') && f.includes('Mui')) return pack(f);
    }

    // Structural markers — allow HTML only for known safe tokens (not free-text names)
    const structural = [
      ['script#__NEXT_DATA__', /id=["']__NEXT_DATA__["']/, 'script#__NEXT_DATA__'],
      ['#__next', /id=["']__next["']/, '#__next'],
      ['next-route-announcer', /next-route-announcer/i, 'next-route-announcer'],
      ['[data-nextjs-scroll-focus-boundary]', /data-nextjs-scroll-focus-boundary/, 'data-nextjs-scroll-focus-boundary'],
      ['[data-reactroot]', /data-reactroot/, '[data-reactroot]'],
      ['[ng-version]', /ng-version=/, null],
      ['[_ngcontent-],[_nghost-]', /_ngcontent-|_nghost-/, 'Angular host attrs'],
      ['#__nuxt', /id=["']__nuxt["']/, '#__nuxt'],
      ['[data-sveltekit-hydrate]', /data-sveltekit-hydrate/, '[data-sveltekit-hydrate]'],
      ['[data-netlify]', /data-netlify/, '[data-netlify]'],
    ];

    for (const [id, re, label] of structural) {
      if (patStr === id || patStr.startsWith(id.split(',')[0])) {
        if (domFlags.some((f) => f === id || f.startsWith(id.replace(/[\[\]]/g, '').slice(0, 8)) || (id === '[ng-version]' && f.startsWith('ng-version')))) {
          const flag = domFlags.find((f) => f.startsWith('ng-version:')) || label || id;
          return pack(flag);
        }
        if (html && re.test(html)) return pack(label || id);
      }
    }

    if (patStr === '[ng-version]') {
      const flag = domFlags.find((d) => d.startsWith('ng-version:'));
      if (flag) return pack(flag);
      if (/ng-version=["'][\d.]+/.test(html)) {
        const m = html.match(/ng-version=["']([\d.]+)["']/);
        return pack(m ? `ng-version:${m[1]}` : '[ng-version]');
      }
    }

    if (patStr.includes('MuiButton') && /MuiButton-|MuiBox-/.test(html)) {
      return pack('MUI class markers');
    }

    if (patStr === 'script[type="systemjs-importmap"]' || patStr.includes('systemjs-importmap')) {
      if (
        domFlags.includes('script[type="systemjs-importmap"]') ||
        /type=["']systemjs-importmap["']/i.test(html)
      ) {
        return pack('script[type=systemjs-importmap]');
      }
    }
    if (patStr === 'script[type="importmap"]' || patStr.includes('importmap')) {
      if (
        domFlags.includes('script[type="importmap"]') ||
        /type=["']importmap["']/i.test(html)
      ) {
        return pack('script[type=importmap]');
      }
    }
    if (patStr === '[data-single-spa]' && (domFlags.includes('[data-single-spa]') || /data-single-spa/i.test(html))) {
      return pack('[data-single-spa]');
    }
    if (patStr === '[data-emotion]' && (domFlags.includes('[data-emotion]') || /data-emotion=/i.test(html))) {
      return pack('[data-emotion]');
    }
    if (patStr === '[data-styled]' && (domFlags.includes('[data-styled]') || /data-styled=/i.test(html))) {
      return pack('[data-styled]');
    }
    if (patStr === '[sc-]' && /\bsc-[a-zA-Z0-9]/i.test(html)) {
      return pack('styled-components sc- class');
    }

    if (rule.id === 'tailwind' && (patStr === 'tailwind-utilities' || domFlags.includes('tailwind-utilities'))) {
      if (domFlags.includes('tailwind-utilities')) return pack('utility class density');
    }

    // NEVER match free-text DOM patterns against HTML body for framework names
    return null;
  }

  return null;
}

/**
 * @param {Evidence[]} evidence
 * @param {boolean} hadStrong
 */
export function scoreConfidence(evidence, hadStrong) {
  if (!evidence.length) return 'low';
  const total = evidence.reduce((a, e) => a + (e.weight || 0), 0);
  const maxW = Math.max(...evidence.map((e) => e.weight || 0));
  const hasRuntime = evidence.some((e) => e.runtime);
  if (hadStrong || hasRuntime && maxW >= 3 || maxW >= 4 || total >= 5) return 'high';
  if (maxW >= 3 || total >= 3 || (evidence.length >= 2 && total >= 2)) return 'medium';
  if (total >= 2 || maxW >= 2) return 'medium';
  return 'low';
}

/**
 * True if evidence includes real runtime or strong asset proof.
 * @param {Evidence[]} evidence
 */
export function hasRuntimeProof(evidence) {
  return evidence.some(
    (e) =>
      e.runtime ||
      e.strong ||
      (e.type === 'global' && e.weight >= 2) ||
      (e.type === 'script' && e.weight >= 3 && isAssetLike(e.snippet)) ||
      (e.type === 'inline' && e.weight >= 3) ||
      (e.type === 'dom' &&
        e.weight >= 3 &&
        !/data-v|utility class|btn-primary|svelte-/i.test(e.snippet)),
  );
}

/**
 * Solid React proof — same spirit as React DevTools "React is on this page":
 * registered renderer, fiber host, real UMD React, CDN asset, or Next/runtime imply.
 * Explicitly NOT: bare __REACT_DEVTOOLS_GLOBAL_HOOK__ (extension injects on all pages).
 * @param {Hit} hit
 */
export function hasSolidReactProof(hit) {
  if (!hit || !hit.evidence) return false;
  return hit.evidence.some((e) => {
    const s = String(e.snippet || '');
    if (/__reactRenderer/i.test(s)) return true;
    if (/__reactFiber/i.test(s)) return true;
    if (/__reactContainer/i.test(s)) return true;
    if (/runtime for Next\.js|confirmed via Next\.js/i.test(s)) return true;
    if (e.type === 'script' && isAssetLike(s) && /react/i.test(s)) return true;
    if (e.type === 'global' && /^window\.React(?:DOM)?\b/.test(s)) return true;
    if (e.type === 'dom' && /data-reactroot|data-reactid/i.test(s)) return true;
    if (e.type === 'inline' && /react(?:-dom)?\.(?:production|development)/i.test(s)) return true;
    return false;
  });
}

/**
 * @param {Hit[]} hits
 * @param {PageSignals} signals
 * @param {Map<string, import('./signatures.js').SignatureRule>} ruleById
 */
function resolveStack(hits, signals, ruleById) {
  const versions = extractVersions(signals);
  const byId = new Map(hits.map((h) => [h.id, h]));

  // Attach versions
  for (const h of hits) {
    if (versions[h.id]) h.version = versions[h.id];
  }

  // Drop frameworks that require runtime but only have weak evidence
  for (const h of [...hits]) {
    const rule = ruleById.get(h.id);
    if (!rule || rule.category !== 'framework') continue;
    if (rule.requiresRuntime && !hasRuntimeProof(h.evidence)) {
      // exception: implied children added later
      removeHit(hits, byId, h.id);
    }
  }

  // Re-read map
  const refresh = () => {
    byId.clear();
    for (const h of hits) byId.set(h.id, h);
  };
  refresh();

  const meta = META_FRAMEWORKS.find((id) => byId.has(id));

  // When Next/Nuxt/SvelteKit owns the page, drop competing frameworks without runtime
  if (meta) {
    const allowedWithMeta = {
      nextjs: new Set(['react', 'nextjs']),
      nuxt: new Set(['vue', 'nuxt']),
      sveltekit: new Set(['svelte', 'sveltekit']),
    };
    const allow = allowedWithMeta[meta] || new Set([meta]);

    for (const h of [...hits]) {
      if (h.category !== 'framework') continue;
      if (allow.has(h.id)) continue;
      // Competing framework — only keep if independent runtime proof beyond shared noise
      if (!hasRuntimeProof(h.evidence)) {
        removeHit(hits, byId, h.id);
        continue;
      }
      // Even with some proof, drop if only weak DOM while meta is present
      const onlyWeak =
        h.evidence.every(
          (e) =>
            e.weight <= 1 ||
            (e.type === 'dom' && /data-v|svelte-|btn-primary/i.test(e.snippet)),
        );
      if (onlyWeak) removeHit(hits, byId, h.id);
    }
    refresh();
  }

  // React must meet DevTools-style solid proof unless implied by Next.js
  if (byId.has('react') && !byId.has('nextjs')) {
    const r = byId.get('react');
    if (!hasSolidReactProof(r)) {
      removeHit(hits, byId, 'react');
      refresh();
    }
  }

  // Next.js → React runtime
  if (byId.has('nextjs')) {
    const n = byId.get('nextjs');
    n.confidence = 'high';
    if (versions.nextjs) n.version = versions.nextjs;

    if (!byId.has('react')) {
      hits.push({
        id: 'react',
        name: 'React',
        category: 'framework',
        confidence: 'high',
        version: versions.react,
        evidence: [{ type: 'dom', snippet: 'runtime for Next.js', weight: 3, runtime: true, strong: true }],
        related: ['nextjs'],
      });
    } else {
      const r = byId.get('react');
      r.confidence = 'high';
      r.related = Array.from(new Set([...(r.related || []), 'nextjs']));
      if (versions.react) r.version = versions.react;
      if (!r.evidence.some((e) => /Next\.js/i.test(e.snippet))) {
        r.evidence.push({
          type: 'dom',
          snippet: 'confirmed via Next.js stack',
          weight: 3,
          runtime: true,
          strong: true,
        });
      }
    }
    refresh();
  }

  if (byId.has('nuxt') && !byId.has('vue')) {
    hits.push({
      id: 'vue',
      name: 'Vue',
      category: 'framework',
      confidence: 'high',
      version: versions.vue,
      evidence: [{ type: 'dom', snippet: 'runtime for Nuxt', weight: 3, runtime: true, strong: true }],
      related: ['nuxt'],
    });
    refresh();
  }

  if (byId.has('sveltekit') && !byId.has('svelte')) {
    hits.push({
      id: 'svelte',
      name: 'Svelte',
      category: 'framework',
      confidence: 'high',
      version: versions.svelte,
      evidence: [{ type: 'dom', snippet: 'runtime for SvelteKit', weight: 3, runtime: true, strong: true }],
      related: ['sveltekit'],
    });
    refresh();
  }

  // Vercel dpl= often co-occurs with Next — already handled by signature

  // Microfrontend umbrella: YES when a known MFE platform is present
  {
    const platforms = MFE_PLATFORM_IDS.filter((id) => byId.has(id));
    // SystemJS alone is weak (can be used without MFE) unless import map / multi-remote
    const strongPlatforms = platforms.filter((id) => id !== 'systemjs' || byId.has('import-map'));
    const systemOnly = platforms.length === 1 && platforms[0] === 'systemjs' && !byId.has('import-map');

    if (strongPlatforms.length > 0 || (platforms.includes('systemjs') && byId.has('import-map'))) {
      const names = platforms.map((id) => byId.get(id)?.name || id);
      if (!byId.has('microfrontend')) {
        hits.push({
          id: 'microfrontend',
          name: 'Microfrontend',
          category: 'architecture',
          confidence: 'high',
          evidence: [
            {
              type: 'dom',
              snippet: `MFE platform detected: ${names.join(', ')}`,
              weight: 5,
              runtime: true,
              strong: true,
            },
          ],
          related: platforms,
        });
      } else {
        const m = byId.get('microfrontend');
        m.confidence = 'high';
        m.related = Array.from(new Set([...(m.related || []), ...platforms]));
        if (!m.evidence.some((e) => /MFE platform/i.test(e.snippet))) {
          m.evidence.push({
            type: 'dom',
            snippet: `MFE platform detected: ${names.join(', ')}`,
            weight: 5,
            runtime: true,
            strong: true,
          });
        }
      }
      refresh();
    } else if (systemOnly) {
      // leave SystemJS as architecture signal without claiming full MFE
    } else if (byId.has('import-map') && !byId.has('microfrontend')) {
      // bare import map → possible composition, medium only
      hits.push({
        id: 'microfrontend',
        name: 'Microfrontend',
        category: 'architecture',
        confidence: 'medium',
        evidence: [
          {
            type: 'dom',
            snippet: 'import map present (possible multi-bundle composition)',
            weight: 2,
            runtime: true,
          },
        ],
        related: ['import-map'],
      });
      refresh();
    }
  }

  // Strip any remaining non-asset "script" evidence (safety net)
  for (const h of hits) {
    h.evidence = h.evidence.filter((e) => {
      if (e.type !== 'script' && e.type !== 'css') return true;
      return isAssetLike(e.snippet) || e.snippet.includes('…');
    });
    if (!h.evidence.length && h.category === 'framework' && !['react', 'vue', 'svelte'].includes(h.id)) {
      // will be cleaned if empty — keep implied
    }
  }

  // Drop empty-evidence hits (except we always keep with evidence)
  for (const h of [...hits]) {
    if (!h.evidence.length) removeHit(hits, byId, h.id);
  }

  // Final versions pass
  for (const h of hits) {
    if (versions[h.id]) h.version = versions[h.id];
  }

  return hits;
}

/**
 * @param {Hit[]} hits
 * @param {Map<string, Hit>} byId
 * @param {string} id
 */
function removeHit(hits, byId, id) {
  const idx = hits.findIndex((h) => h.id === id);
  if (idx >= 0) hits.splice(idx, 1);
  byId.delete(id);
}

/**
 * @param {PageSignals} signals
 * @returns {ScanResult}
 */
export function detect(signals) {
  /** @type {Hit[]} */
  const hits = [];
  const ruleById = new Map(SIGNATURES.map((r) => [r.id, r]));

  for (const rule of SIGNATURES) {
    /** @type {Evidence[]} */
    const evidence = [];
    let hadStrong = false;

    for (const check of rule.checks) {
      const ev = evalCheck(signals, rule, check);
      if (ev) {
        if (!evidence.some((e) => e.type === ev.type && e.snippet === ev.snippet)) {
          evidence.push(ev);
        }
        if (check.strong) hadStrong = true;
      }
    }

    // Tailwind class soup
    if (
      rule.id === 'tailwind' &&
      (signals.domFlags || []).includes('tailwind-utilities') &&
      !evidence.some((e) => e.snippet.includes('utility'))
    ) {
      evidence.push({ type: 'dom', snippet: 'utility class density', weight: 1 });
    }

    if (!evidence.length) continue;

    // jQuery bare $
    if (rule.id === 'jquery') {
      const onlyWeakDollar =
        evidence.length === 1 &&
        evidence[0].type === 'global' &&
        evidence[0].snippet.startsWith('window.$') &&
        evidence[0].weight <= 1;
      if (onlyWeakDollar) continue;
    }

    const confidence = scoreConfidence(evidence, hadStrong);
    hits.push({
      id: rule.id,
      name: rule.name,
      category: rule.category,
      confidence,
      evidence,
      related: rule.related ? [...rule.related] : undefined,
    });
  }

  const refined = resolveStack(hits, signals, ruleById);

  const confRank = { high: 0, medium: 1, low: 2 };
  const catRank = Object.fromEntries(CATEGORY_ORDER.map((c, i) => [c, i]));
  refined.sort((a, b) => {
    const c = (catRank[a.category] ?? 99) - (catRank[b.category] ?? 99);
    if (c !== 0) return c;
    const cr = confRank[a.confidence] - confRank[b.confidence];
    if (cr !== 0) return cr;
    return a.name.localeCompare(b.name);
  });

  return {
    url: signals.url || '',
    scannedAt: Date.now(),
    pass: signals.pass || 'deep',
    hits: refined,
    primary: pickPrimary(refined),
  };
}

/**
 * @param {Hit[]} hits
 */
function pickPrimary(hits) {
  const frameworks = hits.filter((h) => h.category === 'framework' && h.confidence !== 'low');
  if (!frameworks.length) return null;
  const prefer = ['nextjs', 'nuxt', 'sveltekit', 'angular', 'react', 'vue', 'svelte', 'solid', 'jquery'];
  for (const id of prefer) {
    const hit = frameworks.find((h) => h.id === id);
    if (hit) return { id: hit.id, name: hit.name };
  }
  return { id: frameworks[0].id, name: frameworks[0].name };
}

/**
 * @param {PageSignals} light
 * @param {Record<string, unknown>} mainGlobals
 */
export function mergeDeepSignals(light, mainGlobals) {
  return {
    ...light,
    globals: { ...(light.globals || {}), ...(mainGlobals || {}) },
    pass: 'deep',
  };
}

/**
 * @param {ScanResult} result
 */
export function badgeCount(result) {
  if (!result || !result.hits) return 0;
  return result.hits.filter((h) => h.confidence === 'high' || h.confidence === 'medium').length;
}

/**
 * @param {Hit[]} hits
 * @param {{ includeLow?: boolean }} [opts]
 */
export function groupHitsByCategory(hits, opts = {}) {
  const includeLow = opts.includeLow !== false;
  /** @type {Record<string, Hit[]>} */
  const groups = {};
  for (const cat of CATEGORY_ORDER) groups[cat] = [];
  for (const hit of hits) {
    if (!includeLow && hit.confidence === 'low') continue;
    if (!groups[hit.category]) groups[hit.category] = [];
    groups[hit.category].push(hit);
  }
  return groups;
}
