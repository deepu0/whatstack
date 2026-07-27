/**
 * WhatStack confidence scoring — evidence weights to a confidence level.
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
  if (maxW >= 2 || total >= 2) return 'medium';
  return 'low';
}
