/**
 * WhatStack badge shaping — how a scan result maps to the toolbar badge.
 */

/**
 * Calculate badge count for scan result.
 * @param {import('./detect.js').ScanResult} result
 */
export function calculateBadgeCount(result) {
  if (!result || !result.hits) return 0;
  return result.hits.filter(
    (h) => h.confidence === 'high' || h.confidence === 'medium',
  ).length;
}
