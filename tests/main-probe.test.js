/**
 * Runs the REAL MAIN-world probe (shared/detect.js mainWorldProbeSource) in a
 * node:vm realm with a minimal fake window + DOM. Until 1.8.0 the probe was
 * never executed by any test: fixtures hand-wrote the globals it was assumed to
 * return. These tests pin what it actually returns — including on hostile pages.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { mainWorldProbeSource, detect, mergeDeepSignals } from '../shared/detect.js';

const SOURCE = `(${mainWorldProbeSource().toString()})()`;

/**
 * @param {(ctx: any) => Record<string, unknown>} setup page globals, given the realm's Node/HTMLElement
 * @param {{ elements?: Record<string, object>, body?: object, documentKeys?: Record<string, unknown> }} [dom]
 */
function probe(setup, dom = {}) {
  const ctx = vm.createContext({});
  vm.runInContext(
    `
    class Node {}
    class Element extends Node { constructor(attrs = {}) { super(); this._attrs = attrs; } getAttribute(n) { return this._attrs[n] ?? null; } }
    class HTMLCollection {}
    class NodeList {}
    globalThis.Node = Node; globalThis.Element = Element; globalThis.HTMLCollection = HTMLCollection; globalThis.NodeList = NodeList;
  `,
    ctx,
  );
  const elements = dom.elements || {};
  const body = dom.body || vm.runInContext('new Element()', ctx);
  if (!body.children) body.children = [];
  const document = vm.runInContext('new Node()', ctx);
  Object.assign(document, dom.documentKeys || {});
  document.body = body;
  document.querySelector = (sel) => elements[sel] || null;
  ctx.document = document;
  ctx.window = ctx;
  Object.assign(ctx, setup(ctx));
  // Round-trip through JSON: the real probe result is structured-cloned, and
  // this also makes cross-realm objects comparable with deepEqual.
  return JSON.parse(JSON.stringify(vm.runInContext(SOURCE, ctx)));
}
const el = (ctx, props = {}, attrs = {}) => Object.assign(vm.runInContext(`new Element(${JSON.stringify(attrs)})`, ctx), props);

describe('MAIN-world probe (executed)', () => {
  it('returns an empty object on a plain page', () => {
    assert.deepEqual(probe(() => ({})), {});
  });

  it('ignores DOM-clobbered globals (<a id="next">, <div id="bootstrap">, <form name="Stripe">…)', () => {
    const out = probe((ctx) => ({
      next: el(ctx),
      bootstrap: el(ctx),
      axios: el(ctx),
      ng: el(ctx),
      Stripe: el(ctx),
      Sentry: el(ctx),
      LogRocket: el(ctx),
      __FEDERATION__: el(ctx),
      __NEXT_DATA__: el(ctx),
      Clerk: el(ctx),
    }));
    assert.deepEqual(out, {});
  });

  it('one throwing getter costs that detector only', () => {
    const out = probe(() => {
      const jq = function () {};
      Object.defineProperty(jq, 'fn', { get() { throw new Error('boom'); } });
      return {
        Vue: new Proxy({}, { get() { throw new Error('trap'); } }),
        jQuery: jq,
        __NEXT_DATA__: { props: {} },
        __next_f: [],
        Stripe: function Stripe() {},
      };
    });
    assert.ok(out.__NEXT_DATA__);
    assert.ok(out.__next_f);
    assert.ok(out.Stripe);
    assert.equal(out.Vue, undefined);
    assert.equal(out.jQuery, undefined);
  });

  it('never calls page toString and clips page strings', () => {
    let called = false;
    const out = probe(() => ({
      next: { version: { toString() { called = true; return '14.0.0'; } } },
      React: { version: 'x'.repeat(10_000), createElement() {} },
    }));
    assert.equal(called, false);
    assert.equal(out.next.version, undefined);
    assert.equal(out.React.version.length, 64);
  });

  it('reads window.next only as a hint; detect() does not call it Next.js', () => {
    const globals = probe(() => ({ next: { version: '1.0.0-beta.9', appDir: true } }));
    assert.equal(globals.next.version, '1.0.0-beta.9');
    const r = detect(mergeDeepSignals({ url: 'https://linear.test/', scripts: [], domFlags: [] }, globals));
    assert.equal(r.hits.find((h) => h.id === 'nextjs'), undefined);
  });

  it('prefers the react-dom renderer version over third-party reconcilers', () => {
    const renderers = new Map([
      [1, { version: '4.3.0', rendererPackageName: 'react-pdf' }],
      [2, { version: '19.1.0', rendererPackageName: 'react-dom' }],
    ]);
    const out = probe(() => ({ __REACT_DEVTOOLS_GLOBAL_HOOK__: { renderers } }));
    assert.equal(out.__reactRenderer.version, '19.1.0');
    assert.equal(out.__reactRenderer.count, 2);
  });

  it('a bare DevTools hook with no renderer is not React', () => {
    assert.deepEqual(probe(() => ({ __REACT_DEVTOOLS_GLOBAL_HOOK__: { renderers: new Map() } })), {});
  });

  it('finds React from _reactListening on document (bundled apps, no DevTools)', () => {
    const out = probe(() => ({}), { documentKeys: { _reactListeningobuqzpntaja: true } });
    assert.ok(out.__reactListening);
  });

  it('finds a React container expando on #root', () => {
    const out = probe(() => ({}), {
      elements: { '#root': { '__reactContainer$abc': { current: {} } } },
    });
    assert.ok(out.__reactContainer);
  });

  it('reads Vue 3 and Vue 2 mount points', () => {
    assert.equal(probe(() => ({}), { elements: { '#app': { __vue_app__: { version: '3.5.42' } } } }).__vue_app__.version, '3.5.42');
    assert.ok(probe(() => ({}), { elements: { '#app': { __vue__: { _isVue: true } } } }).__vue2__);
  });

  it('uses the real global names: TURBOPACK, __sveltekit_<hash>, __svelte.v, webpackJsonp', () => {
    const out = probe(() => ({
      TURBOPACK: [],
      __sveltekit_1tdg792: {},
      __svelte: { v: new Set(['5']) },
      webpackJsonp: [],
    }));
    assert.ok(out.__turbopack);
    assert.ok(out.__sveltekit);
    assert.equal(out.__svelte.version, '5');
    assert.ok(out.webpackChunk);
  });

  it('requires library shape, not just a truthy global', () => {
    const out = probe(() => ({
      axios: Object.assign(function axios() {}, { get() {}, create() {}, VERSION: '1.7.2' }),
      bootstrap: { Modal: function () {}, Tooltip: function () {} },
      gtag: function () {},
      mixpanel: { track() {} },
      DD_RUM: { init() {} },
      LogRocket: { init() {} },
    }));
    for (const k of ['axios', 'bootstrap', 'gtag', 'mixpanel', 'DD_RUM', 'LogRocket']) assert.ok(out[k], k);
    assert.equal(out.axios.version, '1.7.2');

    const shapeless = probe(() => ({ axios: {}, bootstrap: {}, gtag: {}, mixpanel: {}, DD_RUM: {}, LogRocket: {} }));
    assert.deepEqual(shapeless, {});
  });

  it('detects the 1.8.0 frameworks and platforms from their runtime objects', () => {
    const out = probe(() => ({
      litElementVersions: ['4.1.0'],
      Polymer: Object.assign(function Polymer() {}, { version: '3.5.0' }),
      Ember: { VERSION: '5.8.0' },
      Alpine: { start() {}, version: '3.14.9' },
      htmx: { ajax() {}, process() {}, version: '2.0.3' },
      ___loader: {},
      preact: { h() {}, render() {} },
      Shopify: { shop: 'demo.myshopify.com' },
      posthog: { capture() {} },
      plausible: function () {},
      fathom: { trackPageview() {} },
      amplitude: { track() {} },
    }));
    for (const k of ['litVersions', 'Polymer', 'Ember', 'Alpine', 'htmx', '___gatsby', 'preact', 'Shopify', 'posthog', 'plausible', 'fathom', 'amplitude']) {
      assert.ok(out[k], k);
    }
    assert.equal(out.litVersions.version, '4.1.0');
  });

  it('reads the TanStack Router / Start production globals, with shape checks', () => {
    const out = probe(() => ({
      __TSR_ROUTER__: { routesById: {}, routeTree: {}, buildLocation() {}, navigate() {} },
      __TSS_START_OPTIONS__: { serializationAdapters: [] },
    }));
    assert.ok(out.__TSR_ROUTER__);
    assert.ok(out.__TSS_START_OPTIONS__);
    const fake = probe((ctx) => ({ __TSR_ROUTER__: {}, __TSS_START_OPTIONS__: el(ctx) }));
    assert.deepEqual(fake, {}, 'shapeless or clobbered globals are ignored');
  });

  it('walks the React tree for provider clients that have no global', () => {
    const queryClient = { getQueryCache() {}, getMutationCache() {} };
    const tsRouter = { routesById: {}, buildLocation() {} };
    const rrRouter = { routes: [], navigate() {}, subscribe() {}, state: { location: {} } };
    const store = { dispatch() {}, getState() {}, subscribe() {} };
    const apollo = { watchQuery() {}, query() {}, cache: {} };
    // root → QueryClientProvider → RouterProvider(TanStack) → Provider(redux) → ApolloProvider → sibling RR RouterProvider
    const tree = {
      child: {
        memoizedProps: { client: queryClient },
        child: {
          memoizedProps: { router: tsRouter },
          child: { memoizedProps: { store }, child: { memoizedProps: { client: apollo } } },
          sibling: { memoizedProps: { router: rrRouter } },
        },
      },
    };
    const out = probe(() => ({}), { documentKeys: { '__reactContainer$abc': tree } });
    for (const k of ['__reactContainer', '__tanstackQueryClient', '__tanstackRouterInstance', '__reduxStore', '__APOLLO_CLIENT__', '__reactRouterDataRouter']) {
      assert.ok(out[k], k);
    }
  });

  it('the tree walk ignores look-alikes and stays inside its budget', () => {
    // 20k-node chain with a prop that is NOT a QueryClient (only one of the two methods)
    let node = null;
    for (let i = 0; i < 20000; i++) node = { memoizedProps: { client: { getQueryCache() {} } }, child: node };
    const started = Date.now();
    const out = probe(() => ({}), { documentKeys: { '__reactContainer$x': node } });
    assert.ok(Date.now() - started < 1000);
    assert.equal(out.__tanstackQueryClient, undefined);
  });

  it('empty Redux DevTools and empty NREUM are not detections', () => {
    const out = probe(() => ({ __REDUX_DEVTOOLS_EXTENSION__: function () {}, NREUM: {} }));
    assert.deepEqual(out, {});
  });
});
