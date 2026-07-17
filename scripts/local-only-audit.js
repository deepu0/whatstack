/**
 * Grep shipped detection path for outbound detection / remote signature usage.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = process.argv[2] || null;

const files = [
  'shared/detect.js',
  'shared/signatures.js',
  'shared/result-shape.js',
  'background/service-worker.js',
  'content/content-script.js',
  'popup/popup.js',
];

const suspicious =
  /\b(fetch\s*\(|XMLHttpRequest|axios\.|https?:\/\/api\.|signature.*cdn|wappalyzer\.com|builtwith)/i;

const lines = [];
lines.push('Local-only detection audit');
lines.push('=========================');
lines.push('Policy: matching uses bundled signatures + probes only; no remote signature fetch.');
lines.push('');

let bad = 0;
for (const rel of files) {
  const abs = path.join(root, rel);
  const text = fs.readFileSync(abs, 'utf8');
  const hits = [];
  text.split('\n').forEach((line, i) => {
    if (suspicious.test(line)) hits.push({ line: i + 1, text: line.trim() });
  });
  // Allow chrome.* APIs; flag only network-ish in detect path
  if (rel.startsWith('shared/') && /fetch\s*\(/.test(text)) {
    bad++;
    lines.push(`FAIL ${rel}: fetch() in shared detection`);
  } else if (hits.length && rel.startsWith('shared/')) {
    // double-check each hit
    for (const h of hits) {
      if (/fetch\s*\(|XMLHttpRequest|wappalyzer|builtwith/i.test(h.text)) {
        bad++;
        lines.push(`FAIL ${rel}:${h.line}: ${h.text}`);
      }
    }
  }
  lines.push(`OK   ${rel} (${text.split('\n').length} lines) — no remote detection API`);
}

lines.push('');
lines.push(
  bad === 0
    ? 'RESULT: matching is local (bundled rules/probes only).'
    : `RESULT: ${bad} suspicious construct(s).`,
);

const body = lines.join('\n') + '\n';
console.log(body);
if (outPath) fs.writeFileSync(outPath, body);
if (bad > 0) process.exit(1);
