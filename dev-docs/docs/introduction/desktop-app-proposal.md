# Proposal: an official lightweight Excalidraw desktop application

## Summary

This proposal asks whether Excalidraw would consider an official or incubating
desktop distribution built as a thin Tauri 2 shell around the official
`@excalidraw/excalidraw` package.

The PWA should remain the recommended zero-install experience. A desktop build
would target workflows where users expect Explorer file associations, native
open/save behavior, reliable offline startup, portable or managed installers,
and signed application updates.

This is intentionally a proposal for maintainer direction, not a request to
merge a large unsolicited implementation.

## Context

The previous [`excalidraw/excalidraw-desktop`](https://github.com/excalidraw/excalidraw-desktop)
Electron wrapper was intentionally deprecated in favor of the web version.
There is also a recent community Tauri client in
[Discussion #11216](https://github.com/excalidraw/excalidraw/discussions/11216).
Any renewed desktop effort should acknowledge those decisions and coordinate
with existing contributors rather than assume that an official native
distribution is desired.

A Windows proof of concept has been built to test the current tradeoffs. It uses
the published Excalidraw editor rather than forking the canvas implementation.

- [Proof-of-concept source repository](https://github.com/nikhilv9729/Excalidraw-Unofficial)
- [Windows proof-of-concept release](https://github.com/nikhilv9729/Excalidraw-Unofficial/releases/tag/v0.18.1-poc.1)

The attached binaries are unsigned evaluation builds. They are offered only to
make the proposal testable and are not presented as official Excalidraw
releases.

## Proof-of-concept scope

- Official `@excalidraw/excalidraw` editor package
- Bundled editor assets and offline editing
- Windows NSIS installer and portable executable
- Native `.excalidraw` open/save dialogs and file association
- Single-instance behavior for Explorer file opening
- Local recovery of unsaved drafts
- Trackpad pinch-to-zoom support through editor configuration
- Restricted Tauri permissions and content security policy
- Signed-updater architecture using GitHub Releases
- Scheduled upstream dependency checks that open reviewable pull requests

The proof of concept does not bundle Excalidraw Plus or the hosted collaboration
backend and adds no telemetry.

## Proposed architecture

| Layer | Responsibility |
|---|---|
| `@excalidraw/excalidraw` | Editor UI, scene model, serialization, and export |
| React/TypeScript shell | Document state, draft recovery, and desktop toolbar |
| Tauri/Rust shell | Window lifecycle, restricted file IPC, and installers |
| GitHub Actions | Tests, upstream-update PRs, signed release artifacts |

Keeping the desktop shell in a separate repository would let it consume stable
published editor releases without adding Rust and platform packaging to the main
monorepo. A monorepo workspace is possible if maintainers prefer closer release
coordination.

## Security and release model

- No remotely hosted frontend at runtime
- No shell-command API and no broad filesystem permission
- Native file commands limited to `.excalidraw` paths and a document-size cap
- Application CSP restricting scripts to bundled assets
- Exact dependency versions and committed lockfiles
- Human review between detected upstream updates and public releases
- Tauri update-signing keys and Windows Authenticode credentials controlled by
  the responsible organization

Official distribution would require maintainers to define signing ownership,
supported platforms, release approvals, issue triage, and security response.

## Possible ownership models

1. Official project under the Excalidraw organization.
2. Independently maintained community integration recognized by Excalidraw.
3. Incubation until maintenance history and platform coverage meet agreed
   requirements.
4. Remain fully independent if an official desktop distribution is not aligned
   with project goals.

## Questions

1. Would the project consider an official or recognized desktop distribution?
2. Is a thin shell around the published editor package an acceptable direction?
3. Would maintainers prefer a separate repository or monorepo integration?
4. Which platforms and features would be required before official adoption?
5. What ownership, branding, signing, and maintenance requirements would apply?
