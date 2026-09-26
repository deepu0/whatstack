/**
 * Golden corpus replay: real signals captured from real sites by
 * scripts/capture-corpus.mjs (content-script light signals + MAIN-world probe
 * globals), run through the same merge + detect() path as a production deep
 * scan. Runs offline in `npm test`.
 *
 * Two layers:
 *  - expectations (hand-reviewed, in sites.json): must / mustNot / mustNotSolid /
 *    noVersion — a failure here is a real regression.
 *  - snapshot: the full sorted id:confidence@version list. Any change fails
 *    until reviewed; accept intentional changes with
 *      UPDATE_CORPUS=1 npm test
 *    and commit the diff.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detect, mergeDeepSignals } from '../shared/detect.js';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'corpus');
const UPDATE = process.env.UPDATE_CORPUS === '1';
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'sites.json').sort();
const sites = JSON.parse(fs.readFileSync(path.join(DIR, 'sites.json'), 'utf8'));
const expectFor = Object.fromEntries(sites.map((s) => [s.host, s.expect || {}]));

const snap = (result) => result.hits.map((h) => `${h.id}:${h.confidence}${h.version ? '@' + h.version : ''}`).sort();

describe('golden corpus (real captured sites)', () => {
  it('has a meaningful number of captures', () => {
    assert.ok(files.length >= 30, `only ${files.length} captures`);
  });

  for (const file of files) {
    const record = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
    const expect = expectFor[record.host] || record.expect || {};

    it(`${record.host}`, () => {
      const result = detect(mergeDeepSignals(record.signals, record.globals));
      const byId = Object.fromEntries(result.hits.map((h) => [h.id, h]));

      for (const id of expect.must || []) {
        assert.ok(byId[id], `${record.host}: expected ${id}`);
        assert.notEqual(byId[id].confidence, 'low', `${record.host}: ${id} dropped to low`);
      }
      for (const id of expect.mustNot || []) {
        assert.equal(byId[id], undefined, `${record.host}: ${id} must not be reported (${JSON.stringify(byId[id]?.evidence)})`);
      }
      for (const id of expect.mustNotSolid || []) {
        assert.ok(!byId[id] || byId[id].confidence === 'low', `${record.host}: ${id} must be low at most, got ${byId[id]?.confidence}`);
      }
      for (const id of expect.noVersion || []) {
        assert.equal(byId[id]?.version, undefined, `${record.host}: ${id} must not show a version`);
      }

      const now = snap(result);
      if (UPDATE) {
        record.snapshot = now;
        fs.writeFileSync(path.join(DIR, file), JSON.stringify(record, null, 1) + '\n');
        return;
      }
      assert.deepEqual(now, record.snapshot, `${record.host}: detection changed — review, then UPDATE_CORPUS=1 npm test`);
    });
  }
});
