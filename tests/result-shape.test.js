import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detect } from '../shared/detect.js';
import {
  shapeForPopup,
  formatStackSummary,
  formatStackMarkdown,
  formatStackJson,
  buildHeadline,
} from '../shared/result-shape.js';
import { fullStackFixture, nextjsFixture, richStackFixture } from './fixtures.js';

describe('result shaping for popup', () => {
  it('groups by category, keeps confidence, and non-empty evidence on high/medium', () => {
    const raw = detect(fullStackFixture());
    const shaped = shapeForPopup(raw);

    assert.equal(shaped.empty, false);
    assert.ok(shaped.sections.length >= 2, 'multiple category sections');

    const labels = shaped.sections.map((s) => s.category);
    // frameworks first
    assert.equal(labels[0], 'framework');

    let sawHighOrMedium = false;
    for (const sec of shaped.sections) {
      for (const hit of sec.hits) {
        assert.ok(['high', 'medium'].includes(hit.confidence));
        assert.ok(Array.isArray(hit.evidence) && hit.evidence.length > 0, `${hit.id} evidence`);
        assert.ok(hit.evidence.every((e) => e.type && e.snippet), 'evidence fields');
        sawHighOrMedium = true;
      }
      for (const hit of sec.lowHits) {
        assert.equal(hit.confidence, 'low');
      }
    }
    assert.ok(sawHighOrMedium);
    assert.ok(shaped.primary);
    assert.ok(shaped.totalVisible > 0);
  });

  it('collapses low confidence into lowHits buckets', () => {
    const raw = detect({
      url: 'https://x',
      pass: 'deep',
      scripts: [],
      stylesheets: [],
      cookies: [],
      metas: [],
      // only the weak utility-class flag → Tailwind must be low
      domFlags: ['tailwind-utilities'],
      globals: {},
    });
    const shaped = shapeForPopup(raw);
    const ui = shaped.sections.find((s) => s.category === 'ui');
    assert.ok(ui, 'ui section present');
    assert.deepEqual(ui.hits.map((h) => h.id), [], 'nothing solid');
    assert.deepEqual(ui.lowHits.map((h) => h.id), ['tailwind']);
    assert.equal(shaped.highMediumCount, 0);
  });

  it('formatStackSummary lists detected tech', () => {
    const shaped = shapeForPopup(detect(nextjsFixture()));
    const text = formatStackSummary(shaped);
    assert.match(text, /Next\.js/i);
    assert.match(text, /WhatStack/);
  });

  it('empty result shapes cleanly', () => {
    const shaped = shapeForPopup({
      url: 'https://empty.example',
      pass: 'deep',
      hits: [],
      primary: null,
    });
    assert.equal(shaped.empty, true);
    assert.equal(shaped.sections.length, 0);
    assert.match(formatStackSummary(shaped), /no stack signals/i);
  });

  it('builds headline and export formats for rich stack', () => {
    const raw = detect(richStackFixture());
    const shaped = shapeForPopup(raw);
    assert.ok(shaped.headline.length > 0, 'headline');
    assert.match(shaped.headline, /Next/i);
    assert.match(formatStackSummary(shaped), /Stack:/);
    assert.match(formatStackMarkdown(shaped), /\| Tech \|/);
    const json = JSON.parse(formatStackJson(shaped));
    assert.equal(json.tool, 'WhatStack');
    assert.ok(json.hits.length >= 3);
    assert.ok(json.headline);
  });

  it('buildHeadline prefers primary framework', () => {
    const { headline } = buildHeadline(
      [
        {
          id: 'sentry',
          name: 'Sentry',
          category: 'observability',
          confidence: 'high',
          evidence: [],
        },
        {
          id: 'nextjs',
          name: 'Next.js',
          category: 'framework',
          confidence: 'high',
          evidence: [],
        },
      ],
      { id: 'nextjs', name: 'Next.js' },
    );
    assert.ok(headline.startsWith('Next.js'));
  });
});
