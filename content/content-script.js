/**
 * WhatStack content script — isolated world, classic script (no imports).
 * Collects light page signals (DOM, scripts, resources, inline markers).
 */
(function () {
  'use strict';

  function probeDomFlags(doc) {
    const flags = [];
    const pairs = [
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
      ['.container-fluid, .btn-primary, .modal-dialog', '.btn-primary'],
      ['[data-single-spa]', '[data-single-spa]'],
      ['script[type="systemjs-importmap"]', 'script[type="systemjs-importmap"]'],
      ['script[type="importmap"]', 'script[type="importmap"]'],
      ['[data-emotion]', '[data-emotion]'],
      ['[data-styled]', '[data-styled]'],
    ];
    for (const [selector, flag] of pairs) {
      try {
        if (doc.querySelector(selector)) flags.push(flag);
      } catch (_) {
        /* ignore */
      }
    }
    try {
      const ng = doc.querySelector('[ng-version]');
      if (ng) {
        const v = ng.getAttribute('ng-version');
        if (v) flags.push('ng-version:' + v);
      }
    } catch (_) {
      /* ignore */
    }
    try {
      const all = doc.querySelectorAll('[class]');
      const utilRe =
        /\b(flex|grid|items-center|justify-between|bg-\w+|text-\w+|p-\d|px-\d|py-\d|m-\d|rounded|shadow)\b/;
      let utilityHits = 0;
      const limit = Math.min(all.length, 80);
      for (let i = 0; i < limit; i++) {
        const c = all[i].getAttribute('class') || '';
        if (utilRe.test(c)) utilityHits++;
      }
      if (utilityHits >= 8) flags.push('tailwind-utilities');
    } catch (_) {
      /* ignore */
    }
    return flags;
  }

  function dedupe(arr) {
    return Array.from(new Set(arr.filter(Boolean)));
  }

  function collectLightSignals() {
    const doc = document;
    const scripts = [];
    const inlineSamples = [];

    doc.querySelectorAll('script[src]').forEach(function (el) {
      const src = el.getAttribute('src');
      if (src) scripts.push(src);
    });

    doc.querySelectorAll('link[href]').forEach(function (el) {
      const rel = (el.getAttribute('rel') || '').toLowerCase();
      const as = (el.getAttribute('as') || '').toLowerCase();
      const href = el.getAttribute('href');
      if (!href) return;
      if (rel.indexOf('modulepreload') !== -1 || rel === 'preload' || rel === 'prefetch') {
        scripts.push(href);
      }
      if (as === 'script' || as === 'style') scripts.push(href);
    });

    doc.querySelectorAll('script').forEach(function (el) {
      const id = el.getAttribute('id');
      if (id) scripts.push('inline:#' + id);
      if (!el.getAttribute('src')) {
        const text = (el.textContent || '').slice(0, 8000);
        if (text.trim()) inlineSamples.push(text);
      }
    });

    try {
      const perf = performance.getEntriesByType
        ? performance.getEntriesByType('resource')
        : [];
      for (let i = 0; i < perf.length; i++) {
        if (perf[i] && perf[i].name) scripts.push(String(perf[i].name));
      }
    } catch (_) {
      /* ignore */
    }

    const stylesheets = [];
    doc.querySelectorAll('link[rel="stylesheet"][href]').forEach(function (el) {
      const href = el.getAttribute('href');
      if (href) stylesheets.push(href);
    });

    const metas = [];
    // Only named meta pairs (never body text)
    doc.querySelectorAll('meta[name], meta[property]').forEach(function (el) {
      const name = el.getAttribute('name') || el.getAttribute('property') || '';
      const content = el.getAttribute('content') || '';
      if (name) metas.push(name + '=' + content);
    });

    const cookies = [];
    try {
      String(doc.cookie || '')
        .split(';')
        .forEach(function (part) {
          const name = part.trim().split('=')[0];
          if (name) cookies.push(name);
        });
    } catch (_) {
      /* ignore */
    }

    const html = doc.documentElement
      ? doc.documentElement.outerHTML.slice(0, 500000)
      : '';

    return {
      url: location.href,
      html: html,
      scripts: dedupe(scripts),
      stylesheets: dedupe(stylesheets),
      cookies: cookies,
      metas: metas,
      inlineSamples: inlineSamples,
      domFlags: probeDomFlags(doc),
      globals: {},
      pass: 'light',
    };
  }

  function postLight() {
    const signals = collectLightSignals();
    try {
      chrome.runtime.sendMessage({ type: 'LIGHT_SCAN', signals: signals });
    } catch (_) {
      /* extension context invalidated */
    }
  }

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (!msg || !msg.type) return;
    if (msg.type === 'COLLECT_SIGNALS') {
      sendResponse({ ok: true, signals: collectLightSignals() });
      return true;
    }
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    postLight();
  } else {
    window.addEventListener('DOMContentLoaded', postLight, { once: true });
  }

  // Late resources (Next chunks) often appear after idle — rescan once
  setTimeout(postLight, 1500);

  let lastUrl = location.href;
  const notifyIfUrlChanged = function () {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      postLight();
    }
  };
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function () {
    const r = origPush.apply(this, arguments);
    queueMicrotask(notifyIfUrlChanged);
    return r;
  };
  history.replaceState = function () {
    const r = origReplace.apply(this, arguments);
    queueMicrotask(notifyIfUrlChanged);
    return r;
  };
  window.addEventListener('popstate', notifyIfUrlChanged);
})();
