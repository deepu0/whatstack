/**
 * "Local only" audit: no shipped file may talk to the network.
 *
 * Scans EVERY file that goes into the store package (same roots as
 * scripts/package-extension.js) for network primitives. The only URLs allowed
 * are the "Wrong?" report link the USER opens (REPORT_REPO) — never a request
 * the extension makes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outPath = process.argv[2] || null;
export const PACKAGED_DIRS = ['background', 'content', 'popup', 'shared'];

/** Network primitives. Comments are stripped before matching. */
const NETWORK = [
  [/\bfetch\s*\(/, 'fetch()'],
  [/\bXMLHttpRequest\b/, 'XMLHttpRequest'],
  [/\bnavigator\.sendBeacon\b/, 'sendBeacon'],
  [/\bnew\s+WebSocket\b/, 'WebSocket'],
  [/\bnew\s+EventSource\b/, 'EventSource'],
  [/\bimportScripts\s*\(/, 'importScripts()'],
  [/\bimport\s*\(\s*['"`]https?:/, 'remote dynamic import'],
  [/\bnew\s+Image\s*\([^)]*\)\s*\.src\s*=|\.src\s*=\s*['"`]https?:/, 'image / script beacon'],
  [/\bconnectNative\b|\bsendNativeMessage\b/, 'native messaging'],
  [/\bchrome\.(?:webRequest|declarativeNetRequest)\b/, 'request interception'],
  [/wappalyzer\.com|builtwith\.com/i, 'remote detection service'],
];

/** Absolute URLs a shipped file may contain (links the user opens, never fetched). */
const ALLOWED_URLS = [/^https:\/\/github\.com\/deepu0\/whatstack\b/, /^http:\/\/www\.w3\.org\/2000\/svg$/];

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(rel));
    else if (/\.(?:m?js|html)$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const lines = ['Local-only detection audit', '=========================', 'Policy: bundled rules + in-page probes only; the extension makes no network requests.', ''];
let bad = 0;
const files = PACKAGED_DIRS.flatMap(walk).sort();

for (const rel of files) {
  const text = stripComments(fs.readFileSync(path.join(root, rel), 'utf8'));
  const problems = [];
  text.split('\n').forEach((line, i) => {
    for (const [re, label] of NETWORK) if (re.test(line)) problems.push(`${label} at line ${i + 1}: ${line.trim().slice(0, 120)}`);
    for (const m of line.matchAll(/https?:\/\/[^\s'"`)<>]+/g)) {
      if (!ALLOWED_URLS.some((re) => re.test(m[0]))) problems.push(`unexpected URL at line ${i + 1}: ${m[0]}`);
    }
  });
  if (problems.length) {
    bad += problems.length;
    for (const p of problems) lines.push(`FAIL ${rel}: ${p}`);
  } else {
    lines.push(`OK   ${rel}`);
  }
}

lines.push('');
lines.push(bad === 0 ? `RESULT: ${files.length} shipped files, no network access.` : `RESULT: ${bad} problem(s).`);
const body = lines.join('\n') + '\n';
console.log(body);
if (outPath) fs.writeFileSync(outPath, body);
if (bad > 0) process.exit(1);
