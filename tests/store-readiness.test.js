/**
 * Publish-readiness checks against real in-repo artifacts (not reimplemented logic).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

function pngDimensions(absPath) {
  const buf = fs.readFileSync(absPath);
  assert.equal(buf.toString('ascii', 1, 4), 'PNG');
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  return { w, h };
}

describe('store publish readiness', () => {
  it('manifest and package.json versions match and MV3 is clean', () => {
    const m = readJson('manifest.json');
    const p = readJson('package.json');
    assert.equal(m.manifest_version, 3);
    assert.equal(m.version, p.version);
    assert.ok(m.description.length > 10 && m.description.length <= 132);
    assert.deepEqual(m.permissions.sort(), ['scripting', 'tabs'].sort());
    assert.ok(!m.permissions.includes('storage'));
    for (const icon of Object.values(m.icons)) {
      assert.ok(fs.existsSync(path.join(root, icon)), icon);
    }
  });

  it('privacy policy source exists and public URL is documented', () => {
    const policyPath = path.join(root, 'PRIVACY.md');
    assert.ok(fs.existsSync(policyPath));
    const policy = fs.readFileSync(policyPath, 'utf8');
    assert.match(policy, /does \*\*not\*\*/i);
    assert.match(policy, /only on your (computer|device)/i);
    assert.match(policy, /Sell or share data/i);

    const urlFile = path.join(root, 'store/privacy-url.txt');
    assert.ok(fs.existsSync(urlFile));
    const urlText = fs.readFileSync(urlFile, 'utf8');
    assert.match(urlText, /PUBLIC_PRIVACY_POLICY_URL=https:\/\/gist\.githubusercontent\.com\//);
    const url = urlText
      .split('\n')
      .find((l) => l.startsWith('PUBLIC_PRIVACY_POLICY_URL='))
      .split('=')
      .slice(1)
      .join('=');
    assert.ok(url.startsWith('https://'));
  });

  it('listing copy and screenshot assets exist at Chrome-accepted sizes', () => {
    assert.ok(fs.existsSync(path.join(root, 'store/LISTING.md')));
    const listing = fs.readFileSync(path.join(root, 'store/LISTING.md'), 'utf8');
    assert.match(listing, /Short description/i);
    assert.match(listing, /Detailed description/i);
    assert.match(listing, /Single purpose/i);
    assert.match(listing, /Permission justifications/i);
    assert.match(listing, /gist\.githubusercontent\.com/);

    const shots = [
      ['store/screenshots/screenshot-1-1280x800.png', 1280, 800],
      ['store/screenshots/screenshot-2-1280x800.png', 1280, 800],
      ['store/screenshots/screenshot-3-640x400.png', 640, 400],
      ['store/promo/promo-tile-440x280.png', 440, 280],
    ];
    for (const [rel, ew, eh] of shots) {
      const abs = path.join(root, rel);
      assert.ok(fs.existsSync(abs), rel);
      const { w, h } = pngDimensions(abs);
      assert.equal(w, ew, `${rel} width`);
      assert.equal(h, eh, `${rel} height`);
    }
  });

  it('npm run pack produces a minimal runtime zip with all manifest refs', () => {
    execFileSync('npm', ['run', 'pack'], { cwd: root, stdio: 'pipe' });
    const m = readJson('manifest.json');
    const zipPath = path.join(root, 'dist', `whatstack-${m.version}.zip`);
    assert.ok(fs.existsSync(zipPath), zipPath);

    const listing = execFileSync('unzip', ['-l', zipPath], { encoding: 'utf8' });
    assert.ok(!listing.includes('tests/'));
    assert.ok(!listing.includes('docs/'));
    assert.ok(!listing.includes('.git/'));
    assert.ok(!listing.includes('variant-'));
    assert.ok(listing.includes('manifest.json'));
    assert.ok(listing.includes('shared/detect.js'));

    // extract to temp under dist for path checks
    const extractDir = path.join(root, 'dist', '_verify_extract');
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.mkdirSync(extractDir, { recursive: true });
    execFileSync('unzip', ['-q', zipPath, '-d', extractDir]);
    const zm = JSON.parse(fs.readFileSync(path.join(extractDir, 'manifest.json'), 'utf8'));
    assert.equal(zm.manifest_version, 3);
    const refs = [
      zm.action.default_popup,
      zm.background.service_worker,
      ...zm.content_scripts.flatMap((c) => c.js || []),
      ...Object.values(zm.icons),
      ...Object.values(zm.action.default_icon),
    ];
    for (const r of refs) {
      assert.ok(fs.existsSync(path.join(extractDir, r)), `zip missing ${r}`);
    }
    fs.rmSync(extractDir, { recursive: true, force: true });
  });

  it('toolbar and store icons are the sizes the manifest claims', () => {
    const m = readJson('manifest.json');
    for (const [size, rel] of [...Object.entries(m.icons), ...Object.entries(m.action.default_icon)]) {
      const { w, h } = pngDimensions(path.join(root, rel));
      assert.equal(w, Number(size), `${rel} width`);
      assert.equal(h, Number(size), `${rel} height`);
    }
  });

  it('version is consistent across manifest, package, lockfile and release notes', () => {
    execFileSync('node', ['scripts/check-version.mjs'], { cwd: root, stdio: 'pipe' });
  });
});
