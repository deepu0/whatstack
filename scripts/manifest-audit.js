/**
 * Structural loadability audit for the MV3 extension package.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'manifest.json');
const outPath = process.argv[2] || null;

const lines = [];
function log(s) {
  lines.push(s);
  console.log(s);
}

const raw = fs.readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(raw);

log(`manifest: ${manifestPath}`);
log(`manifest_version: ${manifest.manifest_version}`);
log(`name: ${manifest.name}`);
log(`version: ${manifest.version}`);

if (manifest.manifest_version !== 3) {
  console.error('FAIL: manifest_version must be 3');
  process.exit(1);
}

/** @type {string[]} */
const refs = [];

if (manifest.action?.default_popup) refs.push(manifest.action.default_popup);
if (manifest.background?.service_worker) refs.push(manifest.background.service_worker);

for (const cs of manifest.content_scripts || []) {
  for (const j of cs.js || []) refs.push(j);
  for (const c of cs.css || []) refs.push(c);
}

const iconMaps = [
  manifest.icons,
  manifest.action?.default_icon,
].filter(Boolean);

for (const map of iconMaps) {
  for (const p of Object.values(map)) refs.push(p);
}

// Follow HTML → script/link
function collectHtmlDeps(relHtml) {
  const abs = path.join(root, relHtml);
  if (!fs.existsSync(abs)) return;
  const html = fs.readFileSync(abs, 'utf8');
  const re = /(?:src|href)=["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html))) {
    const ref = m[1];
    if (ref.startsWith('http') || ref.startsWith('data:')) continue;
    const resolved = path.posix.normalize(
      path.posix.join(path.posix.dirname(relHtml), ref),
    );
    refs.push(resolved);
  }
}

if (manifest.action?.default_popup) {
  collectHtmlDeps(manifest.action.default_popup);
}

// Unique
const unique = [...new Set(refs)];
log('');
log('Referenced paths:');
let missing = 0;
for (const rel of unique) {
  const abs = path.join(root, rel);
  const ok = fs.existsSync(abs);
  log(`  ${ok ? 'OK ' : 'MISS'} ${rel}`);
  if (!ok) missing++;
}

// Import graph for module SW / popup (shallow)
function scanImports(rel, seen = new Set()) {
  if (seen.has(rel)) return;
  seen.add(rel);
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs) || !/\.m?js$/.test(abs)) return;
  const text = fs.readFileSync(abs, 'utf8');
  const re = /from\s+['"](\.\.?\/[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(text))) {
    let dep = path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1]));
    if (!dep.endsWith('.js')) dep += '.js';
    refs.push(dep);
    scanImports(dep, seen);
  }
}

if (manifest.background?.service_worker) scanImports(manifest.background.service_worker);
if (manifest.action?.default_popup) {
  const popupHtml = fs.readFileSync(path.join(root, manifest.action.default_popup), 'utf8');
  const sm = popupHtml.match(/src=["']([^"']+\.js)["']/);
  if (sm) {
    const rel = path.posix.normalize(
      path.posix.join(path.posix.dirname(manifest.action.default_popup), sm[1]),
    );
    scanImports(rel);
  }
}

const all = [...new Set(refs)];
log('');
log('After import walk:');
for (const rel of all) {
  const abs = path.join(root, rel);
  const ok = fs.existsSync(abs);
  if (!unique.includes(rel)) log(`  ${ok ? 'OK ' : 'MISS'} ${rel}`);
  if (!ok) missing++;
}

log('');
log(`summary: ${all.length} paths, missing=${missing}`);
if (missing > 0) {
  if (outPath) fs.writeFileSync(outPath, lines.join('\n') + '\n');
  process.exit(1);
}

if (outPath) fs.writeFileSync(outPath, lines.join('\n') + '\n');
log('PASS: extension package structurally loadable');
