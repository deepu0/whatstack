/**
 * Popup-facing result shaping — pure functions shared by popup + tests.
 */

import { CATEGORY_ORDER, CATEGORY_LABELS, HEADLINE_CATEGORIES } from './signatures.js';
import { groupHitsByCategory, stripQuery } from './detect.js';

/** Bumped when the JSON export's shape changes. */
export const EXPORT_SCHEMA_VERSION = 1;

/** Headline length cap, in parts. */
const HEADLINE_MAX = 5;

/** Page-derived text on one line. */
function oneLine(v) {
  return String(v ?? '').replace(/[\r\n]+/g, ' ');
}

/** One Markdown table cell: no pipes or line breaks from page-derived strings. */
function mdCell(v) {
  return String(v ?? '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
}

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
    if (!hit || seen.has(hit.id) || parts.length >= HEADLINE_MAX) return;
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
      // Never headline native import maps or other low-signal build noise
      if (h.id === 'import-map') continue;
      push(h);
    }
  }

  // If still thin, add auth/observability highlight
  if (parts.length < 3) {
    for (const cat of ['auth', 'observability', 'payments']) {
      for (const h of usable.filter((x) => x.category === cat)) push(h);
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
    `**URL:** ${oneLine(shaped.url || '—')}`,
    shaped.headline ? `**Stack:** ${oneLine(shaped.headline)}` : '',
    ``,
    `| Tech | Category | Confidence | Version |`,
    `| --- | --- | --- | --- |`,
  ].filter((l) => l !== '');

  for (const sec of shaped.sections) {
    for (const h of [...sec.hits, ...sec.lowHits]) {
      lines.push(
        `| ${mdCell(h.name)} | ${mdCell(sec.label)} | ${h.confidence} | ${mdCell(h.version || '—')} |`,
      );
    }
  }
  return lines.join('\n');
}

/** Where "Report wrong" reports land. */
export const REPORT_REPO = 'https://github.com/deepu0/whatstack';

/** GitHub rejects issue URLs past roughly 8k; stay well inside it. */
const MAX_REPORT_URL = 6000;

/**
 * Reduce a scanned URL to its origin.
 *
 * Reports carry the origin ONLY. A full URL can hold a session token in a query
 * string, an internal hostname path, or the title of a private document, and a
 * detection bug is a property of the site rather than the route — so the extra
 * precision buys nothing worth that risk.
 *
 * @param {string} url
 * @returns {string} origin, or '' when there isn't a usable one
 */
export function reportOrigin(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.origin;
  } catch {
    return '';
  }
}

/**
 * Markdown body for a wrong-detection report.
 *
 * The user is the one who submits this — GitHub's issue form opens prefilled and
 * fully editable, so nothing is sent until they read it and press the button.
 *
 * @param {ReturnType<typeof shapeForPopup>} shaped
 * @param {{ version?: string, browser?: string }} [meta]
 */
export function formatReportBody(shaped, meta = {}) {
  const origin = reportOrigin(shaped?.url || '');
  const lines = [
    '<!-- Everything below is editable. Remove anything you would rather not share. -->',
    '',
    '### What is wrong?',
    '',
    '- [ ] Reported something the site does not use (false positive)',
    '- [ ] Missed something the site does use',
    '- [ ] Wrong version',
    '- [ ] Wrong primary / core stack',
    '',
    'What should it have said?',
    '',
    '',
    '---',
    '',
    `**Site:** ${origin || '_not shared_'}`,
    `**Scan:** ${shaped?.pass || 'deep'}`,
    `**Core stack:** ${shaped?.headline || '_none_'}`,
    '',
  ];

  if (shaped && !shaped.empty) {
    lines.push('| Tech | Category | Confidence | Version | Evidence |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const sec of shaped.sections) {
      for (const h of [...sec.hits, ...sec.lowHits]) {
        // Evidence is the whole point of the report — it says WHY the engine
        // believed this, which is what makes a bad call diagnosable.
        // Query strings are stripped (tokens live there) and backticks cannot
        // close the code span early.
        const ev = (h.evidence || [])
          .slice(0, 4)
          .map((e) => {
            const snip = stripQuery(String(e.snippet)).replace(/`/g, "'").replace(/[\r\n]+/g, ' ');
            return `\`${mdCell(snip).slice(0, 80)}\``;
          })
          .join(', ');
        lines.push(
          `| ${h.name} | ${sec.label} | ${h.confidence} | ${h.version || '—'} | ${ev || '—'} |`,
        );
      }
    }
  } else {
    lines.push('_Nothing was detected on this page._');
  }

  lines.push('');
  lines.push(`**WhatStack:** ${meta.version || 'unknown'}`);
  if (meta.browser) lines.push(`**Browser:** ${meta.browser}`);
  return lines.join('\n');
}

/**
 * Prefilled GitHub issue URL for a wrong detection.
 *
 * Deliberately a link the user opens, not a request the extension sends: no
 * outbound network from the extension itself, no new permissions, and the
 * "Local only" promise stays literally true.
 *
 * @param {ReturnType<typeof shapeForPopup>} shaped
 * @param {{ version?: string, browser?: string, repo?: string }} [meta]
 * @returns {string}
 */
export function buildReportUrl(shaped, meta = {}) {
  const origin = reportOrigin(shaped?.url || '');
  const site = origin ? origin.replace(/^https?:\/\//, '') : 'a page';
  const stack = shaped?.headline || 'nothing detected';
  const title = `Wrong detection on ${site}: ${stack}`.slice(0, 120);
  const base = `${meta.repo || REPORT_REPO}/issues/new`;

  const build = (body) => {
    const q = new URLSearchParams({ labels: 'detection', title, body });
    return `${base}?${q.toString()}`;
  };

  let body = formatReportBody(shaped, meta);
  let url = build(body);
  if (url.length <= MAX_REPORT_URL) return url;

  // Too long to prefill — keep the checklist and the header, drop the table and
  // say so, rather than handing GitHub a URL it will reject.
  const head = body.split('---')[0];
  body = `${head}---\n\n**Site:** ${origin || '_not shared_'}\n**Core stack:** ${stack}\n\n_The evidence table was too large to prefill. Use the popup's JSON export and paste it here._\n\n**WhatStack:** ${meta.version || 'unknown'}`;
  url = build(body);
  return url.length <= MAX_REPORT_URL ? url : base;
}

/**
 * Structured JSON export (for tickets / tooling).
 * @param {ReturnType<typeof shapeForPopup>} shaped
 */
export function formatStackJson(shaped) {
  const payload = {
    tool: 'WhatStack',
    schemaVersion: EXPORT_SCHEMA_VERSION,
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
