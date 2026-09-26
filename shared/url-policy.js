/**
 * Which pages Chrome lets an extension read. Shared by the popup and the
 * service worker so both agree on what "cannot be scanned" means.
 */

const BLOCKED_SCHEMES =
  /^(?:chrome|chrome-extension|chrome-search|chrome-untrusted|edge|brave|opera|vivaldi|about|devtools|view-source|file|data|blob|filesystem|javascript):/i;

/**
 * True when the URL is not an http(s) page, or is one where Chrome blocks
 * extension scripts (the Chrome Web Store, Edge Add-ons).
 * @param {string} url
 */
export function isRestrictedUrl(url) {
  if (!url) return true;
  if (BLOCKED_SCHEMES.test(url)) return true;
  let u;
  try {
    u = new URL(url);
  } catch {
    return true;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return true;
  const host = u.hostname.toLowerCase();
  if (host === 'chromewebstore.google.com') return true;
  if (host === 'chrome.google.com' && u.pathname.startsWith('/webstore')) return true;
  if (host === 'microsoftedge.microsoft.com' && u.pathname.startsWith('/addons')) return true;
  return false;
}

/**
 * Same document? Ignores the fragment, which changes without a navigation.
 * @param {string} a
 * @param {string} b
 */
export function sameDocument(a, b) {
  const strip = (s) => String(s || '').split('#')[0];
  return strip(a) === strip(b);
}
