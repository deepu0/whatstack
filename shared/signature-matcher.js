/**
 * WhatStack Signature Matcher — signal evaluation, confidence scoring, and check matching.
 */

/**
 * Score confidence based on evidence list and strong indicators.
 * @param {import('./detect.js').Evidence[]} evidence
 * @param {boolean} hadStrong
 * @returns {'high'|'medium'|'low'}
 */
export function scoreConfidence(evidence, hadStrong) {
  if (!evidence || !evidence.length) return 'low';
  const total = evidence.reduce((a, e) => a + (e.weight || 0), 0);
  const maxW = Math.max(...evidence.map((e) => e.weight || 0));
  const hasRuntime = evidence.some((e) => e.runtime);
  if (hadStrong || (hasRuntime && maxW >= 3) || maxW >= 4 || total >= 5) return 'high';
  if (maxW >= 3 || total >= 3 || (evidence.length >= 2 && total >= 2)) return 'medium';
  if (total >= 2 || maxW >= 2) return 'medium';
  return 'low';
}

/**
 * Match a single check against page signals.
 * @param {import('./signatures.js').SignatureCheck} check
 * @param {import('./detect.js').PageSignals} signals
 * @returns {import('./detect.js').Evidence | null}
 */
export function matchCheck(check, signals) {
  const { type, pattern, weight, strong, runtime } = check;

  if (type === 'global' && signals.globals) {
    const key = String(pattern);
    const val = signals.globals[key];
    if (val && typeof val === 'object' && /** @type {any} */ (val).present) {
      return { type: 'global', snippet: key, weight, strong, runtime: true };
    }
  }

  if (type === 'dom' && signals.domFlags && typeof pattern === 'string') {
    if (signals.domFlags.includes(pattern)) {
      return { type: 'dom', snippet: pattern, weight, strong, runtime: true };
    }
  }

  if (type === 'script' && signals.scripts && pattern instanceof RegExp) {
    for (const src of signals.scripts) {
      if (pattern.test(src)) {
        return { type: 'script', snippet: src, weight, strong, runtime: true };
      }
    }
  }

  if (type === 'css' && signals.stylesheets && pattern instanceof RegExp) {
    for (const href of signals.stylesheets) {
      if (pattern.test(href)) {
        return { type: 'css', snippet: href, weight, strong, runtime: true };
      }
    }
  }

  if (type === 'meta' && signals.metas && pattern instanceof RegExp) {
    for (const meta of signals.metas) {
      if (pattern.test(meta)) {
        return { type: 'meta', snippet: meta, weight, strong, runtime: true };
      }
    }
  }

  if (type === 'cookie' && signals.cookies && typeof pattern === 'string') {
    if (signals.cookies.includes(pattern)) {
      return { type: 'cookie', snippet: pattern, weight, strong, runtime: false };
    }
  }

  if (type === 'inline' && signals.inlineSamples && pattern instanceof RegExp) {
    for (const sample of signals.inlineSamples) {
      if (pattern.test(sample)) {
        return { type: 'inline', snippet: sample.slice(0, 100), weight, strong, runtime: true };
      }
    }
  }

  return null;
}
