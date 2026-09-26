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
import { scoreConfidence } from './signature-matcher.js';
import { calculateBadgeCount } from './architecture-classifier.js';


/**
 * @typedef {object} PageSignals
 * @property {string} [url]
 * @property {string} [html] accepted for compatibility, IGNORED as evidence — page text must never fire a hit
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

// Light signals (DOM flags, scripts, metas, cookies) are collected by
// content/content-script.js — a classic script in the page. Edit it there; this
// module only consumes the signals.

/**
 * MAIN-world probe — serialized into the page via chrome.scripting.
 */
export function mainWorldProbeSource() {
  return function probeMainWorld() {
    'use strict';
    const g = typeof globalThis !== 'undefined' ? globalThis : window;
    /** @type {Record<string, unknown>} */
    const present = {};
    // Page-controlled strings are clipped: a hostile page must not be able to
    // push megabytes through the structured clone back to the extension.
    const MAX_STR = 64;

    const mark = (name, extra) => {
      present[name] = extra && typeof extra === 'object' ? { present: true, ...extra } : { present: true };
    };

    // Every detector runs in its own try. One throwing getter or Proxy trap on
    // the page must cost that detector only — never the whole probe.
    const run = (fn) => {
      try {
        fn();
      } catch (_) {
        /* this detector only */
      }
    };

    const get = (obj, key) => {
      try {
        return obj === null || obj === undefined ? undefined : obj[key];
      } catch (_) {
        return undefined;
      }
    };
    const tryGet = (name) => get(g, name);

    // DOM clobbering: <div id="bootstrap"> or <a id="next"> becomes window.bootstrap /
    // window.next. Elements, collections and the window itself are never a library.
    const isNode = (v) => {
      try {
        if (v === g) return true;
        if (typeof Node !== 'undefined' && v instanceof Node) return true;
        if (typeof HTMLCollection !== 'undefined' && v instanceof HTMLCollection) return true;
        if (typeof NodeList !== 'undefined' && v instanceof NodeList) return true;
        return false;
      } catch (_) {
        return true;
      }
    };
    const isObj = (v) => v !== null && (typeof v === 'object' || typeof v === 'function') && !isNode(v);
    const isFn = (v) => typeof v === 'function';
    const fnAt = (obj, key) => isFn(get(obj, key));
    const has = (name) => {
      const v = tryGet(name);
      return v !== undefined && v !== null && !isNode(v);
    };
    // Never String() a page object — that runs page toString / Symbol.toPrimitive.
    const str = (v) => {
      if (typeof v === 'string') return v.slice(0, MAX_STR);
      if (typeof v === 'number' && isFinite(v)) return String(v);
      return undefined;
    };
    const withVersion = (v) => {
      const s = str(v);
      return s ? { version: s } : undefined;
    };
    const ownKeys = (obj) => {
      try {
        return Object.keys(obj);
      } catch (_) {
        return [];
      }
    };
    const q = (sel) => {
      try {
        return document.querySelector(sel);
      } catch (_) {
        return null;
      }
    };

    // Candidate mount points shared by the React / Vue / Preact checks.
    const mountCandidates = () => {
      const out = [];
      for (const sel of ['#__next', '#root', '#app', '#___gatsby', '[data-reactroot]', '[data-v-app]', '#__nuxt']) {
        const el = q(sel);
        if (el && out.indexOf(el) === -1) out.push(el);
      }
      try {
        const body = document.body;
        if (body) {
          if (out.indexOf(body) === -1) out.push(body);
          const kids = body.children;
          const limit = Math.min(kids.length, 12);
          for (let i = 0; i < limit; i++) if (out.indexOf(kids[i]) === -1) out.push(kids[i]);
        }
      } catch (_) {
        /* ignore */
      }
      return out;
    };

    // ── jQuery ───────────────────────────────────────────────────
    run(() => {
      const jq = tryGet('jQuery');
      if (!isFn(jq)) return;
      const v = str(get(get(jq, 'fn'), 'jquery'));
      if (v) mark('jQuery', { version: v });
    });

    // ── React (aligned with React DevTools) ──────────────────────
    // The RDT extension injects __REACT_DEVTOOLS_GLOBAL_HOOK__ on EVERY page,
    // so the hook alone is not React. React registers a renderer on it.
    run(() => {
      const hook = tryGet('__REACT_DEVTOOLS_GLOBAL_HOOK__');
      const renderers = get(hook, 'renderers');
      if (!isObj(renderers)) return;
      let count = 0;
      let domVersion;
      let anyVersion;
      const visit = (r) => {
        count += 1;
        const v = str(get(r, 'version'));
        if (!v) return;
        // Prefer react-dom: third-party reconcilers (react-pdf, ink, three) also
        // register renderers carrying their own package versions.
        if (get(r, 'rendererPackageName') === 'react-dom') domVersion = domVersion || v;
        anyVersion = anyVersion || v;
      };
      if (fnAt(renderers, 'forEach')) {
        renderers.forEach((r) => run(() => visit(r)));
      } else {
        for (const k of ownKeys(renderers).slice(0, 16)) run(() => visit(get(renderers, k)));
      }
      if (count > 0) {
        const version = domVersion || anyVersion;
        mark('__reactRenderer', version ? { version, count } : { count });
      }
    });

    run(() => {
      const React = tryGet('React');
      if (isObj(React) && (str(get(React, 'version')) || fnAt(React, 'createElement'))) {
        mark('React', withVersion(get(React, 'version')));
      }
    });
    run(() => {
      const ReactDOM = tryGet('ReactDOM');
      if (
        isObj(ReactDOM) &&
        (fnAt(ReactDOM, 'render') || fnAt(ReactDOM, 'createRoot') || fnAt(ReactDOM, 'hydrateRoot') || fnAt(ReactDOM, 'hydrate'))
      ) {
        mark('ReactDOM', withVersion(get(ReactDOM, 'version')));
      }
    });

    // Host-instance keys React writes onto DOM nodes (React 16+). These live on
    // the JS objects, so only the MAIN world can see them.
    run(() => {
      const fiberKey = /^__react(?:Fiber|InternalInstance)\$/;
      const containerKey = /^__reactContainer\$/;
      const listeningKey = /^_reactListening/;
      const els = mountCandidates();
      try {
        els.unshift(document);
      } catch (_) {
        /* ignore */
      }
      for (const el of els) {
        for (const k of ownKeys(el)) {
          if (!present.__reactListening && listeningKey.test(k)) mark('__reactListening');
          if (!present.__reactContainer && containerKey.test(k) && isObj(get(el, k))) mark('__reactContainer');
          if (!present.__reactFiber && fiberKey.test(k)) {
            const fiber = get(el, k);
            if (isObj(fiber) && (typeof get(fiber, 'tag') === 'number' || get(fiber, 'memoizedProps') !== undefined)) {
              mark('__reactFiber');
            }
          }
        }
        if (present.__reactFiber || present.__reactContainer) break;
      }
    });

    // ── Next.js ──────────────────────────────────────────────────
    run(() => {
      if (isObj(tryGet('__NEXT_DATA__')) && !Array.isArray(tryGet('__NEXT_DATA__'))) mark('__NEXT_DATA__');
    });
    run(() => {
      if (Array.isArray(tryGet('__next_f'))) mark('__next_f');
    });
    run(() => {
      if (Array.isArray(tryGet('webpackChunk_N_E'))) mark('webpackChunk_N_E');
    });
    run(() => {
      // App Router sets window.next = { version, appDir }. Other runtimes and
      // plain DOM clobbering (<a id="next">) also produce a window.next, so this
      // is a version hint only — never proof of Next.js on its own.
      const next = tryGet('next');
      if (!isObj(next) || isFn(next)) return;
      const v = str(get(next, 'version'));
      mark('next', v ? { version: v } : undefined);
    });

    // ── Vue / Nuxt ───────────────────────────────────────────────
    run(() => {
      const Vue = tryGet('Vue');
      if (
        isObj(Vue) &&
        (str(get(Vue, 'version')) || fnAt(Vue, 'createApp') || fnAt(Vue, 'component') || fnAt(Vue, 'use'))
      ) {
        mark('Vue', withVersion(get(Vue, 'version')));
      }
    });
    run(() => {
      if (has('__VUE__')) mark('__VUE__');
    });
    run(() => {
      if (isObj(tryGet('__NUXT__'))) mark('__NUXT__');
    });
    // Vue 3 production apps expose NO window.Vue: app.mount(el) sets
    // el.__vue_app__ (with .version). Vue 2 sets el.__vue__ on the root vm.
    run(() => {
      for (const el of mountCandidates()) {
        const app = get(el, '__vue_app__');
        if (isObj(app)) {
          mark('__vue_app__', withVersion(get(app, 'version')));
          return;
        }
        const vm = get(el, '__vue__');
        if (isObj(vm) && get(vm, '_isVue') === true) {
          mark('__vue2__');
          return;
        }
      }
    });

    // ── Angular / AngularJS ──────────────────────────────────────
    run(() => {
      if (isFn(tryGet('getAllAngularRootElements'))) mark('getAllAngularRootElements');
    });
    run(() => {
      const ng = tryGet('ng');
      if (isObj(ng) && (fnAt(ng, 'getComponent') || fnAt(ng, 'probe') || fnAt(ng, 'applyChanges'))) mark('ng');
    });
    run(() => {
      const el = q('[ng-version]');
      if (el) mark('__ng_version_attr', withVersion(el.getAttribute('ng-version')));
    });
    run(() => {
      const angular = tryGet('angular');
      if (isObj(angular) && fnAt(angular, 'module') && fnAt(angular, 'bootstrap')) {
        mark('angularjs', withVersion(get(get(angular, 'version'), 'full')));
      }
    });

    // ── Svelte / SvelteKit ───────────────────────────────────────
    run(() => {
      const s = tryGet('__svelte');
      if (!isObj(s)) return;
      // Svelte 5 keeps a Set of runtime majors on window.__svelte.v
      let version;
      const v = get(s, 'v');
      if (v && fnAt(v, 'values')) {
        for (const x of v.values()) {
          version = str(x);
          if (version) break;
        }
      }
      mark('__svelte', version ? { version } : undefined);
    });
    run(() => {
      // SvelteKit's global is __sveltekit_<hash>, not __sveltekit
      if (ownKeys(g).some((k) => k === '__sveltekit' || k.indexOf('__sveltekit_') === 0)) mark('__sveltekit');
    });

    // ── Other frameworks ─────────────────────────────────────────
    run(() => {
      const p = tryGet('preact');
      if (isObj(p) && fnAt(p, 'h') && fnAt(p, 'render')) mark('preact');
    });
    run(() => {
      const lit = tryGet('litElementVersions') || tryGet('litHtmlVersions');
      if (Array.isArray(lit) && lit.length) mark('litVersions', withVersion(lit[0]));
    });
    run(() => {
      const P = tryGet('Polymer');
      if (isObj(P) && (fnAt(P, 'Element') || str(get(P, 'version')) || isFn(P))) mark('Polymer', withVersion(get(P, 'version')));
    });
    run(() => {
      const E = tryGet('Ember');
      if (isObj(E) && str(get(E, 'VERSION'))) mark('Ember', withVersion(get(E, 'VERSION')));
    });
    run(() => {
      const A = tryGet('Alpine');
      if (isObj(A) && (fnAt(A, 'start') || fnAt(A, 'data'))) mark('Alpine', withVersion(get(A, 'version')));
    });
    run(() => {
      const h = tryGet('htmx');
      if (isObj(h) && fnAt(h, 'ajax') && fnAt(h, 'process')) mark('htmx', withVersion(get(h, 'version')));
    });
    run(() => {
      if (isObj(tryGet('___loader')) || isObj(tryGet('___emitter'))) mark('___gatsby');
    });
    run(() => {
      if (isObj(tryGet('qwikevents')) || q('[q\\:container]')) mark('__qwik');
    });

    // ── Microfrontends / composition ─────────────────────────────
    run(() => {
      if (isObj(tryGet('__FEDERATION__'))) mark('__FEDERATION__');
    });
    run(() => {
      if (has('__FEDERATION_DEVTOOLS__')) mark('__FEDERATION_DEVTOOLS__');
    });
    run(() => {
      if (isObj(tryGet('__VMOK__'))) mark('__VMOK__');
    });
    run(() => {
      if (tryGet('__POWERED_BY_QIANKUN__') === true) mark('__POWERED_BY_QIANKUN__');
    });
    run(() => {
      if (typeof tryGet('__INJECTED_PUBLIC_PATH_BY_QIANKUN__') === 'string') mark('__INJECTED_PUBLIC_PATH_BY_QIANKUN__');
    });
    run(() => {
      if (isObj(tryGet('__MICRO_FRONTEND__')) || tryGet('__MICRO_FRONTEND__') === true) mark('__MICRO_FRONTEND__');
      if (isObj(tryGet('__MICROFRONTEND__')) || tryGet('__MICROFRONTEND__') === true) mark('__MICROFRONTEND__');
    });
    run(() => {
      const singleSpa = tryGet('singleSpa');
      if (
        isObj(singleSpa) &&
        (fnAt(singleSpa, 'registerApplication') || fnAt(singleSpa, 'start') || fnAt(singleSpa, 'getAppNames'))
      ) {
        mark('singleSpa');
      }
      if (isFn(tryGet('singleSpaNavigate'))) mark('singleSpaNavigate');
    });
    run(() => {
      // SystemJS only — NOT import-map polyfills that merely expose System.import.
      const System = tryGet('System');
      if (!isObj(System) || !fnAt(System, 'register')) return;
      const ctor = get(System, 'constructor');
      const ctorName = str(get(ctor, 'name')) || '';
      if (fnAt(System, 'amdResolve') || fnAt(System, 'getConfig') || fnAt(System, 'resolve') || /SystemJS/i.test(ctorName)) {
        mark('__systemjs');
      }
    });

    // ── Build tools ──────────────────────────────────────────────
    run(() => {
      if (isFn(tryGet('__webpack_require__'))) mark('__webpack_require__');
    });
    run(() => {
      const keys = ownKeys(g);
      // webpack 5 names chunk arrays webpackChunk<name>; webpack 4 used webpackJsonp
      if (keys.some((k) => (k.indexOf('webpackChunk') === 0 || k.indexOf('webpackJsonp') === 0) && Array.isArray(get(g, k)))) {
        mark('webpackChunk');
      }
    });
    run(() => {
      if (isFn(tryGet('parcelRequire'))) mark('parcelRequire');
    });
    run(() => {
      // Turbopack's runtime global is TURBOPACK (plus TURBOPACK_CHUNK_LISTS)
      if (has('TURBOPACK') || has('TURBOPACK_CHUNK_LISTS') || has('__turbopack')) mark('__turbopack');
    });
    run(() => {
      if (tryGet('__vite_plugin_react_preamble_installed__') === true) mark('__vite_plugin_react_preamble_installed__');
    });

    // ── Observability ────────────────────────────────────────────
    run(() => {
      const Sentry = tryGet('Sentry');
      if (
        isObj(Sentry) &&
        (fnAt(Sentry, 'init') || fnAt(Sentry, 'captureException') || str(get(Sentry, 'SDK_VERSION')))
      ) {
        mark('Sentry', withVersion(get(Sentry, 'SDK_VERSION')));
      }
    });
    run(() => {
      if (isObj(tryGet('__SENTRY__'))) mark('__SENTRY__');
    });
    run(() => {
      const rum = tryGet('DD_RUM');
      if (isObj(rum) && (fnAt(rum, 'init') || fnAt(rum, 'onReady'))) mark('DD_RUM');
      const logs = tryGet('DD_LOGS');
      if (isObj(logs) && (fnAt(logs, 'init') || fnAt(logs, 'onReady'))) mark('DD_LOGS');
    });
    run(() => {
      // New Relic Browser agent — require real agent config, not an empty NREUM={}
      const NREUM = tryGet('NREUM');
      if (!isObj(NREUM)) return;
      const info = get(NREUM, 'info');
      const hasAgent = !!(
        get(info, 'licenseKey') ||
        get(info, 'applicationID') ||
        get(info, 'beacon') ||
        get(info, 'errorBeacon') ||
        get(info, 'agent') ||
        get(NREUM, 'init') ||
        get(NREUM, 'loader_config')
      );
      if (hasAgent) mark('NREUM');
    });
    run(() => {
      const newrelic = tryGet('newrelic');
      if (
        isObj(newrelic) &&
        (fnAt(newrelic, 'noticeError') ||
          fnAt(newrelic, 'setCustomAttribute') ||
          fnAt(newrelic, 'addPageAction') ||
          fnAt(newrelic, 'setPageViewName') ||
          fnAt(newrelic, 'interaction'))
      ) {
        mark('newrelic');
      }
      if (isFn(tryGet('__nr_require'))) mark('__nr_require');
    });
    run(() => {
      const lr = tryGet('LogRocket');
      if (isObj(lr) && (fnAt(lr, 'init') || fnAt(lr, 'identify') || fnAt(lr, 'track'))) mark('LogRocket');
    });

    // ── Payments / auth ──────────────────────────────────────────
    run(() => {
      if (isFn(tryGet('Stripe'))) mark('Stripe');
      if (isFn(tryGet('Razorpay'))) mark('Razorpay');
    });
    run(() => {
      const Clerk = tryGet('Clerk');
      if (isObj(Clerk) && (fnAt(Clerk, 'load') || fnAt(Clerk, 'openSignIn') || get(Clerk, 'loaded') !== undefined)) {
        mark('Clerk');
      }
    });
    run(() => {
      const auth0 = tryGet('auth0');
      if (
        isObj(auth0) &&
        (fnAt(auth0, 'createAuth0Client') || fnAt(auth0, 'Auth0Client') || fnAt(auth0, 'WebAuth') || fnAt(auth0, 'Authentication'))
      ) {
        mark('auth0');
      }
    });
    run(() => {
      const firebase = tryGet('firebase');
      if (isObj(firebase) && (get(firebase, 'apps') || fnAt(firebase, 'initializeApp'))) mark('firebase');
    });

    // ── Support / flags / analytics ──────────────────────────────
    run(() => {
      if (isFn(tryGet('Intercom'))) mark('Intercom');
      if (isObj(tryGet('intercomSettings')) && !isFn(tryGet('intercomSettings'))) mark('intercomSettings');
      if (isFn(tryGet('zE'))) mark('zE');
    });
    run(() => {
      const ld = tryGet('LDClient');
      if (isObj(ld) && (fnAt(ld, 'initialize') || fnAt(ld, 'variation'))) mark('LDClient');
    });
    run(() => {
      if (isFn(tryGet('gtag'))) mark('gtag');
    });
    run(() => {
      const mp = tryGet('mixpanel');
      if (isObj(mp) && (fnAt(mp, 'track') || get(mp, '__SV') !== undefined)) mark('mixpanel');
    });
    run(() => {
      if (isFn(tryGet('hj'))) mark('hj');
    });
    run(() => {
      const ph = tryGet('posthog');
      if ((isObj(ph) && fnAt(ph, 'capture')) || isObj(tryGet('__PosthogExtensions__'))) mark('posthog');
    });
    run(() => {
      if (isFn(tryGet('plausible'))) mark('plausible');
    });
    run(() => {
      const f = tryGet('fathom');
      if (isObj(f) && fnAt(f, 'trackPageview')) mark('fathom');
    });
    run(() => {
      const a = tryGet('amplitude');
      if (isObj(a) && (fnAt(a, 'getInstance') || fnAt(a, 'track') || fnAt(a, 'init'))) mark('amplitude');
    });
    run(() => {
      const s = tryGet('Shopify');
      if (isObj(s) && typeof get(s, 'shop') === 'string') mark('Shopify');
    });

    // ── State / data ─────────────────────────────────────────────
    run(() => {
      // The Redux DevTools extension injects __REDUX_DEVTOOLS_EXTENSION__ on every
      // page, so only an actual store object counts.
      for (const name of ['__REDUX_STORE__', 'store', '__store__']) {
        const store = tryGet(name);
        if (isObj(store) && fnAt(store, 'dispatch') && fnAt(store, 'getState') && fnAt(store, 'subscribe')) {
          mark('__reduxStore');
          return;
        }
      }
    });
    run(() => {
      for (const name of [
        '__remixContext',
        '__remixManifest',
        '__remixRouter',
        '__remixRouteModules',
        '__reactRouterDataRouter',
        '__staticRouterHydrationData',
      ]) {
        if (isObj(tryGet(name))) mark(name);
      }
      const rr = tryGet('__reactRouterVersion');
      if (typeof rr === 'string' || typeof rr === 'number') mark('__reactRouterVersion', { version: str(rr) });
    });
    run(() => {
      for (const name of ['__TANSTACK_QUERY_CLIENT__', '__TANSTACK_ROUTER__', '__TANSTACK_START__', '__TSR_SSR__', '__TANSTACK__', 'ReactQuery']) {
        if (isObj(tryGet(name))) mark(name);
      }
    });
    run(() => {
      if (isObj(tryGet('__PINIA__'))) mark('__PINIA__');
      if (isObj(tryGet('__MOBX__'))) mark('__MOBX__');
      const apollo = tryGet('__APOLLO_CLIENT__');
      if (isObj(apollo) && (fnAt(apollo, 'query') || get(apollo, 'cache'))) mark('__APOLLO_CLIENT__');
      const axios = tryGet('axios');
      if (isFn(axios) && fnAt(axios, 'get') && fnAt(axios, 'create')) mark('axios', withVersion(get(axios, 'VERSION')));
      const bs = tryGet('bootstrap');
      if (isObj(bs) && (fnAt(bs, 'Modal') || fnAt(bs, 'Tooltip') || fnAt(bs, 'Collapse'))) mark('bootstrap');
    });

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
 * Asset evidence pool: collected script/preload/resource URLs + stylesheets.
 *
 * Deliberately NOT scraped from signals.html. An earlier version regexed
 * src/href attributes out of the raw HTML string — but quotes are not
 * entity-escaped in text nodes, so a docs page displaying
 * `<script src="https://unpkg.com/react@18.2.0/...">` inside a <pre> matched
 * as though the script were loaded (high-confidence React + version), and a
 * plain `<a href="https://hotjar.com">` link fired vendor hits. The content
 * script already collects every real asset: script[src], preload links,
 * stylesheets, and performance resource entries (everything actually fetched).
 *
 * @param {PageSignals} signals
 */
export function assetCandidates(signals) {
  const cached = ASSET_CACHE.get(signals);
  if (cached) return cached;
  const fromSignals = (signals.scripts || []).filter(isAssetLike);
  const fromCss = (signals.stylesheets || []).filter(isAssetLike);
  const out = [...new Set([...fromSignals, ...fromCss])];
  ASSET_CACHE.set(signals, out);
  return out;
}

/** assetCandidates() is consulted by ~150 checks per scan — compute it once. */
const ASSET_CACHE = new WeakMap();

/**
 * URL without its query string or fragment.
 *
 * Rules match the asset's host and path, never the query: a search request
 * (`/api/search?q=logrocket`), a tracking parameter or a cache-buster must not
 * be able to fire a rule. Stripping also keeps session tokens out of evidence
 * snippets, which end up in exports and in the "Wrong?" report draft.
 *
 * @param {string} s
 */
export function stripQuery(s) {
  const t = String(s || '');
  if (t.startsWith('inline:#')) return t;
  const cut = t.search(/[?#]/);
  return cut === -1 ? t : t.slice(0, cut);
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

/**
 * Keep "major.minor(.patch)(-prerelease)". Build metadata (`+sha-14793bf`) is
 * dropped, and a bare major ("5", Svelte's runtime marker) is allowed only when
 * that is the whole string.
 * @param {unknown} v
 */
export function normalizeVersion(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const s = String(v).trim().slice(0, 64);
  if (/^\d{1,3}$/.test(s)) return s;
  const m = s.match(/\d+\.\d+(?:\.\d+)?(?:-[0-9a-z]+(?:\.[0-9a-z]+)*)?/i);
  return m ? m[0] : null;
}

/**
 * Plausible major-version ranges. A version outside its range was read from the
 * wrong object (Linear's window.next.version is "1.0.0-beta.9"; no Next.js 1.x
 * ships an App Router) or the wrong package, and showing none beats showing a
 * confident wrong one.
 */
const MAJOR_RANGE = {
  nextjs: [9, 40],
  react: [15, 40],
  vue: [1, 9],
  angular: [2, 60],
  angularjs: [1, 1],
  jquery: [1, 9],
  svelte: [3, 20],
  bootstrap: [2, 9],
  'react-router': [3, 20],
  remix: [1, 9],
  redux: [1, 9],
  zustand: [1, 9],
  axios: [0, 9],
  sentry: [4, 30],
  lit: [1, 9],
  polymer: [1, 9],
  ember: [1, 19],
  alpine: [2, 9],
  htmx: [1, 9],
};

/** npm package boundary: not the tail of another name, not inside a scope. */
const PKG = String.raw`(?<![\w@.-])(?<!@[\w.-]+\/)`;
const VER = String.raw`(\d+\.\d+(?:\.\d+)?(?:-[0-9a-z.]+)?)`;
const pkgRe = (name) => new RegExp(`${PKG}${name}@${VER}`, 'i');

/** [hit id, regex with the version in group 1] over asset URLs (query stripped). */
const URL_VERSION_RULES = [
  ['react', pkgRe('react(?:-dom)?')],
  ['react', new RegExp(String.raw`(?<![\w.-])react(?:-dom)?[_-]${VER}(?:\.production|\.development)?(?:\.min)?\.js$`, 'i')],
  ['vue', pkgRe('vue')],
  ['angular', new RegExp(String.raw`(?<![\w-])@angular\/core@${VER}`, 'i')],
  ['nextjs', pkgRe('next')],
  ['svelte', pkgRe('svelte')],
  ['jquery', pkgRe('jquery')],
  ['jquery', new RegExp(String.raw`(?<![\w.-])jquery[-_.]${VER}(?:\.slim)?(?:\.min)?\.js$`, 'i')],
  ['bootstrap', pkgRe('bootstrap')],
  ['bootstrap', new RegExp(String.raw`\/twitter-bootstrap\/${VER}\/`, 'i')],
  ['redux', pkgRe('redux')],
  ['axios', pkgRe('axios')],
  ['zustand', pkgRe('zustand')],
  ['react-router', pkgRe('react-router(?:-dom)?')],
  ['react-router', new RegExp(String.raw`(?<![\w-])@react-router\/[a-z0-9-]+@${VER}`, 'i')],
  ['remix', new RegExp(String.raw`(?<![\w-])@remix-run\/[a-z0-9-]+@${VER}`, 'i')],
  ['lit', pkgRe('lit(?:-element|-html)?')],
  ['alpine', pkgRe('alpinejs')],
  ['htmx', pkgRe('htmx(?:\\.org)?')],
];

const TANSTACK_VERSION = new RegExp(String.raw`(?<![\w-])@tanstack\/([a-z0-9-]+)@${VER}`, 'i');

/**
 * @param {PageSignals} signals
 * @returns {Record<string, string>}
 */
export function extractVersions(signals) {
  /** @type {Record<string, string>} */
  const versions = {};
  const g = signals.globals || {};

  const take = (id, v) => {
    if (versions[id]) return;
    const n = normalizeVersion(v);
    if (!n) return;
    const range = MAJOR_RANGE[id];
    const major = parseInt(n, 10);
    if (range && !(major >= range[0] && major <= range[1])) return;
    versions[id] = n;
  };
  const gv = (name) => {
    const x = g[name];
    return x && typeof x === 'object' ? x.version : undefined;
  };

  for (const [id, v] of Object.entries(signals.versions || {})) take(id, v);

  take('jquery', gv('jQuery'));
  take('react', gv('__reactRenderer'));
  take('react', gv('React'));
  take('react', gv('ReactDOM'));
  take('vue', gv('__vue_app__'));
  take('vue', gv('Vue'));
  // window.next.version is only a Next.js version when it is in Next's range
  // (the take() range check). It is never proof that Next.js is present.
  take('nextjs', gv('next'));
  take('angular', gv('__ng_version_attr'));
  take('angularjs', gv('angularjs'));
  take('svelte', gv('__svelte'));
  take('react-router', gv('__reactRouterVersion'));
  take('sentry', gv('Sentry'));
  take('lit', gv('litVersions'));
  take('polymer', gv('Polymer'));
  take('ember', gv('Ember'));
  take('alpine', gv('Alpine'));
  take('htmx', gv('htmx'));
  take('axios', gv('axios'));

  const ngFlag = (signals.domFlags || []).find((d) => d.startsWith('ng-version:'));
  if (ngFlag) take('angular', ngFlag.slice('ng-version:'.length));

  for (const raw of assetCandidates(signals)) {
    const url = stripQuery(raw);
    for (const [id, re] of URL_VERSION_RULES) {
      const m = url.match(re);
      if (m && m[1]) take(id, m[1]);
    }
    const ts = url.match(TANSTACK_VERSION);
    if (ts) {
      const pkg = ts[1].toLowerCase();
      const ver = ts[2];
      if (/query/.test(pkg)) take('tanstack-query', ver);
      else if (/router/.test(pkg)) take('tanstack-router', ver);
      else if (/table/.test(pkg)) take('tanstack-table', ver);
      else if (/form/.test(pkg)) take('tanstack-form', ver);
      else if (/virtual/.test(pkg)) take('tanstack-virtual', ver);
      else if (/start/.test(pkg)) take('tanstack-start', ver);
    }
  }

  // Inline code only states a React version in the UMD build banner.
  for (const sample of signals.inlineSamples || []) {
    const reactV = sample.match(/\bReact\.version\s*=\s*["'](\d+\.\d+\.\d+)["']/);
    if (reactV) take('react', reactV[1]);
  }

  return versions;
}

/**
 * @param {PageSignals} signals
 * @param {import('./signatures.js').SignatureCheck} check
 * @returns {Evidence|null}
 */
function evalCheck(signals, check) {
  const { type, pattern, weight, strong, runtime } = check;
  const cookies = signals.cookies || [];
  const metas = signals.metas || [];
  const domFlags = signals.domFlags || [];
  const globals = signals.globals || {};
  const inlineSamples = signals.inlineSamples || [];

  const pack = (snippet) => ({
    type,
    snippet: clip(snippet),
    weight,
    strong: !!strong,
    runtime: !!runtime,
  });

  if (type === 'script') {
    for (const s of assetCandidates(signals)) {
      const hay = check.matchQuery ? s : stripQuery(s);
      if (textMatches(pattern, hay)) return pack(hay);
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
    // Perf resource entries land in scripts[] and include CSS fetches, so the
    // full asset pool covers more than link[rel=stylesheet] alone.
    for (const s of assetCandidates(signals)) {
      const hay = check.matchQuery ? s : stripQuery(s);
      if (textMatches(pattern, hay)) return { ...pack(hay), type: 'css' };
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
      // A probe reporting absence as `{ present: false }` must not score as a
      // hit, so require an explicit positive marker rather than any object.
      if (val === true || (val && typeof val === 'object' && val.present !== false)) {
        const version =
          val && typeof val === 'object' && val.version ? ` v${val.version}` : '';
        return pack(`window.${key}${version}`);
      }
    }
    return null;
  }

  if (type === 'dom') {
    const patStr = typeof pattern === 'string' ? pattern : String(pattern);

    // DOM evidence resolves from probed flags ONLY — never by regex over
    // signals.html. `html` is documentElement.outerHTML, which carries page
    // *text* as well as structure, so a tutorial rendering `<div data-reactroot>`
    // inside a <pre> used to score as a real React hit. The content script does
    // the querySelector probing and reports results in domFlags; every dom
    // pattern in signatures.js is one of those flag names.
    return domFlags.includes(patStr) ? pack(patStr) : null;
  }

  return null;
}

export { scoreConfidence } from './signature-matcher.js';


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
    if (/__reactListening/i.test(s)) return true;
    if (/runtime for |confirmed via /i.test(s)) return true;
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

  // When Next/Nuxt/SvelteKit/TanStack Start owns the page, drop competing frameworks
  if (meta) {
    const allowedWithMeta = {
      nextjs: new Set(['react', 'nextjs']),
      nuxt: new Set(['vue', 'nuxt']),
      sveltekit: new Set(['svelte', 'sveltekit']),
      'tanstack-start': new Set(['react', 'solid', 'tanstack-start', 'tanstack-router', 'tanstack']),
      remix: new Set(['react', 'remix', 'react-router']),
      gatsby: new Set(['react', 'gatsby']),
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
    // Only promote with strong proof (a /_next/ asset, __NEXT_DATA__, __next_f…).
    // A lone window.next is a hint, and resolve already dropped that case.
    if (n.evidence.some((e) => e.strong)) n.confidence = 'high';
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

  if (byId.has('gatsby') && !byId.has('react')) {
    hits.push({
      id: 'react',
      name: 'React',
      category: 'framework',
      confidence: 'high',
      version: versions.react,
      evidence: [{ type: 'dom', snippet: 'runtime for Gatsby', weight: 3, runtime: true, strong: true }],
      related: ['gatsby'],
    });
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

  // Remix → React + React Router
  if (byId.has('remix')) {
    const rem = byId.get('remix');
    rem.confidence = 'high';
    if (versions.remix) rem.version = versions.remix;

    if (!byId.has('react')) {
      hits.push({
        id: 'react',
        name: 'React',
        category: 'framework',
        confidence: 'high',
        version: versions.react,
        evidence: [
          {
            type: 'dom',
            snippet: 'runtime for Remix',
            weight: 3,
            runtime: true,
            strong: true,
          },
        ],
        related: ['remix'],
      });
    } else {
      const r = byId.get('react');
      r.confidence = 'high';
      r.related = Array.from(new Set([...(r.related || []), 'remix']));
      if (!r.evidence.some((e) => /Remix/i.test(e.snippet))) {
        r.evidence.push({
          type: 'dom',
          snippet: 'confirmed via Remix stack',
          weight: 3,
          runtime: true,
          strong: true,
        });
      }
    }

    if (!byId.has('react-router')) {
      hits.push({
        id: 'react-router',
        name: 'React Router',
        category: 'data',
        confidence: 'high',
        version: versions['react-router'],
        evidence: [
          {
            type: 'dom',
            snippet: 'routing foundation for Remix',
            weight: 4,
            runtime: true,
            strong: true,
          },
        ],
        related: ['remix'],
      });
    } else {
      const rr = byId.get('react-router');
      rr.confidence = 'high';
      rr.related = Array.from(new Set([...(rr.related || []), 'remix']));
    }
    refresh();
  }

  // TanStack Start (meta-framework on Router) → Router + React runtime
  if (byId.has('tanstack-start')) {
    const s = byId.get('tanstack-start');
    s.confidence = 'high';
    if (versions['tanstack-start']) s.version = versions['tanstack-start'];

    if (!byId.has('tanstack-router')) {
      hits.push({
        id: 'tanstack-router',
        name: 'TanStack Router',
        category: 'data',
        confidence: 'high',
        version: versions['tanstack-router'],
        evidence: [
          {
            type: 'dom',
            snippet: 'routing foundation for TanStack Start',
            weight: 4,
            runtime: true,
            strong: true,
          },
        ],
        related: ['tanstack-start', 'tanstack'],
      });
    } else {
      const r = byId.get('tanstack-router');
      r.confidence = 'high';
      r.related = Array.from(new Set([...(r.related || []), 'tanstack-start']));
    }

    if (!byId.has('react') && !byId.has('solid')) {
      hits.push({
        id: 'react',
        name: 'React',
        category: 'framework',
        confidence: 'high',
        version: versions.react,
        evidence: [
          {
            type: 'dom',
            snippet: 'runtime for TanStack Start (React path)',
            weight: 3,
            runtime: true,
            strong: true,
          },
        ],
        related: ['tanstack-start'],
      });
    } else if (byId.has('react')) {
      const r = byId.get('react');
      r.confidence = 'high';
      r.related = Array.from(new Set([...(r.related || []), 'tanstack-start']));
      if (!r.evidence.some((e) => /TanStack Start/i.test(e.snippet))) {
        r.evidence.push({
          type: 'dom',
          snippet: 'confirmed via TanStack Start stack',
          weight: 3,
          runtime: true,
          strong: true,
        });
      }
    }
    refresh();
  }

  // Vercel dpl= often co-occurs with Next — already handled by signature

  // TanStack umbrella: if a specific package hit, ensure family label exists
  {
    const tanstackKids = [
      'tanstack-query',
      'tanstack-router',
      'tanstack-table',
      'tanstack-form',
      'tanstack-virtual',
      'tanstack-start',
    ].filter((id) => byId.has(id));
    if (tanstackKids.length > 0) {
      if (!byId.has('tanstack')) {
        hits.push({
          id: 'tanstack',
          name: 'TanStack',
          category: 'data',
          confidence: 'high',
          evidence: [
            {
              type: 'dom',
              snippet: `TanStack packages: ${tanstackKids.map((id) => byId.get(id)?.name || id).join(', ')}`,
              weight: 4,
              runtime: true,
              strong: true,
            },
          ],
          related: tanstackKids,
        });
      } else {
        const t = byId.get('tanstack');
        t.confidence = t.confidence === 'low' ? 'medium' : t.confidence;
        t.related = Array.from(new Set([...(t.related || []), ...tanstackKids]));
      }
      // Version from CDN if any child URL matched
      for (const id of tanstackKids) {
        if (versions[id] && byId.get(id) && !byId.get(id).version) {
          byId.get(id).version = versions[id];
        }
      }
      refresh();
    }
  }

  // Microfrontend umbrella: ONLY real MFE platforms (federation / single-spa / qiankun).
  // Never promote from SystemJS or native <script type="importmap"> (Vite/SPAs use those).
  {
    const platforms = MFE_PLATFORM_IDS.filter((id) => byId.has(id));
    if (platforms.length > 0) {
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
    }
  }

  // Drop low-value import-map noise from headline path: cap confidence at medium
  // and never leave it as sole architecture claim when it's the only architecture hit
  if (byId.has('import-map')) {
    const im = byId.get('import-map');
    // Native import maps are ubiquitous (Vite) — keep as build signal only, low unless strong alone...
    // Already category build; demote to low so it doesn't dominate badge/headline
    im.confidence = 'low';
    im.evidence = [
      ...im.evidence,
      {
        type: 'dom',
        snippet: 'native import map (common in Vite/modern apps — not an MFE)',
        weight: 1,
      },
    ];
  }

  // Strip any remaining non-asset "script" evidence (safety net)
  for (const h of hits) {
    h.evidence = h.evidence.filter((e) => {
      if (e.type !== 'script' && e.type !== 'css') return true;
      return isAssetLike(e.snippet);
    });
  }

  demoteThirdPartyBuildTools(hits, signals.url || '');
  demoteConflictingBundlers(hits);

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

/** Second-level labels under which the registrable name sits one level deeper. */
const MULTI_PART_TLD = /^(?:co|com|net|org|gov|edu|ac|ltd|plc|ne|or)$/;

/**
 * Registrable site of a host ("www.hj.contentsquare.com" → "contentsquare.com",
 * "shop.example.co.in" → "example.co.in"). Approximate without the public suffix
 * list, which is fine for a first-party/third-party hint.
 * @param {string} host
 */
export function siteOf(host) {
  const parts = String(host || '').toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const n = MULTI_PART_TLD.test(parts[parts.length - 2]) && parts[parts.length - 1].length === 2 ? 3 : 2;
  return parts.slice(-n).join('.');
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * A build tool seen only in another site's scripts (an embedded widget, a vendor
 * SDK) says nothing about how THIS site is built. Keep it visible, as low.
 * @param {Hit[]} hits
 * @param {string} pageUrl
 */
function demoteThirdPartyBuildTools(hits, pageUrl) {
  const pageSite = siteOf(hostOf(pageUrl));
  if (!pageSite) return;
  for (const h of hits) {
    if (h.category !== 'build' || h.confidence === 'low') continue;
    const urls = h.evidence.filter((e) => e.type === 'script' || e.type === 'css');
    if (!urls.length || urls.length !== h.evidence.length) continue;
    const thirdParty = urls.every((e) => {
      const host = hostOf(e.snippet);
      return host && siteOf(host) !== pageSite;
    });
    if (thirdParty) {
      h.confidence = 'low';
      h.evidence = [
        ...h.evidence,
        { type: 'dom', snippet: 'only in third-party scripts — may not be this site’s own build', weight: 0 },
      ];
    }
  }
}

/** The bundlers each meta-framework actually builds with. */
const META_BUNDLERS = {
  nextjs: ['webpack', 'turbopack'],
  gatsby: ['webpack'],
  nuxt: ['vite', 'webpack'],
  sveltekit: ['vite'],
  remix: ['vite'],
  astro: ['vite'],
};

/**
 * One page, one app bundler. When a meta-framework fixes the bundler, a
 * different one seen only as a runtime global (window.parcelRequire from an
 * embedded survey widget on a Next.js site) belongs to someone else's script.
 * @param {Hit[]} hits
 */
function demoteConflictingBundlers(hits) {
  const ids = new Set(hits.map((h) => h.id));
  const owner = Object.keys(META_BUNDLERS).find((id) => ids.has(id));
  if (!owner) return;
  const allowed = new Set(META_BUNDLERS[owner]);
  for (const h of hits) {
    if (!['parcel', 'vite'].includes(h.id) || allowed.has(h.id) || h.confidence === 'low') continue;
    if (h.evidence.every((e) => e.type === 'global' || e.type === 'inline')) {
      h.confidence = 'low';
      h.evidence = [
        ...h.evidence,
        { type: 'dom', snippet: `conflicts with ${owner}'s own bundler — likely an embedded third-party script`, weight: 0 },
      ];
    }
  }
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
      const ev = evalCheck(signals, check);
      if (ev) {
        if (!evidence.some((e) => e.type === ev.type && e.snippet === ev.snippet)) {
          evidence.push(ev);
        }
        if (check.strong) hadStrong = true;
      }
    }

    if (!evidence.length) continue;

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
  const prefer = [
    'nextjs',
    'remix',
    'tanstack-start',
    'nuxt',
    'sveltekit',
    'gatsby',
    'astro',
    'qwik',
    'angular',
    'react',
    'vue',
    'svelte',
    'solid',
    'preact',
    'ember',
    'lit',
    'polymer',
    'angularjs',
    'alpine',
    'htmx',
    'jquery',
  ];
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
  return calculateBadgeCount(result);
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
