import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detect, badgeCount, scoreConfidence, mergeDeepSignals } from '../shared/detect.js';
import {
  nextjsFixture,
  nextjsAppRouterMinifiedFixture,
  jobBoardCopyFixture,
  reactSpaFixture,
  vueFixture,
  angularFixture,
  angularWithEmptyReactDevtoolsHookFixture,
  svelteKitFixture,
  jqueryFixture,
  fullStackFixture,
  analyticsOnlyFixture,
  bootstrapUiFixture,
  moduleFederationFixture,
  singleSpaFixture,
  noMicrofrontendFixture,
  richStackFixture,
  toolNamesInCopyOnlyFixture,
  newRelicFixture,
  tanstackFixture,
  tanstackProseOnlyFixture,
} from './fixtures.js';

function hasHit(result, id, minConfidence) {
  const order = { high: 0, medium: 1, low: 2 };
  const hit = result.hits.find((h) => h.id === id);
  assert.ok(hit, `expected hit ${id}, got: ${result.hits.map((h) => h.id).join(', ')}`);
  if (minConfidence) {
    assert.ok(
      order[hit.confidence] <= order[minConfidence],
      `${id} confidence ${hit.confidence} worse than ${minConfidence}`,
    );
  }
  assert.ok(hit.evidence && hit.evidence.length > 0, `${id} missing evidence`);
  return hit;
}

describe('framework family detection', () => {
  it('detects Next.js (and React) with high confidence', () => {
    const r = detect(nextjsFixture());
    hasHit(r, 'nextjs', 'high');
    hasHit(r, 'react', 'high');
    assert.equal(r.primary?.id, 'nextjs');
    assert.equal(r.pass, 'deep');
  });

  it('detects minified Next.js App Router without __NEXT_DATA__ as high', () => {
    const r = detect(nextjsAppRouterMinifiedFixture());
    hasHit(r, 'nextjs', 'high');
    hasHit(r, 'react', 'high');
    assert.equal(r.primary?.id, 'nextjs');
  });

  it('does not treat job-listing copy (Vue.js / React.js text) as frameworks', () => {
    const r = detect(jobBoardCopyFixture());
    hasHit(r, 'nextjs', 'high');
    hasHit(r, 'react', 'high');
    assert.equal(r.hits.find((h) => h.id === 'nextjs')?.version, '14.2.5');
    assert.equal(
      r.hits.find((h) => h.id === 'vue'),
      undefined,
      'Vue must not fire from page copy',
    );
    assert.equal(
      r.hits.find((h) => h.id === 'angular'),
      undefined,
      'Angular must not fire from page copy',
    );
    assert.equal(
      r.hits.find((h) => h.id === 'svelte'),
      undefined,
      'Svelte must not fire from page copy',
    );
    // dpl= on Next chunks → Vercel client hint is OK
    // No prose script evidence
    for (const h of r.hits) {
      for (const e of h.evidence) {
        assert.ok(
          e.type !== 'script' || !/^(React|Vue)\.js$/i.test(e.snippet.trim()),
          `bad prose evidence on ${h.id}: ${e.snippet}`,
        );
      }
    }
  });

  it('detects real Vue CDN asset but ignores Vue-in-description-only pages', () => {
    const proseOnly = detect({
      url: 'https://blog.example/vue-vs-react',
      pass: 'deep',
      scripts: ['https://blog.example/assets/app.js'],
      stylesheets: [],
      cookies: [],
      metas: ['description=We compare Vue.js and React.js for hiring'],
      inlineSamples: [],
      domFlags: [],
      html: '<p>Learn Vue.js and React.js today</p><script src="/assets/app.js"></script>',
      globals: {},
    });
    assert.equal(proseOnly.hits.find((h) => h.id === 'vue'), undefined);
    assert.equal(proseOnly.hits.find((h) => h.id === 'react'), undefined);
  });

  it('detects React SPA', () => {
    const r = detect(reactSpaFixture());
    hasHit(r, 'react', 'high');
    assert.ok(r.hits.some((h) => h.id === 'react' && h.version === '18.2.0'));
  });

  it('detects Vue', () => {
    const r = detect(vueFixture());
    hasHit(r, 'vue', 'high');
  });

  it('detects Angular with version evidence', () => {
    const r = detect(angularFixture());
    const hit = hasHit(r, 'angular', 'high');
    assert.ok(
      hit.version === '17.0.0' ||
        hit.evidence.some((e) => String(e.snippet).includes('17')),
      'angular version signal',
    );
  });

  it('Angular + empty React DevTools hook is NOT React (IRCTC-style)', () => {
    const r = detect(angularWithEmptyReactDevtoolsHookFixture());
    hasHit(r, 'angular', 'high');
    assert.equal(
      r.hits.find((h) => h.id === 'react'),
      undefined,
      'must not treat __REACT_DEVTOOLS_GLOBAL_HOOK__ alone as React',
    );
    assert.equal(r.primary?.id, 'angular');
  });

  it('React only when renderer is registered (DevTools-style)', () => {
    const hookOnly = detect({
      url: 'https://plain.example/',
      pass: 'deep',
      scripts: [],
      stylesheets: [],
      cookies: [],
      metas: [],
      inlineSamples: [],
      domFlags: [],
      html: '<div>hello</div>',
      globals: {
        __REACT_DEVTOOLS_GLOBAL_HOOK__: { present: true },
      },
    });
    assert.equal(hookOnly.hits.find((h) => h.id === 'react'), undefined);

    const withRenderer = detect({
      url: 'https://app.example/',
      pass: 'deep',
      scripts: [],
      stylesheets: [],
      cookies: [],
      metas: [],
      inlineSamples: [],
      domFlags: [],
      html: '<div id="root"></div>',
      globals: {
        __reactRenderer: { present: true, version: '18.3.1', count: 1 },
      },
    });
    const hit = hasHit(withRenderer, 'react', 'high');
    assert.ok(hit.evidence.some((e) => /__reactRenderer/i.test(e.snippet)));
  });

  it('detects SvelteKit (and Svelte)', () => {
    const r = detect(svelteKitFixture());
    hasHit(r, 'sveltekit', 'high');
    hasHit(r, 'svelte', 'medium');
  });

  it('detects jQuery with version', () => {
    const r = detect(jqueryFixture());
    const hit = hasHit(r, 'jquery', 'high');
    assert.equal(hit.version, '3.7.1');
  });
});

describe('expanded solid detections (non-flaky)', () => {
  it('detects webpack, Sentry, Stripe, Auth0, Emotion on rich stack', () => {
    const r = detect(richStackFixture());
    hasHit(r, 'nextjs', 'high');
    hasHit(r, 'webpack', 'high');
    hasHit(r, 'sentry', 'high');
    hasHit(r, 'stripe', 'high');
    hasHit(r, 'auth0', 'high');
    hasHit(r, 'emotion', 'high');
  });

  it('does not fire on tool names only in marketing copy', () => {
    const r = detect(toolNamesInCopyOnlyFixture());
    const banned = [
      'sentry',
      'stripe',
      'auth0',
      'webpack',
      'vite',
      'launchdarkly',
      'intercom',
      'newrelic',
    ];
    for (const id of banned) {
      assert.equal(
        r.hits.find((h) => h.id === id),
        undefined,
        `${id} must not match prose`,
      );
    }
  });

  it('detects New Relic browser agent via NREUM / CDN / beacon', () => {
    const r = detect(newRelicFixture());
    const hit = hasHit(r, 'newrelic', 'high');
    assert.ok(
      hit.evidence.some(
        (e) =>
          /NREUM|nr-data|js-agent\.newrelic|__nr_require|newrelic/i.test(e.snippet),
      ),
      'expected NR-specific evidence',
    );
  });

  it('detects TanStack Query, Router, Table (+ umbrella)', () => {
    const r = detect(tanstackFixture());
    hasHit(r, 'tanstack-query', 'high');
    hasHit(r, 'tanstack-router', 'high');
    hasHit(r, 'tanstack-table', 'high');
    hasHit(r, 'tanstack', 'high');
    const q = r.hits.find((h) => h.id === 'tanstack-query');
    assert.equal(q?.version, '5.56.2');
  });

  it('does not treat TanStack names in blog copy as packages', () => {
    const r = detect(tanstackProseOnlyFixture());
    for (const id of [
      'tanstack',
      'tanstack-query',
      'tanstack-router',
      'tanstack-table',
      'tanstack-form',
      'tanstack-virtual',
    ]) {
      assert.equal(r.hits.find((h) => h.id === id), undefined, id);
    }
  });

  it('does not treat bare Redux DevTools extension hook as Redux', () => {
    const r = detect({
      url: 'https://plain.example/',
      pass: 'deep',
      scripts: [],
      stylesheets: [],
      cookies: [],
      metas: [],
      inlineSamples: [],
      domFlags: [],
      html: '<div></div>',
      globals: {
        __REDUX_DEVTOOLS_EXTENSION__: { present: true },
        __REDUX_DEVTOOLS_EXTENSION_COMPOSE__: { present: true },
      },
    });
    assert.equal(r.hits.find((h) => h.id === 'redux'), undefined);
  });
});

describe('microfrontend / architecture detection', () => {
  it('detects Module Federation and labels Microfrontend', () => {
    const r = detect(moduleFederationFixture());
    hasHit(r, 'module-federation', 'high');
    hasHit(r, 'microfrontend', 'high');
    assert.ok(
      r.hits.find((h) => h.id === 'microfrontend')?.evidence.some((e) =>
        /Module Federation|MFE platform/i.test(e.snippet),
      ),
    );
  });

  it('detects single-spa as microfrontend', () => {
    const r = detect(singleSpaFixture());
    hasHit(r, 'single-spa', 'high');
    hasHit(r, 'microfrontend', 'high');
  });

  it('does not claim microfrontend on plain Angular monolith', () => {
    const r = detect(noMicrofrontendFixture());
    hasHit(r, 'angular', 'high');
    assert.equal(r.hits.find((h) => h.id === 'microfrontend'), undefined);
    assert.equal(r.hits.find((h) => h.id === 'module-federation'), undefined);
    assert.equal(r.hits.find((h) => h.id === 'single-spa'), undefined);
  });
});

describe('non-framework categories (local signatures)', () => {
  it('surfaces state, ui, analytics, hosting on a full stack fixture', () => {
    const r = detect(fullStackFixture());
    hasHit(r, 'nextjs', 'high');
    hasHit(r, 'redux', 'high');
    hasHit(r, 'tailwind', 'medium');
    hasHit(r, 'google-analytics', 'high');
    hasHit(r, 'vercel', 'medium');
    // no network — pure local
    assert.ok(r.hits.every((h) => h.evidence.length));
  });

  it('detects analytics tags', () => {
    const r = detect(analyticsOnlyFixture());
    hasHit(r, 'segment', 'high');
    hasHit(r, 'mixpanel', 'high');
  });

  it('detects Bootstrap UI', () => {
    const r = detect(bootstrapUiFixture());
    hasHit(r, 'bootstrap', 'high');
  });
});

describe('scoring + hybrid merge', () => {
  it('scoreConfidence tiers', () => {
    assert.equal(scoreConfidence([{ type: 'dom', snippet: 'x', weight: 4 }], true), 'high');
    assert.equal(scoreConfidence([{ type: 'script', snippet: 'x', weight: 2 }], false), 'medium');
    assert.equal(scoreConfidence([{ type: 'dom', snippet: 'x', weight: 1 }], false), 'low');
  });

  it('mergeDeepSignals marks deep pass and overlays globals', () => {
    const light = { url: 'https://x', scripts: [], globals: {}, pass: 'light' };
    const merged = mergeDeepSignals(light, { React: { present: true } });
    assert.equal(merged.pass, 'deep');
    assert.ok(merged.globals.React);
  });

  it('badgeCount ignores low confidence', () => {
    const r = {
      hits: [
        { confidence: 'high' },
        { confidence: 'medium' },
        { confidence: 'low' },
      ],
    };
    assert.equal(badgeCount(r), 2);
  });
});
