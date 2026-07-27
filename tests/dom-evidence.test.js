import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detect } from '../shared/detect.js';

/**
 * Baseline page signals with nothing detectable in them.
 * @param {Partial<import('../shared/detect.js').PageSignals>} over
 */
function page(over = {}) {
  return {
    url: 'https://tutorial.example/guide',
    pass: 'deep',
    scripts: ['/static/site.js'],
    stylesheets: [],
    cookies: [],
    metas: [],
    inlineSamples: [],
    domFlags: [],
    html: '',
    globals: {},
    ...over,
  };
}

/**
 * Markup shown as TEXT inside a code block. documentElement.outerHTML contains
 * these strings, but querySelector finds no such element — so domFlags is empty.
 * None of them may produce a hit.
 */
const displayedMarkup = {
  angular: '<pre>&lt;app-root ng-version="17.0.1"&gt;&lt;/app-root&gt;</pre>',
  react: '<pre>&lt;div data-reactroot&gt;Hello&lt;/div&gt;</pre>',
  nextjs: '<pre>&lt;script id="__NEXT_DATA__"&gt;{}&lt;/script&gt;</pre>',
  nuxt: '<pre>&lt;div id="__nuxt"&gt;&lt;/div&gt;</pre>',
  sveltekit: '<pre>&lt;div data-sveltekit-hydrate="x"&gt;&lt;/div&gt;</pre>',
  emotion: '<pre>&lt;style data-emotion="css"&gt;&lt;/style&gt;</pre>',
  singleSpa: '<pre>&lt;div data-single-spa&gt;&lt;/div&gt;</pre>',
  importmap: '<pre>&lt;script type="importmap"&gt;{}&lt;/script&gt;</pre>',
  styledComponents: '<p>styled-components emits classes like sc-bdVaJa on elements.</p>',
};

describe('DOM evidence comes from probed elements, not the HTML string', () => {
  for (const [label, markup] of Object.entries(displayedMarkup)) {
    it(`does not fire on ${label} markup that is only displayed as text`, () => {
      const result = detect(page({ html: `<html><body>${markup}</body></html>` }));
      assert.equal(
        result.primary,
        null,
        `expected no primary framework, got ${result.primary && result.primary.name}`,
      );
      assert.deepEqual(
        result.hits.map((h) => h.id),
        [],
        `expected no hits, got: ${result.hits.map((h) => `${h.id}(${h.confidence})`).join(', ')}`,
      );
    });
  }

  it('still detects a framework when the element is genuinely present', () => {
    const result = detect(
      page({
        url: 'https://real-app.example/',
        domFlags: ['[ng-version]', 'ng-version:17.0.1'],
        html: '<app-root ng-version="17.0.1"></app-root>',
      }),
    );
    assert.equal(result.primary && result.primary.id, 'angular');
  });

  it('still detects styled-components from a probed sc- class token', () => {
    const result = detect(page({ domFlags: ['[sc-]'] }));
    assert.ok(result.hits.some((h) => h.id === 'styled-components'));
  });
});

describe('asset evidence comes from collected URLs, not the HTML string', () => {
  /**
   * Quotes are NOT entity-escaped in DOM text nodes, so a code sample shown in
   * a <pre> keeps `src="https://unpkg.com/react@18.2.0/..."` verbatim inside
   * outerHTML. Scraping src/href out of signals.html therefore reported
   * high-confidence React v18.2.0 — with a version! — on tutorial pages, and a
   * plain <a href="https://www.hotjar.com"> link fired vendor hits.
   */
  it('ignores script/href URLs that only appear as displayed code or links', () => {
    const displayed =
      '<pre>&lt;script src="https://unpkg.com/react@18.2.0/umd/react.production.min.js"&gt;&lt;/script&gt;</pre>' +
      '<a href="https://www.hotjar.com/pricing">Hotjar</a>' +
      '<a href="https://checkout.razorpay.com/v1/checkout.js">docs</a>' +
      '<a href="https://company.zendesk.com/hc">help center</a>';
    const result = detect(page({ html: `<html><body>${displayed}</body></html>` }));
    assert.deepEqual(
      result.hits.map((h) => h.id),
      [],
      `expected no hits, got: ${result.hits.map((h) => `${h.id}(${h.confidence})`).join(', ')}`,
    );
  });

  it('still detects from genuinely collected asset URLs', () => {
    const result = detect(
      page({
        scripts: [
          'https://unpkg.com/react@18.2.0/umd/react.production.min.js',
          'https://static.hotjar.com/c/hotjar-123.js',
        ],
      }),
    );
    const ids = new Set(result.hits.map((h) => h.id));
    assert.ok(ids.has('react'), 'react from a real CDN script');
    assert.ok(ids.has('hotjar'), 'hotjar from a real loaded asset');
    assert.equal(result.hits.find((h) => h.id === 'react').version, '18.2.0');
  });

  it('detects CSS libraries from perf-collected stylesheet fetches', () => {
    // Perf resource entries land in scripts[]; a fetched bootstrap.min.css
    // must count as CSS evidence even without a link[rel=stylesheet].
    const result = detect(
      page({ scripts: ['https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css'] }),
    );
    assert.ok(result.hits.some((h) => h.id === 'bootstrap'));
  });
});

describe('global checks require a positive presence marker', () => {
  it('treats { present: false } as absent', () => {
    const result = detect(
      page({
        globals: {
          React: { present: false },
          Vue: { present: false },
          jQuery: { present: false },
          __NUXT__: { present: false },
          Sentry: { present: false },
        },
      }),
    );
    assert.equal(result.primary, null);
    assert.deepEqual(result.hits.map((h) => h.id), []);
  });

  it('still accepts { present: true } and bare true', () => {
    const result = detect(page({ globals: { __VUE__: { present: true } } }));
    assert.equal(result.primary && result.primary.id, 'vue');
  });
});
