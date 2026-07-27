import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detect } from '../shared/detect.js';
import {
  shapeForPopup,
  reportOrigin,
  formatReportBody,
  buildReportUrl,
  REPORT_REPO,
} from '../shared/result-shape.js';

const base = {
  pass: 'deep',
  scripts: [],
  stylesheets: [],
  cookies: [],
  metas: [],
  inlineSamples: [],
  domFlags: [],
  html: '',
  globals: {},
};

/** A page shaped like x.com: React via fiber keys, Webpack, Cloudflare. */
function scannedPage() {
  return shapeForPopup(
    detect({
      ...base,
      url: 'https://x.com/someuser/status/2081260564639363568?s=46&token=secret',
      scripts: [
        'https://abs.twimg.com/responsive-web/client-web/main.abc123.js',
        'https://x.com/cdn-cgi/challenge-platform/h/b/scripts/jsd/main.js',
      ],
      inlineSamples: ['webpackJsonp'],
      globals: { __reactFiber: { present: true } },
    }),
  );
}

describe('report origin never leaks the path or query', () => {
  it('reduces a deep URL to its origin', () => {
    assert.equal(
      reportOrigin('https://x.com/user/status/123?s=46&token=secret'),
      'https://x.com',
    );
  });

  it('keeps a non-default port, which identifies a local dev server', () => {
    assert.equal(reportOrigin('http://localhost:3000/admin/users'), 'http://localhost:3000');
  });

  it('refuses non-http(s) and unparseable input', () => {
    for (const bad of ['chrome://extensions', 'file:///Users/me/secret.html', 'not a url', '']) {
      assert.equal(reportOrigin(bad), '', `leaked for ${bad}`);
    }
  });
});

describe('report body', () => {
  it('carries the evidence but not the full URL', () => {
    const body = formatReportBody(scannedPage(), { version: '1.7.2', browser: 'Chrome 141' });
    assert.match(body, /\*\*Site:\*\* https:\/\/x\.com$/m);
    assert.doesNotMatch(body, /token=secret/);
    assert.doesNotMatch(body, /2081260564639363568/);
    assert.match(body, /React/);
    assert.match(body, /__reactFiber/);
    assert.match(body, /\*\*WhatStack:\*\* 1\.7\.2/);
    assert.match(body, /Chrome 141/);
  });

  it('still produces a usable report when nothing was detected', () => {
    const shaped = shapeForPopup(detect({ ...base, url: 'https://plain.example/' }));
    assert.ok(shaped.empty, 'fixture should detect nothing');
    const body = formatReportBody(shaped, { version: '1.7.2' });
    assert.match(body, /Missed something the site does use/);
    assert.match(body, /Nothing was detected/);
  });

  it('escapes pipes so evidence cannot break the table', () => {
    const shaped = shapeForPopup({
      url: 'https://e.example/',
      pass: 'deep',
      primary: null,
      hits: [
        {
          id: 'react',
          name: 'React',
          category: 'framework',
          confidence: 'high',
          evidence: [{ type: 'inline', snippet: 'a|b|c', weight: 5 }],
        },
      ],
    });
    const row = formatReportBody(shaped)
      .split('\n')
      .find((l) => l.startsWith('| React |'));
    assert.ok(row, 'expected a table row for React');
    assert.ok(row.includes('a\\|b\\|c'), `pipes not escaped: ${row}`);
  });
});

describe('report URL', () => {
  it('points at the repo issue form with a prefilled title and body', () => {
    const url = new URL(buildReportUrl(scannedPage(), { version: '1.7.2' }));
    assert.equal(`${url.origin}${url.pathname}`, `${REPORT_REPO}/issues/new`);
    assert.equal(url.searchParams.get('labels'), 'detection');
    assert.match(url.searchParams.get('title'), /^Wrong detection on x\.com: React/);
    assert.match(url.searchParams.get('body'), /__reactFiber/);
  });

  it('never exceeds what GitHub will accept', () => {
    // 60 hits, each with long evidence — far past any real page.
    const hits = Array.from({ length: 60 }, (_, i) => ({
      id: `tech-${i}`,
      name: `Tech ${i}`,
      category: 'framework',
      confidence: 'high',
      evidence: Array.from({ length: 6 }, () => ({
        type: 'script',
        snippet: 'x'.repeat(300),
        weight: 3,
      })),
    }));
    const url = buildReportUrl(
      shapeForPopup({ url: 'https://big.example/', pass: 'deep', primary: null, hits }),
      { version: '1.7.2' },
    );
    assert.ok(url.length <= 6000, `url was ${url.length} chars`);
    assert.match(url, /^https:\/\/github\.com\//);
  });

  it('omits the site rather than guessing when the URL is unusable', () => {
    const shaped = shapeForPopup(detect({ ...base, url: 'chrome://extensions' }));
    const body = new URL(buildReportUrl(shaped)).searchParams.get('body');
    assert.match(body, /\*\*Site:\*\* _not shared_/);
    assert.doesNotMatch(body, /chrome:\/\//);
  });
});
