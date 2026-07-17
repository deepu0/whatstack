/**
 * Build a Chrome Web Store zip (extension files only — no tests/docs/git).
 * Usage: node scripts/package-extension.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const zipName = `whatstack-${manifest.version}.zip`;
const zipPath = path.join(outDir, zipName);

const include = [
  'manifest.json',
  'background',
  'content',
  'popup',
  'shared',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
];

fs.mkdirSync(outDir, { recursive: true });
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

// Prefer system zip
const args = ['-r', zipPath, ...include, '-x', '*/.DS_Store', 'icons/variant-*', 'icons/logo-512.png'];
try {
  execFileSync('zip', args, { cwd: root, stdio: 'inherit' });
} catch {
  console.error('zip CLI failed — install zip or package manually');
  process.exit(1);
}

const size = fs.statSync(zipPath).size;
console.log(`Packed ${zipName} (${(size / 1024).toFixed(1)} KB)`);
console.log(`Path: ${zipPath}`);
console.log('Upload this zip to Chrome Web Store Developer Dashboard.');
