import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SIGNATURES } from '../shared/signatures.js';
import { detect } from '../shared/detect.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentScript = fs.readFileSync(path.join(root, 'content/content-script.js'), 'utf8');

/**
 * The engine resolves `type: 'dom'` evidence with an EXACT lookup:
 * `domFlags.includes(pattern)`. So every dom pattern in the rule pack must be,
 * verbatim, a flag string the content script emits — a pattern that drifts from
 * the probe (renamed flag, comma-joined selector list, typo) fails silently:
 * the check just never fires again. This happened once: the Angular pattern
 * `'[_ngcontent-],[_nghost-]'` vs the emitted flag `'[_ngcontent-]'` cost a
 * weight-4 evidence line, and the MUI check died outright.
 */
describe('dom patterns are verbatim content-script flag tokens', () => {
  const domPatterns = SIGNATURES.flatMap((rule) =>
    rule.checks
      .filter((c) => c.type === 'dom' && typeof c.pattern === 'string')
      .map((c) => ({ rule: rule.id, pattern: c.pattern })),
  );

  it('has dom-based rules at all (guards the extraction itself)', () => {
    assert.ok(domPatterns.length >= 15, `only found ${domPatterns.length} dom checks`);
  });

  for (const { rule, pattern } of domPatterns) {
    it(`${rule}: '${pattern}' is emitted by the probe`, () => {
      // Flags appear in the probe as quoted literals ('flag' or "flag").
      const quoted =
        contentScript.includes(`'${pattern}'`) || contentScript.includes(`"${pattern}"`);
      assert.ok(
        quoted,
        `signature dom pattern '${pattern}' is not a flag literal in content-script.js — ` +
          `the exact-match lookup in evalCheck can never fire for it`,
      );
    });

    it(`${rule}: '${pattern}' round-trips through detect()`, () => {
      const result = detect({
        url: 'https://contract.example/',
        pass: 'deep',
        scripts: [],
        stylesheets: [],
        cookies: [],
        metas: [],
        inlineSamples: [],
        globals: {},
        domFlags: [pattern],
      });
      const hit = result.hits.find((h) => h.id === rule);
      const sigRule = SIGNATURES.find((r) => r.id === rule);
      const check = sigRule.checks.find((c) => c.type === 'dom' && c.pattern === pattern);

      if (sigRule.requiresRuntime && !check.runtime) {
        // Weak marker on a runtime-gated framework: the flag alone must NOT
        // fire the rule. A bare <div id="__next"> or a data-v- attribute is
        // circumstantial, and resolveStack drops it without runtime proof.
        assert.equal(
          hit,
          undefined,
          `weak flag '${pattern}' fired '${rule}' with no runtime proof`,
        );
      } else {
        assert.ok(
          hit && hit.evidence.some((e) => e.type === 'dom' && e.snippet === pattern),
          `flag '${pattern}' produced no dom evidence on rule '${rule}'`,
        );
      }
    });
  }
});
