/**
 * WhatStack content script — isolated world, classic script (no imports).
 * Collects light page signals (DOM, scripts, resources, inline markers).
 *
 * The isolated world shares the page's DOM but NOT its JS heap, so runtime
 * objects (React fibers, el.__vue_app__, window.Stripe) are invisible here. The
 * service worker runs the MAIN-world probe (shared/detect.js) for those, right
 * after each LIGHT_SCAN, so the badge and the popup agree.
 */
(function () {
  'use strict';

  // Declared in the manifest AND re-injected by ScanOrchestrator when
  // sendMessage finds no receiver (and on install/update). A second copy must
  // not register a second listener — unless the first copy belongs to a
  // reloaded extension, whose chrome.runtime is dead. Then it takes over.
  var prev = window.__whatstackContentScript;
  if (prev && typeof prev.alive === 'function' && prev.alive()) return;
  window.__whatstackContentScript = {
    alive: function () {
      try {
        return !!(chrome.runtime && chrome.runtime.id);
      } catch (_) {
        return false;
      }
    },
  };

  /** Element budget for the attribute / class scans on huge DOMs. */
  var SCAN_BUDGET = 400;

  // Tailwind-only class syntax. Bootstrap shares flex / p-3 / rounded / shadow,
  // so those generic names only ever produce the weak 'tailwind-utilities' flag.
  var TW_PALETTE =
    /^(?:[a-z0-9-]+:)*(?:bg|text|border|ring|from|to|via|fill|stroke|divide|outline|decoration|shadow|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)(?:\/\d{1,3})?$/;
  // A variant prefix only counts in front of a Tailwind utility name: other
  // frameworks use responsive prefixes too (Stack Overflow's Stacks: md:d-none).
  var TW_VARIANT = /^(?:sm|md|lg|xl|2xl|hover|focus|focus-visible|active|dark|group-hover|disabled|first|last|aria-[a-z-]+|data-\[[^\]]+\]):(?:[a-z0-9-]+:)*-?(?:block|hidden|flex|grid|inline(?:-block|-flex|-grid)?|contents|w-|h-|size-|p[xytblrse]?-|m[xytblrse]?-|text-|bg-|border|rounded|shadow|gap-|items-|justify-|content-|col-|row-|space-|font-|leading-|tracking-|opacity-|z-|inset-|top-|left-|right-|bottom-|max-w-|min-w-|max-h-|min-h-|order-|flex-|basis-|self-|place-|overflow-|underline|no-underline|sr-only|not-sr-only|ring|outline|translate-|scale-|rotate-|fill-|stroke-|cursor-|transition|duration-|ease-|aspect-|object-|columns-)[\w[\]/.%-]*$/;
  var TW_ARBITRARY = /^-?[a-z][a-z0-9-]*-\[[^\]\s]+\]$/;
  var TW_OPACITY_OR_FRACTION = /^(?:bg|text|border|ring|w|h|inset|top|left|right|bottom|translate-[xy])-[a-z0-9]+\/\d{1,3}$/;
  var TW_SPECIFIC = /^(?:space-[xy]-\d+|tracking-(?:tighter|tight|wide|wider|widest)|leading-(?:none|tight|snug|relaxed|loose)|text-(?:xs|sm|base|lg|[2-9]?xl)|items-(?:center|start|end|baseline)|justify-(?:between|around|evenly)|rounded-(?:md|lg|xl|2xl|3xl)|shadow-(?:md|xl|2xl)|min-h-screen|max-w-(?:xs|sm|md|lg|xl|[2-7]xl|prose))$/;
  var GENERIC_UTIL = /^(?:flex|grid|block|hidden|p[xy]?-\d|m[xy]?-\d|mt-\d|mb-\d|rounded|shadow|text-center|gap-\d)$/;
  // styled-components class hashes: sc- plus a mixed-case alphabetic id (sc-bdVaJa)
  var SC_HASH = /^sc-(?=[a-zA-Z]*[A-Z])(?=[a-zA-Z]*[a-z])[a-zA-Z]{4,12}$/;

  function probeDomFlags(doc) {
    var flags = [];
    var pairs = [
      ['script#__NEXT_DATA__', 'script#__NEXT_DATA__'],
      ['#__next', '#__next'],
      ['next-route-announcer', 'next-route-announcer'],
      ['[data-nextjs-scroll-focus-boundary]', '[data-nextjs-scroll-focus-boundary]'],
      ['[data-next-page]', '[data-next-page]'],
      ['[data-reactroot]', '[data-reactroot]'],
      ['[data-reactid]', '[data-reactid]'],
      ['[ng-version]', '[ng-version]'],
      ['[ng-app],[data-ng-app]', '[ng-app]'],
      ['#__nuxt', '#__nuxt'],
      ['[data-sveltekit-hydrate]', '[data-sveltekit-hydrate]'],
      // Vue 3 stamps data-v-app on the container it mounts into
      ['[data-v-app]', '[data-v-app]'],
      ['[class*="svelte-"]', '.svelte-'],
      ['[class*="MuiButton-"],[class*="MuiBox-"]', '[class*="MuiButton-"]'],
      ['[data-netlify]', '[data-netlify]'],
      ['.container-fluid, .btn-primary, .modal-dialog', '.btn-primary'],
      ['[data-single-spa]', '[data-single-spa]'],
      ['script[type="systemjs-importmap"]', 'script[type="systemjs-importmap"]'],
      ['script[type="importmap"]', 'script[type="importmap"]'],
      ['[data-emotion]', '[data-emotion]'],
      ['[data-styled]', '[data-styled]'],
      ['astro-island', 'astro-island'],
      ['#___gatsby', '#___gatsby'],
      ['[q\\:container]', '[q:container]'],
      ['html[data-wf-site]', 'html[data-wf-site]'],
      ['[data-framer-name]', '[data-framer-name]'],
      ['[x-data]', '[x-data]'],
      ['[hx-get],[hx-post],[hx-trigger],[data-hx-get],[data-hx-post]', '[hx-get]'],
    ];
    for (var i = 0; i < pairs.length; i++) {
      try {
        if (doc.querySelector(pairs[i][0])) flags.push(pairs[i][1]);
      } catch (_) {
        /* ignore */
      }
    }
    try {
      var ng = doc.querySelector('[ng-version]');
      var v = ng && ng.getAttribute('ng-version');
      if (v) flags.push('ng-version:' + v.slice(0, 64));
    } catch (_) {
      /* ignore */
    }

    // One bounded walk for everything that needs per-element inspection.
    // Attribute-NAME prefixes (data-v-<hash>, _ngcontent-<id>, data-astro-cid-<id>)
    // cannot be expressed as CSS selectors, so they are checked here.
    var seen = { dataV: false, ng: false, astro: false, sc: false };
    var twStrong = 0;
    var twGeneric = 0;
    try {
      var root = doc.body || doc.documentElement;
      var walker = doc.createTreeWalker(root, 1 /* NodeFilter.SHOW_ELEMENT */);
      var n = 0;
      var el = walker.currentNode;
      while (el && n < SCAN_BUDGET) {
        n++;
        var attrs = el.attributes;
        if (attrs) {
          for (var j = 0; j < attrs.length; j++) {
            var name = attrs[j].name;
            if (!seen.dataV && name.length > 7 && name.indexOf('data-v-') === 0) seen.dataV = true;
            else if (!seen.ng && (name.indexOf('_ngcontent-') === 0 || name.indexOf('_nghost-') === 0)) seen.ng = true;
            else if (!seen.astro && name.indexOf('data-astro-cid-') === 0) seen.astro = true;
          }
        }
        var cls = typeof el.className === 'string' ? el.className : el.getAttribute && el.getAttribute('class');
        if (cls) {
          var tokens = cls.split(/\s+/);
          var strong = false;
          var generic = false;
          for (var k = 0; k < tokens.length; k++) {
            var t = tokens[k];
            if (!t) continue;
            if (!seen.sc && SC_HASH.test(t)) seen.sc = true;
            if (!strong && (TW_VARIANT.test(t) || TW_ARBITRARY.test(t) || TW_PALETTE.test(t) || TW_OPACITY_OR_FRACTION.test(t) || TW_SPECIFIC.test(t))) {
              strong = true;
            }
            if (!generic && GENERIC_UTIL.test(t)) generic = true;
          }
          if (strong) twStrong++;
          if (strong || generic) twGeneric++;
        }
        el = walker.nextNode();
      }
    } catch (_) {
      /* ignore */
    }
    if (seen.dataV) flags.push('[data-v-]');
    if (seen.ng) flags.push('[_ngcontent-]');
    if (seen.astro) flags.push('[data-astro-]');
    if (seen.sc) flags.push('[sc-]');
    if (twStrong >= 4) flags.push('tailwind-syntax');
    if (twGeneric >= 8) flags.push('tailwind-utilities');

    // Tailwind's own CSS defines --tw-* custom properties (v3 on every element
    // via the base layer, v4 via @property registrations). Computed styles are
    // shared DOM state, so the isolated world can read them.
    try {
      var probeEls = [doc.body, doc.querySelector('[class]')];
      var names = ['--tw-ring-offset-width', '--tw-border-style', '--tw-shadow', '--tw-translate-x', '--tw-font-weight'];
      outer: for (var p = 0; p < probeEls.length; p++) {
        if (!probeEls[p]) continue;
        var cs = getComputedStyle(probeEls[p]);
        for (var m = 0; m < names.length; m++) {
          if (cs.getPropertyValue(names[m]).trim()) {
            flags.push('tailwind-vars');
            break outer;
          }
        }
      }
    } catch (_) {
      /* ignore */
    }
    return flags;
  }

  function dedupe(arr) {
    return Array.from(new Set(arr.filter(Boolean)));
  }

  /** Inline scripts that execute. JSON / ld+json data islands carry page text, not code. */
  function isExecutableScript(el) {
    var type = (el.getAttribute('type') || '').trim().toLowerCase();
    return (
      type === '' ||
      type === 'module' ||
      type === 'text/javascript' ||
      type === 'application/javascript' ||
      type === 'text/ecmascript'
    );
  }

  function collectLightSignals() {
    var doc = document;
    var scripts = [];
    var inlineSamples = [];

    doc.querySelectorAll('script[src]').forEach(function (el) {
      var src = el.getAttribute('src');
      if (src) scripts.push(src);
    });

    doc.querySelectorAll('link[href]').forEach(function (el) {
      var rel = (el.getAttribute('rel') || '').toLowerCase();
      var as = (el.getAttribute('as') || '').toLowerCase();
      var href = el.getAttribute('href');
      if (!href) return;
      if (rel.indexOf('modulepreload') !== -1 || rel === 'preload' || rel === 'prefetch') {
        scripts.push(href);
      }
      if (as === 'script' || as === 'style') scripts.push(href);
    });

    doc.querySelectorAll('script').forEach(function (el) {
      var id = el.getAttribute('id');
      if (id) scripts.push('inline:#' + id.slice(0, 80));
      // Cap count as well as size — a page with hundreds of inline scripts
      // must not turn one scan message into megabytes.
      if (!el.getAttribute('src') && inlineSamples.length < 40 && isExecutableScript(el)) {
        var text = (el.textContent || '').slice(0, 8000);
        if (text.trim()) inlineSamples.push(text);
      }
    });

    try {
      var perf = performance.getEntriesByType ? performance.getEntriesByType('resource') : [];
      var limit = Math.min(perf.length, 600);
      for (var i = 0; i < limit; i++) {
        if (perf[i] && perf[i].name) scripts.push(String(perf[i].name).slice(0, 2000));
      }
    } catch (_) {
      /* ignore */
    }

    var stylesheets = [];
    doc.querySelectorAll('link[rel="stylesheet"][href]').forEach(function (el) {
      var href = el.getAttribute('href');
      if (href) stylesheets.push(href);
    });

    var metas = [];
    // Only named meta pairs (never body text)
    doc.querySelectorAll('meta[name], meta[property]').forEach(function (el) {
      var name = el.getAttribute('name') || el.getAttribute('property') || '';
      var content = el.getAttribute('content') || '';
      if (name && metas.length < 80) metas.push(name + '=' + content.slice(0, 200));
    });

    var cookies = [];
    try {
      String(doc.cookie || '')
        .split(';')
        .forEach(function (part) {
          var name = part.trim().split('=')[0];
          if (name && cookies.length < 100) cookies.push(name);
        });
    } catch (_) {
      /* ignore */
    }

    // No `html` field: the engine takes evidence from probed flags and
    // collected asset URLs only, never from the page's HTML as text.
    return {
      url: location.href,
      scripts: dedupe(scripts).slice(0, 800),
      stylesheets: dedupe(stylesheets).slice(0, 200),
      cookies: cookies,
      metas: metas,
      inlineSamples: inlineSamples,
      domFlags: probeDomFlags(doc),
      globals: {},
      pass: 'light',
    };
  }

  function postLight() {
    // Prerendered documents are not what the user is looking at.
    if (document.prerendering) return;
    var signals;
    try {
      signals = collectLightSignals();
    } catch (_) {
      return;
    }
    try {
      // MV3 sendMessage returns a promise that rejects when the worker is
      // asleep or the context was invalidated. try/catch can't see that, so it
      // would surface as an unhandled rejection in the page console.
      var p = chrome.runtime.sendMessage({ type: 'LIGHT_SCAN', signals: signals });
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (_) {
      /* extension context invalidated */
    }
  }

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (!msg || !msg.type) return;
    if (msg.type === 'COLLECT_SIGNALS') {
      var signals = null;
      try {
        signals = collectLightSignals();
      } catch (_) {
        /* respond without signals */
      }
      sendResponse(signals ? { ok: true, signals: signals } : { ok: false });
      return true;
    }
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    postLight();
  } else {
    window.addEventListener('DOMContentLoaded', postLight, { once: true });
  }

  // Late resources (Next chunks, hydration, deferred analytics) arrive after
  // idle — post again at +1.5s and +5s. Each post triggers a background deep pass.
  setTimeout(postLight, 1500);
  setTimeout(postLight, 5000);

  // Back/forward cache restores the old document without re-running this script.
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) postLight();
  });
  // A prerendered page becoming the visible one.
  document.addEventListener('prerenderingchange', postLight, { once: true });

  // SPA route changes. Do NOT patch history.pushState/replaceState here — this
  // is an isolated world, so the page's own calls never hit our wrapper.
  // chrome.tabs.onUpdated covers history navigations from the service worker;
  // popstate does reach the isolated world, so it stays.
  var lastUrl = location.href;
  window.addEventListener('popstate', function () {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      postLight();
    }
  });
})();
