# WhatStack Privacy Policy

**Last updated:** 2026-07-17

WhatStack is a browser extension that detects technologies used by web pages you visit (frameworks, libraries, analytics, etc.).

## Data collection

WhatStack does **not**:

- Collect personal information
- Create accounts or require login
- Upload page content, URLs, or detection results to any server
- Sell or share data with third parties
- Use advertising or tracking SDKs

## What happens on your device

When you open a page (or the extension popup), WhatStack may read, **only on your computer**:

- Public page structure (DOM markers, script/style URLs, cookie **names**, meta tags)
- Limited page JavaScript globals required for detection (e.g. framework hooks)
- Results shown in the toolbar badge and popup

Detection matching uses **bundled rules** shipped with the extension. Results stay in memory (and optionally in-session tab cache) and are not sent off-device by WhatStack.

## Reporting a wrong detection

The popup has a **“Wrong?”** button for telling us a detection is incorrect. WhatStack sends nothing itself. The button opens a new tab on the project's public GitHub issue tracker with a **draft** report prefilled, containing:

- the **site origin only** (for example `https://example.com`) — never the full URL, path, or query string
- what the extension reported, and the evidence it used
- the extension version and your browser's major version

Nothing is submitted until you read that draft and press GitHub's own submit button, and you can edit or delete any part of it first — including the site name. If you never press the button, no report is ever created. Reports become public issues on the project repository, so please don't include anything private.

## Permissions

| Permission | Why |
|------------|-----|
| Access to websites you visit (`http` / `https`) | Required to inspect the current page for stack signals |
| `scripting` | Run lightweight probes on the active page for deep scan |
| `tabs` | Know which tab is active; update the badge for that tab |

## Contact

For privacy questions about this extension, open an issue on the project repository or contact the publisher listed on the Chrome Web Store listing.

## Changes

We may update this policy when the product changes. Material changes will update the date above.
