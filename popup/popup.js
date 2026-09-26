/**
 * WhatStack popup — deep scan, headline, exports, brand icons.
 */

import {
  shapeForPopup,
  formatStackSummary,
  formatStackMarkdown,
  formatStackJson,
  buildReportUrl,
} from '../shared/result-shape.js';
import { getBrandIcon } from '../shared/brand-icons.js';
import { isRestrictedUrl } from '../shared/url-policy.js';

/** @param {string} id */
const $ = (id) => /** @type {HTMLButtonElement} */ (document.getElementById(id));

const els = {
  status: $('status'),
  results: $('results'),
  empty: $('empty'),
  error: $('error'),
  errorMsg: $('error-msg'),
  pageUrl: $('page-url'),
  headline: $('headline'),
  headlineText: $('headline-text'),
  copy: $('copy'),
  copyMd: $('copy-md'),
  copyJson: $('copy-json'),
  report: $('report'),
  refresh: $('refresh'),
};

/** @type {ReturnType<typeof shapeForPopup> | null} */
let lastShaped = null;

function setStatus(text) {
  els.status.textContent = text;
}

function setCopyEnabled(on) {
  els.copy.disabled = !on;
  els.copyMd.disabled = !on;
  els.copyJson.disabled = !on;
}

// Tracked separately from the exports: "you missed something" is a valid report
// on a page where nothing was detected, and that is the most useful kind.
function setReportEnabled(on) {
  els.report.disabled = !on;
}

function showError(message) {
  els.results.hidden = true;
  els.empty.hidden = true;
  els.headline.hidden = true;
  els.error.hidden = false;
  els.errorMsg.textContent = message;
  setCopyEnabled(false);
  setReportEnabled(false);
  setStatus('');
}

function render(shaped) {
  lastShaped = shaped;
  els.error.hidden = true;

  if (shaped.error === 'restricted') {
    showError('Chrome doesn’t let extensions read this page (browser pages, the Web Store, local files).');
    return;
  }
  if (shaped.error === 'unreachable') {
    showError('This page couldn’t be read. Reload it, then try Rescan.');
    return;
  }

  if (shaped.empty) {
    els.results.hidden = true;
    els.headline.hidden = true;
    els.empty.hidden = false;
    setCopyEnabled(false);
    setReportEnabled(true);
    setStatus(shaped.pass === 'deep' ? 'Deep scan complete' : 'Light scan');
    return;
  }

  els.empty.hidden = true;
  els.results.hidden = false;
  els.results.replaceChildren();
  setCopyEnabled(true);
  setReportEnabled(true);

  if (shaped.headline) {
    els.headline.hidden = false;
    els.headlineText.textContent = shaped.headline;
  } else {
    els.headline.hidden = true;
  }

  for (const section of shaped.sections) {
    const sec = document.createElement('section');
    sec.className = 'section';

    const title = document.createElement('h2');
    title.className = 'section-title';
    title.textContent = section.label;
    sec.appendChild(title);

    for (const hit of section.hits) {
      sec.appendChild(renderHit(hit));
    }

    if (section.lowHits.length) {
      const lowHead = document.createElement('div');
      lowHead.className = 'low-head';
      lowHead.textContent = 'Lower confidence — verify before trusting';
      sec.appendChild(lowHead);
      for (const hit of section.lowHits) {
        sec.appendChild(renderHit(hit));
      }
    }

    els.results.appendChild(sec);
  }

  const primary = shaped.primary ? ` · ${shaped.primary.name}` : '';
  setStatus(
    `${shaped.highMediumCount} solid · ${shaped.totalVisible} total · ${shaped.pass}${primary}`,
  );
}

/**
 * @param {object} hit
 */
function renderHit(hit) {
  const wrap = document.createElement('div');
  wrap.className = 'hit';

  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'hit-row';
  row.setAttribute('aria-expanded', 'false');

  const left = document.createElement('span');
  left.className = 'hit-left';

  const icon = getBrandIcon(hit.id);
  const mark = document.createElement('span');
  mark.className = 'tech-icon';
  mark.style.background = icon.bg;
  mark.setAttribute('aria-hidden', 'true');
  // Safer than innerHTML for static bundled SVGs
  try {
    const parsed = new DOMParser().parseFromString(icon.svg, 'image/svg+xml');
    const svg = parsed.documentElement;
    if (svg && svg.tagName.toLowerCase() === 'svg' && !parsed.querySelector('parsererror')) {
      mark.appendChild(document.importNode(svg, true));
    }
  } catch {
    /* ignore icon */
  }
  left.appendChild(mark);

  const textWrap = document.createElement('span');
  textWrap.className = 'hit-text';
  const name = document.createElement('span');
  name.className = 'hit-name';
  name.textContent = hit.name;
  textWrap.appendChild(name);
  if (hit.version) {
    const ver = document.createElement('span');
    ver.className = 'hit-version';
    ver.textContent = hit.version.startsWith('v') ? hit.version : `v${hit.version}`;
    textWrap.appendChild(ver);
  }
  left.appendChild(textWrap);

  const badge = document.createElement('span');
  badge.className = `badge ${hit.confidence}`;
  badge.textContent = hit.confidence;

  row.appendChild(left);
  row.appendChild(badge);

  const evidence = document.createElement('ul');
  evidence.className = 'evidence';
  if (!hit.evidence || !hit.evidence.length) {
    const li = document.createElement('li');
    li.textContent = 'No evidence details';
    evidence.appendChild(li);
  } else {
    for (const e of hit.evidence) {
      const li = document.createElement('li');
      const t = document.createElement('span');
      t.className = 'type';
      t.textContent = e.type;
      li.appendChild(t);
      li.appendChild(document.createTextNode(e.snippet));
      evidence.appendChild(li);
    }
  }

  row.addEventListener('click', () => {
    const open = wrap.classList.toggle('open');
    row.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  wrap.appendChild(row);
  wrap.appendChild(evidence);
  return wrap;
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

/** Increments per load(); a slower, older scan must never render over a newer one. */
let loadSeq = 0;

async function load(forceDeep = true) {
  const seq = ++loadSeq;
  const current = () => seq === loadSeq;
  els.refresh.disabled = true;
  try {
    await runLoad(forceDeep, current);
  } finally {
    if (current()) els.refresh.disabled = false;
  }
}

/**
 * @param {boolean} forceDeep
 * @param {() => boolean} current
 */
async function runLoad(forceDeep, current) {
  setStatus('Scanning…');
  els.error.hidden = true;
  els.empty.hidden = true;
  els.results.hidden = true;
  els.headline.hidden = true;
  setCopyEnabled(false);

  let tab;
  try {
    tab = await getActiveTab();
  } catch {
    if (current()) showError('Could not read the active tab.');
    return;
  }
  if (!current()) return;

  if (!tab || tab.id == null) {
    showError('No active tab.');
    return;
  }

  const url = tab.url || '';
  els.pageUrl.textContent = url;
  els.pageUrl.title = url;

  if (isRestrictedUrl(url)) {
    const shaped = shapeForPopup({
      url,
      pass: 'deep',
      hits: [],
      primary: null,
    });
    shaped.error = 'restricted';
    render(shaped);
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_RESULT',
      tabId: tab.id,
      url,
      forceDeep,
    });
    if (!current()) return;
    if (!response || !response.ok) {
      showError('Scan failed. Try Rescan or reload the page.');
      return;
    }
    const result = response.result;
    if (result && result.url && result.url !== url) {
      // The tab navigated while the popup opened; show the page that answered.
      els.pageUrl.textContent = result.url;
      els.pageUrl.title = result.url;
    }
    const shaped = shapeForPopup(result);
    if (result && (result.error === 'restricted' || result.error === 'unreachable')) shaped.error = result.error;
    render(shaped);
  } catch {
    if (current()) showError('Scan failed. Try Rescan or reload the page.');
  }
}

async function copyText(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus(okMsg);
  } catch {
    setStatus('Copy failed');
  }
}

els.refresh.addEventListener('click', () => load(true));
els.copy.addEventListener('click', () => {
  if (!lastShaped) return;
  copyText(formatStackSummary(lastShaped), 'Copied text summary');
});
els.copyMd.addEventListener('click', () => {
  if (!lastShaped) return;
  copyText(formatStackMarkdown(lastShaped), 'Copied Markdown');
});
els.copyJson.addEventListener('click', () => {
  if (!lastShaped) return;
  copyText(formatStackJson(lastShaped), 'Copied JSON');
});

/** Chrome major version, for reproducing a report. Nothing finer-grained. */
function browserLabel() {
  const m = /Chrom(?:e|ium)\/(\d+)/.exec(navigator.userAgent || '');
  return m ? `Chrome ${m[1]}` : '';
}

els.report.addEventListener('click', () => {
  if (!lastShaped) return;
  // Opens GitHub's issue form prefilled. The extension sends nothing itself —
  // the user reads the draft and submits it, so "Local only" still holds.
  const url = buildReportUrl(lastShaped, {
    version: chrome.runtime.getManifest().version,
    browser: browserLabel(),
  });
  chrome.tabs.create({ url });
  setStatus('Opened a report — review it, then submit');
});

load(true);
