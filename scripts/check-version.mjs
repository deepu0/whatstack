/**
 * Release consistency: manifest.json, package.json and package-lock.json agree,
 * and docs/RELEASE-<version>.md exists.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const manifest = read('manifest.json').version;
const pkg = read('package.json').version;
const lock = read('package-lock.json');
const problems = [];
if (pkg !== manifest) problems.push(`package.json ${pkg} != manifest.json ${manifest}`);
if (lock.version !== manifest) problems.push(`package-lock.json ${lock.version} != manifest.json ${manifest}`);
if (lock.packages?.['']?.version && lock.packages[''].version !== manifest) problems.push(`package-lock root ${lock.packages[''].version} != ${manifest}`);
if (!/^\d+\.\d+\.\d+$/.test(manifest)) problems.push(`manifest version "${manifest}" is not x.y.z`);
if (!fs.existsSync(path.join(root, 'docs', `RELEASE-${manifest}.md`))) problems.push(`docs/RELEASE-${manifest}.md is missing`);
if (problems.length) {
  console.error('FAIL\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`OK  version ${manifest} is consistent`);
