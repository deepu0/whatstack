/**
 * WhatStack Architecture Classifier — microfrontends, meta-frameworks, and lineage rules.
 */

import { MFE_PLATFORM_IDS } from './signatures.js';

/**
 * Apply microfrontend architecture umbrella classifications.
 * @param {import('./detect.js').Hit[]} hits
 * @param {Map<string, import('./detect.js').Hit>} byId
 * @param {() => void} refresh
 */
export function applyMicrofrontendClassification(hits, byId, refresh) {
  const platforms = MFE_PLATFORM_IDS.filter((id) => byId.has(id));
  if (platforms.length > 0) {
    const names = platforms.map((id) => byId.get(id)?.name || id);
    if (!byId.has('microfrontend')) {
      hits.push({
        id: 'microfrontend',
        name: 'Microfrontend',
        category: 'architecture',
        confidence: 'high',
        evidence: [
          {
            type: 'dom',
            snippet: `MFE platform detected: ${names.join(', ')}`,
            weight: 5,
            runtime: true,
            strong: true,
          },
        ],
        related: platforms,
      });
    } else {
      const m = byId.get('microfrontend');
      m.confidence = 'high';
      m.related = Array.from(new Set([...(m.related || []), ...platforms]));
      if (!m.evidence.some((e) => /MFE platform/i.test(e.snippet))) {
        m.evidence.push({
          type: 'dom',
          snippet: `MFE platform detected: ${names.join(', ')}`,
          weight: 5,
          runtime: true,
          strong: true,
        });
      }
    }
    refresh();
  }

  // Demote generic import map noise so it doesn't dominate badge/headline
  if (byId.has('import-map')) {
    const im = byId.get('import-map');
    im.confidence = 'low';
  }
}

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
