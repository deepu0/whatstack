# WhatStack — launch film

![Launch film preview](preview.gif)

The GIF above is a silent, low-resolution preview. The full films are:

- **[whatstack-launch.mp4](whatstack-launch.mp4)**: landscape, 1920×1080, for X, LinkedIn and YouTube
- **[whatstack-launch-vertical.mp4](whatstack-launch-vertical.mp4)**: vertical, 1080×1920, for Reels, Shorts and TikTok

Both are 32 seconds at 60fps (1,920 frames), with an original score. Poster frames: [landscape](whatstack-launch.jpg), [vertical](whatstack-launch-vertical.jpg).

<img src="preview-vertical.gif" width="220" alt="Vertical preview">

## Beats
| Time | Beat | Real footage |
|---|---|---|
| 0–3s | *What's this site built with?* | stripe.com's real HTML source, blurred and scrolling |
| 3–5s | Reveal | Logo, **WhatStack**, *What's under this page?* |
| 5–9s | *It reads the stack while you browse.* | nextjs.org → notion.com → stripe.com, each with its real toolbar badge (4, 4, 4) |
| 9–13s | *One click. The whole stack.* | The icon is clicked, and the real stripe.com popup shows *Next.js 14.2.32 · React · Webpack* |
| 13–16s | *Confidence, not guesses.* | HIGH and MEDIUM badges light up, then GitHub's real *Lower confidence* section |
| 16–19s | *See why it matched.* | The real Next.js evidence (scripts, globals and DOM) |
| 19–23s | *Any site. Instantly.* | Real popups for notion.com, nextjs.org, react.dev, netflix.com, airbnb.com and vuejs.org |
| 23–26s | *Copy as text, Markdown or JSON.* | The real MD and JSON output from the Copy buttons |
| 26–28s | *Runs entirely on your device.* | The real *Local only* pill. Sizes are from the store listing (49 KB) |
| 28–32s | CTA | The real Chrome Web Store header (logged out), clicking *Add to Chrome*, then the end card |

## How it's made
It's rendered frame by frame from code, with no motion design app.

- [`source/capture.mjs`](source/capture.mjs) loads the **unpacked extension (v1.7.2)** into Chromium with Playwright, visits each site, reads the real badge, and opens the real `popup.html` against the real service worker and a real deep scan at 3× resolution. The only change is that `chrome.tabs.query` is pointed at the site's tab, because a popup opened as a tab would otherwise scan itself. Copy output is recorded from the real Copy / MD / JSON buttons.
- [`source/timeline.json`](source/timeline.json) sets every scene and cue in **beats** (120 BPM). The picture and the sound both read from it.
- [`source/engine.js`](source/engine.js) is a small animation engine built on [skia-canvas](https://skia-canvas.org). Every element is a pure function of time. The browser window is drawn as a 3D plane with true perspective, and each output frame averages **10 renders** for motion blur, which never spans a hard cut.
- [`source/render.js`](source/render.js) splits the frames across 8 parallel workers and pipes them into FFmpeg. [`source/score.py`](source/score.py) generates the music and UI sounds from the same timeline.

## Notes
- The browser window is a simple generic frame, not Chrome's real toolbar. It shows only the real WhatStack icon and badge.
- **Badge vs popup count:** the badge comes from the light scan when the page loads. The popup runs a deep scan, which can find more: on stripe.com the badge shows 4, but the popup shows "5 solid". Once the popup opens, the badge updates to 5. Both numbers are filmed exactly as the extension shows them.
- Linear is not included, because it reported Next.js "v1.0.0-beta.9", which looks like a detection bug.
- No technology count or user count is claimed.
