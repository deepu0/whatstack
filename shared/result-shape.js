/**
 * Popup-facing result shaping — pure functions shared by popup + tests.
 */

import { CATEGORY_ORDER, CATEGORY_LABELS, HEADLINE_CATEGORIES } from './signatures.js';
import { groupHitsByCategory } from './detect.js';

/**
 * @typedef {import('./detect.js').Hit} Hit
 * @typedef {import('./detect.js').ScanResult} ScanResult
 */

/**
 * Shape a ScanResult into UI sections + headline.
 * Low confidence hits are listed separately but always visible (not hidden).
 * @param {ScanResult} result
 */
export function shapeForPopup(result) {
  if (!result || !Array.isArray(result.hits)) {
    return {
      url: result?.url || '',
      pass: result?.pass || 'light',
      primary: null,
      headline: '',
      headlineParts: [],
      sections: [],
      totalVisible: 0,
      highMediumCount: 0,
      empty: true,
      error: null,
    };
  }

  const groups = groupHitsByCategory(result.hits, { includeLow: true });
  const sections = [];

  for (const cat of CATEGORY_ORDER) {
    const all = groups[cat] || [];
    if (!all.length) continue;
    const primaryHits = all.filter((h) => h.confidence !== 'low');
    const lowHits = all.filter((h) => h.confidence === 'low');
    sections.push({
      category: cat,
      label: CATEGORY_LABELS[cat] || cat,
      hits: primaryHits.map(serializeHit),
      lowHits: lowHits.map(serializeHit),
    });
  }

  const totalVisible = sections.reduce(
    (n, s) => n + s.hits.length + s.lowHits.length,
    0,
  );

  const highMediumCount = result.hits.filter(
    (h) => h.confidence === 'high' || h.confidence === 'medium',
  ).length;

  const { headline, headlineParts } = buildHeadline(result.hits, result.primary);

  return {
    url: result.url || '',
    pass: result.pass || 'deep',
    primary: result.primary || null,
    headline,
    headlineParts,
    sections,
    totalVisible,
    highMediumCount,
    empty: totalVisible === 0,
    error: null,
  };
}

/**
 * Core stack one-liner from high/medium hits.
 * @param {Hit[]} hits
 * @param {{ id: string, name: string } | null} primary
 */
export function buildHeadline(hits, primary) {
  const usable = (hits || []).filter(
    (h) => h.confidence === 'high' || h.confidence === 'medium',
  );

  /** @type {string[]} */
  const parts = [];
  const seen = new Set();

  const push = (hit) => {
    if (!hit || seen.has(hit.id)) return;
    seen.add(hit.id);
    const ver = hit.version ? ` ${hit.version}` : '';
    parts.push(`${hit.name}${ver}`);
  };

  // Primary framework first
  if (primary) {
    const p = usable.find((h) => h.id === primary.id);
    if (p) push(p);
  }

  for (const cat of HEADLINE_CATEGORIES) {
    for (const h of usable.filter((x) => x.category === cat)) {
      push(h);
      if (parts.length >= 5) break;
    }
    if (parts.length >= 5) break;
  }

  // If still thin, add auth/observability highlight
  if (parts.length < 3) {
    for (const cat of ['auth', 'observability', 'payments']) {
      for (const h of usable.filter((x) => x.category === cat)) {
        push(h);
        if (parts.length >= 5) break;
      }
    }
  }

  const headline = parts.length ? parts.join(' · ') : '';
  return { headline, headlineParts: parts };
}

/**
 * @param {Hit} hit
 */
function serializeHit(hit) {
  return {
    id: hit.id,
    name: hit.name,
    category: hit.category,
    confidence: hit.confidence,
    version: hit.version || null,
    related: hit.related || [],
    evidence: (hit.evidence || []).map((e) => ({
      type: e.type,
      snippet: e.snippet,
      weight: e.weight,
    })),
  };
}

/**
 * Human-readable copy-to-clipboard summary.
 * @param {ReturnType<typeof shapeForPopup>} shaped
 */
export function formatStackSummary(shaped) {
  if (!shaped || shaped.empty) return 'WhatStack: no stack signals detected.';
  const lines = [`WhatStack for ${shaped.url || 'page'}:`];
  if (shaped.headline) lines.push(`Stack: ${shaped.headline}`);
  for (const sec of shaped.sections) {
    const names = [...sec.hits, ...sec.lowHits].map((h) => {
      const conf = h.confidence;
      const ver = h.version ? `@${h.version}` : '';
      return `${h.name}${ver} (${conf})`;
    });
    if (names.length) lines.push(`${sec.label}: ${names.join(', ')}`);
  }
  return lines.join('\n');
}

/**
 * Markdown table export.
 * @param {ReturnType<typeof shapeForPopup>} shaped
 */
export function formatStackMarkdown(shaped) {
  if (!shaped || shaped.empty) return '_WhatStack: no stack signals detected._';
  const lines = [
    `## WhatStack`,
    ``,
    `**URL:** ${shaped.url || '—'}`,
    shaped.headline ? `**Stack:** ${shaped.headline}` : '',
    ``,
    `| Tech | Category | Confidence | Version |`,
    `| --- | --- | --- | --- |`,
  ].filter((l) => l !== '');

  for (const sec of shaped.sections) {
    for (const h of [...sec.hits, ...sec.lowHits]) {
      lines.push(
        `| ${h.name} | ${sec.label} | ${h.confidence} | ${h.version || '—'} |`,
      );
    }
  }
  return lines.join('\n');
}

/**
 * Structured JSON export (for tickets / tooling).
 * @param {ReturnType<typeof shapeForPopup>} shaped
 */
export function formatStackJson(shaped) {
  const payload = {
    tool: 'WhatStack',
    url: shaped?.url || '',
    pass: shaped?.pass || 'deep',
    headline: shaped?.headline || '',
    primary: shaped?.primary || null,
    hits: [],
  };
  if (!shaped || shaped.empty) return JSON.stringify(payload, null, 2);

  for (const sec of shaped.sections) {
    for (const h of [...sec.hits, ...sec.lowHits]) {
      payload.hits.push({
        id: h.id,
        name: h.name,
        category: h.category,
        confidence: h.confidence,
        version: h.version,
        evidence: h.evidence,
      });
    }
  }
  return JSON.stringify(payload, null, 2);
}
