# feature-0016-uw-package-the-desktop-app

**Type** feature · **Status** open · **Risk** medium · **Opened** 2026-10-10 · **Owner** @zerwiz

## Problem

**Current:** the desktop app is an Electron shell that runs the **development** server (`desktop/start.sh` → Vite). It needs a terminal-free install, a real icon, and it depends on `node_modules` being present in a checkout. **Expected:** a distributable the operator installs the way they install anything else, which runs the **built** app rather than a dev server.

## Impact

**Affected:** adoption. A dev-server wrapper is fine for the person who built it and a wall for anyone else.

## Architecture intent

Build once, serve locally, wrap in Electron. The dev-server wrapper stays for development; the packaged app is a separate, testable artifact.

## Requirements

- A packaged build runs the production bundle from local files, with **no dev server and no network** required to open it.
- The window keeps the existing behaviour: native title, icon, external links to the system browser, and the app surviving a window close.
- A launcher entry is installed and a _Stop_ action exists, as it already does for the dev shell.
- The packaged app is built by a documented command, not by hand.

## Non-goals

Not an app store submission; not auto-update; not code signing in this ticket.

## Test cases

- **Positive:** the packaged app opens with no dev server running and no network.
- **Negative:** with the collaboration server unset, it opens and edits locally.
- **Compatibility:** the launcher's Start/Stop still work.

## Constraints

The Electron version and the GPU switches that keep it from segfaulting on Wayland + NVIDIA are kept, with the reason.

## Resolution

_(filled on close)_

---

## Resolution

**Landed** 2026-10-10.

### The shape

`desktop/package.sh` builds the production bundle and copies it to `desktop/app/` (**not tracked** — a build artifact). `desktop/launch.sh` opens **packaged when a bundle is present**, and the dev shell otherwise, so there is one launcher entry and it does the right thing.

The Electron shell gained **packaged mode**: with `app/index.html` beside it, it starts a **loopback-only static server** on an ephemeral port and loads that, logging `packaged: serving the bundled app … (no dev server)`. A loopback server rather than `file://` on purpose: the build's asset URLs are absolute (`/assets/…`, `/fonts/…`), which `file://` cannot resolve, and the point is that the app opens untouched by how it is loaded.

The launcher entry now runs `launch.sh`, and carries a **Stop** action and a **Rebuild the packaged app** action beside it.

### Verified

- **Packaged and opened with no dev server running** — `:7311` confirmed free first — and the Electron log reads, in order: `packaged: serving the bundled app on 127.0.0.1:46199 (no dev server)` · `Loading Excalidraw at http://127.0.0.1:46199` · `Window ready to show` · `Page loaded successfully`.
- 45 MB, and `package.sh` **refuses to package** if `index.html` still names an external host — a guard, not a promise.
- The launcher validates (`desktop-file-validate`) and the desktop database was refreshed.
- **146 test files / 2514 app tests · 128 server tests**; eslint, prettier and typecheck clean.

### Three real severance leaks found while doing it

`feature-0001`'s scan covered `.ts`/`.tsx` only, so **the HTML template was never checked** — and it carried more than the runtime code ever did:

1. **A redirect to `https://app.excalidraw.com`** for Excalidraw+ users, in the production build.
2. **Google Fonts preconnects** (`fonts.googleapis.com`, `fonts.gstatic.com`).
3. **Simple Analytics loaded from `scripts.simpleanalyticscdn.com`** in _every_ production build — telemetry that `VITE_APP_ENABLE_TRACKING` was supposed to gate and never did.
4. Plus a **DigitalOcean CDN** for the font preloads, a **sitemap naming `excalidraw.com`**, and metadata naming somebody else's product and host.

All removed. The font plugin now emits **local** paths (233 woff2 files already ship in the build), the sitemap plugin and social-crawler `robots.txt` are gone, and telemetry is **removed rather than gated** — an operator who wants it adds their own script knowingly.

**The only remaining `excalidraw.com` reference in the built app is `docs.excalidraw.com`, in the help dialog** — kept deliberately by `chore-0001` as help and attribution.

### The lesson, which is a ticket-shaped one

**A severance scan that reads only the source languages misses the template that wraps them.** The grep in `feature-0001` was honest about what it covered and wrong about what that implied. The packaging guard — refuse to package if `index.html` names a host — is the durable fix, because it fails at build time rather than at review time.
