/**
 * One test per confirmed finding in docs/AUDIT-2026-09.md. Each reproduces the
 * input that produced a wrong answer in 1.7.2 and pins the corrected outcome.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detect, extractVersions, normalizeVersion, stripQuery, siteOf } from '../shared/detect.js';
import { buildHeadline, formatStackMarkdown, formatStackJson, formatReportBody, shapeForPopup } from '../shared/result-shape.js';

const base = () => ({
  url: 'https://example.com/',
  pass: 'deep',
  scripts: [],
  stylesheets: [],
  cookies: [],
  metas: [],
  inlineSamples: [],
  domFlags: [],
  globals: {},
});
const run = (over) => detect({ ...base(), ...over });
const ids = (r) => r.hits.map((h) => h.id);
const hit = (r, id) => r.hits.find((h) => h.id === id);

describe('C1 — window.next is a version hint, never proof', () => {
  it('a lone window.next with a version is not Next.js (linear.app, 1.7.2 said Next.js HIGH v1.0.0-beta.9)', () => {
    const r = run({ globals: { next: { present: true, version: '1.0.0-beta.9' } } });
    assert.deepEqual(ids(r), []);
  });

  it('a clobbered <a id="next"> (window.next without a version) is not Next.js', () => {
    const r = run({ globals: { next: { present: true } } });
    assert.deepEqual(ids(r), []);
  });

  it('a real /_next/ asset keeps Next.js, but an out-of-range window.next.version is not shown', () => {
    const r = run({
      scripts: ['https://static.linear.app/web/_next/static/chunks/C_JJxWoe.js'],
      globals: { next: { present: true, version: '1.0.0-beta.9' } },
    });
    const n = hit(r, 'nextjs');
    assert.equal(n.confidence, 'high');
    assert.equal(n.version, undefined);
  });

  it('an in-range App Router version is still read', () => {
    const r = run({
      scripts: ['/_next/static/chunks/main-app.js'],
      globals: { next: { present: true, version: '16.4.0-canary.38' } },
    });
    assert.equal(hit(r, 'nextjs').version, '16.4.0-canary.38');
  });

  it('a pagination cursor {"next":"1700000000.5"} is not a Next.js version', () => {
    const r = run({ scripts: ['/_next/static/chunks/main.js'], inlineSamples: ['{"next":"1700000000.5"}'] });
    assert.equal(hit(r, 'nextjs').version, undefined);
  });
});

describe('C4 — URL rules match host and path, never the query or an unrelated word', () => {
  it('an image or search URL naming vendors fires nothing', () => {
    const r = run({
      scripts: [
        'https://example.com/img/logrocket-vs-zendesk.png',
        'https://example.com/api/search?q=qiankun+razorpay+launchdarkly',
        'https://example.com/blog/styled-components-vs-emotion.jpg',
        'https://example.com/img/turbopack-benchmarks.png',
      ],
    });
    assert.deepEqual(ids(r), []);
  });

  it("Clerk's own bootstrap.js loader is not the Bootstrap framework", () => {
    const r = run({ scripts: ['https://cdn.protect.clerk.com/ins_1/c/1-abc/bootstrap.js?v=6.34.1'] });
    assert.equal(hit(r, 'bootstrap'), undefined);
  });

  it('the real Bootstrap bundle and CSS still match', () => {
    const r = run({
      scripts: ['https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'],
      stylesheets: ['https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css'],
    });
    assert.equal(hit(r, 'bootstrap').confidence, 'high');
    assert.equal(hit(r, 'bootstrap').version, '5.3.3');
  });

  it('query strings are stripped from evidence (tokens stay out of exports and reports)', () => {
    const r = run({ scripts: ['https://js.stripe.com/v3/?session=secret-token'] });
    const ev = hit(r, 'stripe').evidence.find((e) => e.type === 'script');
    assert.equal(ev.snippet, 'https://js.stripe.com/v3/');
  });

  it('rules that need the query opt in (Vercel ?dpl=)', () => {
    const r = run({ scripts: ['https://example.com/_next/static/chunks/a.js?dpl=dpl_abc123'] });
    assert.ok(hit(r, 'vercel'));
  });

  it('a /graphql API endpoint is not the graphql package', () => {
    assert.equal(hit(run({ scripts: ['https://api.example.com/graphql'] }), 'graphql'), undefined);
  });

  it('loading from cdnjs does not mean the site is hosted on Cloudflare', () => {
    const r = run({ scripts: ['https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js'] });
    assert.equal(hit(r, 'cloudflare'), undefined);
  });
});

describe('C5 — prose in data islands and strings is never an install', () => {
  it('a blog post about micro-frontends fires no MFE rule', () => {
    const r = run({
      inlineSamples: [
        '{"title":"Migrating to single-spa and module federation with qiankun"}',
        'document.title = "Why we chose single-spa over qiankun";',
      ],
    });
    assert.deepEqual(ids(r), []);
  });

  it('real registration code still fires', () => {
    const r = run({ inlineSamples: ['singleSpa.registerApplication({ name: "nav", app: () => import("nav") });'] });
    assert.ok(hit(r, 'single-spa'));
    assert.ok(hit(r, 'microfrontend'));
  });
});

describe('C6 — Tailwind', () => {
  it('generic utility-class soup alone is low (1.7.2 double-counted it to medium)', () => {
    const r = run({ domFlags: ['tailwind-utilities'] });
    assert.equal(hit(r, 'tailwind').confidence, 'low');
    assert.equal(hit(r, 'tailwind').evidence.length, 1);
  });

  it('Tailwind-only syntax is medium; --tw-* variables are high', () => {
    assert.equal(hit(run({ domFlags: ['tailwind-syntax'] }), 'tailwind').confidence, 'medium');
    assert.equal(hit(run({ domFlags: ['tailwind-vars'] }), 'tailwind').confidence, 'high');
  });
});

describe('C7 — versions come from the right package', () => {
  const v = (scripts, globals = {}) => extractVersions({ ...base(), scripts, globals });

  it('@remix-run/react@2.12.0 is not React 2.12.0', () => {
    assert.equal(v(['https://esm.sh/@remix-run/react@2.12.0']).react, undefined);
    assert.equal(v(['https://esm.sh/@remix-run/react@2.12.0']).remix, '2.12.0');
  });

  it('@tanstack/react-router is neither React Router nor its version', () => {
    const r = run({ scripts: ['https://esm.sh/@tanstack/react-router@1.58.0'], globals: { __reactRenderer: { present: true } } });
    assert.equal(hit(r, 'react-router'), undefined);
    assert.equal(hit(r, 'tanstack-router').version, '1.58.0');
  });

  it('react-bootstrap / bootstrap-icons versions are not Bootstrap versions', () => {
    const out = v([
      'https://cdn.jsdelivr.net/npm/react-bootstrap@2.10.2/dist/react-bootstrap.min.js',
      'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
    ]);
    assert.equal(out.bootstrap, undefined);
  });

  it('preact-10.19.js is not React 10.19', () => {
    assert.equal(v(['/js/preact-10.19.js']).react, undefined);
  });

  it('prefers a real React version, and rejects implausible majors', () => {
    assert.equal(v(['https://unpkg.com/react@18.2.0/umd/react.production.min.js']).react, '18.2.0');
    assert.equal(v([], { React: { present: true, version: '2.0.0' } }).react, undefined);
  });

  it('build metadata is dropped, prerelease kept', () => {
    assert.equal(normalizeVersion('22.2.0+sha-14793bf'), '22.2.0');
    assert.equal(normalizeVersion('16.4.0-canary.38'), '16.4.0-canary.38');
    assert.equal(normalizeVersion('5'), '5');
    assert.equal(normalizeVersion({ toString: () => '9.9.9' }), null, 'never stringifies page objects');
  });
});

describe('C8 — weak rules stay weak', () => {
  it('/api/auth/session alone is low, not NextAuth medium', () => {
    const r = run({ scripts: ['https://example.com/api/auth/session'] });
    assert.equal(hit(r, 'nextauth').confidence, 'low');
  });
});

describe('C11 — first-party vs third-party build tools', () => {
  it('a build tool seen only in another site\'s scripts is low', () => {
    const r = run({ url: 'https://shop.example.com/', scripts: ['https://widget.vendor.io/assets/parcel-runtime-abc.js'] });
    assert.equal(hit(r, 'parcel').confidence, 'low');
  });

  it('a conflicting bundler global on a Next.js page is low (embedded widget)', () => {
    const r = run({ scripts: ['/_next/static/chunks/main.js'], globals: { parcelRequire: { present: true } } });
    assert.equal(hit(r, 'parcel').confidence, 'low');
  });

  it('siteOf handles multi-part TLDs', () => {
    assert.equal(siteOf('www.hj.contentsquare.com'), 'contentsquare.com');
    assert.equal(siteOf('shop.example.co.in'), 'example.co.in');
    assert.equal(siteOf('example.com'), 'example.com');
  });
});

describe('R6 / L1 — result shaping', () => {
  it('headline never exceeds 5 parts', () => {
    const hits = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((x, i) => ({
      id: x,
      name: x.toUpperCase(),
      category: i < 2 ? 'framework' : 'build',
      confidence: 'high',
      evidence: [],
    }));
    assert.equal(buildHeadline(hits, null).headlineParts.length, 5);
  });

  it('Markdown cells cannot break the table', () => {
    const shaped = shapeForPopup({
      url: 'https://x.test/',
      pass: 'deep',
      primary: null,
      hits: [{ id: 'x', name: 'Evil | Name\nrow', category: 'framework', confidence: 'high', version: '1|2', evidence: [{ type: 'global', snippet: 's', weight: 5 }] }],
    });
    const md = formatStackMarkdown(shaped);
    const row = md.split('\n').find((l) => l.startsWith('| Evil'));
    assert.ok(md.split('\n').every((l) => !l.startsWith('row')), 'no line break leaks');
    assert.equal(row.split(/(?<!\\)\|/).length - 2, 4, 'exactly 4 cells');
  });

  it('JSON export carries a schema version', () => {
    const json = JSON.parse(formatStackJson(shapeForPopup({ url: '', pass: 'deep', hits: [], primary: null })));
    assert.equal(json.schemaVersion, 1);
  });

  it('report evidence drops query strings and neutralises backticks', () => {
    const shaped = shapeForPopup({
      url: 'https://x.test/a?b=c',
      pass: 'deep',
      primary: null,
      hits: [{ id: 'x', name: 'X', category: 'framework', confidence: 'high', evidence: [{ type: 'inline', snippet: 'a`b https://t.test/x.js?token=abc', weight: 5 }] }],
    });
    const body = formatReportBody(shaped, { version: '1.8.0' });
    assert.ok(!body.includes('token=abc'));
    assert.ok(!/`a`b/.test(body));
  });

  it('stripQuery keeps inline markers and paths', () => {
    assert.equal(stripQuery('inline:#__NEXT_DATA__'), 'inline:#__NEXT_DATA__');
    assert.equal(stripQuery('https://a.test/x.js?v=1#h'), 'https://a.test/x.js');
  });
});
