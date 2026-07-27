import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BRAND_ICONS, getBrandIcon } from '../shared/brand-icons.js';
import { SIGNATURES } from '../shared/signatures.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

describe('brand icons render in the popup', () => {
  /**
   * The popup builds each mark with
   * `new DOMParser().parseFromString(svg, 'image/svg+xml')`. XML parsing puts
   * the root in the null namespace when the document declares none, and a
   * null-namespace `<svg>` has tagName 'svg' but is not an SVGElement — so it
   * silently never paints and the row shows only its background colour.
   */
  it('every icon declares the SVG namespace', () => {
    const ids = [...Object.keys(BRAND_ICONS), 'no-such-tech-uses-the-fallback'];
    const missing = ids.filter((id) => {
      const svg = getBrandIcon(id).svg;
      return !svg.includes(`xmlns="${SVG_NS}"`);
    });
    assert.deepEqual(missing, [], `no xmlns on: ${missing.join(', ')}`);
  });

  it('declares the namespace exactly once, on the root element', () => {
    for (const id of Object.keys(BRAND_ICONS)) {
      const svg = getBrandIcon(id).svg;
      assert.equal(svg.split('xmlns=').length - 1, 1, `${id} has a duplicated xmlns`);
      assert.ok(svg.startsWith(`<svg xmlns="${SVG_NS}"`), `${id} declares it off-root`);
    }
  });

  it('gives every signature a dedicated mark, not the fallback', () => {
    const missing = SIGNATURES.map((s) => s.id).filter((id) => !BRAND_ICONS[id]);
    assert.deepEqual(missing, [], `falling back for: ${missing.join(', ')}`);
  });

  it('serves a fallback for an unknown id', () => {
    const icon = getBrandIcon('totally-unknown');
    assert.match(icon.svg, /^<svg /);
    assert.match(icon.bg, /^#[0-9a-f]{3,8}$/i);
  });
});
