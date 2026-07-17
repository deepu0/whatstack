/**
 * WhatStack popup — deep scan, headline, exports, brand icons.
 */

import {
  shapeForPopup,
  formatStackSummary,
  formatStackMarkdown,
  formatStackJson,
} from '../shared/result-shape.js';
import { getBrandIcon } from '../shared/brand-icons.js';

const $ = (id) => document.getElementById(id);

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

function showError(message) {
  els.results.hidden = true;
  els.empty.hidden = true;
  els.headline.hidden = true;
  els.error.hidden = false;
  els.errorMsg.textContent = message;
  setCopyEnabled(false);
  setStatus('');
}

function render(shaped) {
  lastShaped = shaped;
  els.error.hidden = true;

  if (shaped.error === 'restricted') {
    showError('This page cannot be scanned (browser internal URL).');
    return;
  }

  if (shaped.empty) {
    els.results.hidden = true;
    els.headline.hidden = true;
    els.empty.hidden = false;
    setCopyEnabled(false);
    setStatus(shaped.pass === 'deep' ? 'Deep scan complete' : 'Light scan');
    return;
  }

  els.empty.hidden = true;
  els.results.hidden = false;
  els.results.replaceChildren();
  setCopyEnabled(true);

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

async function load(forceDeep = true) {
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
    showError('Could not read active tab.');
    return;
  }

  if (!tab || tab.id == null) {
    showError('No active tab.');
    return;
  }

  const url = tab.url || '';
  els.pageUrl.textContent = url;
  els.pageUrl.title = url;

  if (/^(chrome|chrome-extension|edge|about|devtools):/i.test(url)) {
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
    if (!response || !response.ok) {
      showError('Scan failed. Try Rescan or reload the page.');
      return;
    }
    const result = response.result;
    if (result && result.error === 'restricted') {
      const shaped = shapeForPopup(result);
      shaped.error = 'restricted';
      render(shaped);
      return;
    }
    render(shapeForPopup(result));
  } catch (e) {
    showError(e && e.message ? e.message : 'Scan failed.');
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

load(true);
