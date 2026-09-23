# Excalidraw desktop foundation

This directory contains the focused Tauri 2 desktop slice for `excalidraw-app`. The browser application remains the default target and keeps its existing `browser-fs-access`, localStorage, IndexedDB, and PWA behavior.

## Local development

Use Node within the repository's declared 18–22 range, Yarn 1.22.22 (via Corepack if needed), and a current stable Rust toolchain. Install dependencies with `yarn install --frozen-lockfile` at the repository root. Tauri also requires the native build prerequisites for your platform: Windows C++ build tools and WebView2, macOS Xcode command-line tools, or the Linux WebKitGTK/system development packages.

From `excalidraw-app`:

```sh
yarn tauri:dev
```

The desktop shell uses the Vite development server on `http://localhost:3000`. The Rust commands and capabilities are under `src-tauri/`.

To build the application and installer bundles (requires release signing setup below):

```sh
yarn tauri:build
```

For a local executable without installer/updater signing, use `yarn tauri build --no-bundle --debug`. Building still requires installed dependencies and may download toolchain or bundler components; offline runtime support does not mean a fresh build is network-free.

The bundle includes the Vite output and does not require a remote API for startup, opening a scene, saving a scene, or restoring the last desktop scene. Windows WebView2 installation is configured to use the normal bootstrapper; release maintainers should choose the offline or fixed-runtime mode when distributing to machines without WebView2 or internet access.

## Security boundary

The renderer does not receive filesystem, shell, or network capabilities. Scene open/save uses native user-selection dialogs and sends only document contents across the typed Tauri command boundary. Rust validates the JSON, scene shape, embedded image data URLs, extension, size, and selected path before reading or replacing a file. Renderer-supplied paths are not accepted. Writes use a temporary file and atomic replacement. Recovery is always the single `last-scene.excalidraw` file in the application-data directory.

Only `.excalidraw` and `.json` scene operations use the native bridge in this slice. Image import and library import/export intentionally retain the existing browser fallback until they have an equivalent constrained desktop seam. Embedded SVG data URLs are accepted as Excalidraw image data, but the native validator checks only the data-URL/MIME/base64 envelope; it is not an SVG sanitizer.

Path checks reject traversal, symlinks and reparse points; Windows additionally rejects network/mapped drives, device names and alternate data streams. These checks are not a sandbox against a hostile local process racing filesystem changes. Unix network mounts are not reliably distinguished from local files. Atomic replacement does not guarantee durability across sudden power loss.

## Recovery and compatibility limits

- Native documents, including embedded image data, have a **10 MiB UTF-8 limit**. Native schema validation is stricter than browser import and accepts scene versions 1 and 2 with the supported element types.
- Every native save opens a destination dialog; there is no persistent file handle or silent overwrite of the last user-selected file.
- Desktop recovery is a secondary copy. A valid browser-stored scene, including an intentionally saved empty scene, takes precedence. Recovery is attempted when browser scene storage is absent, unreadable or corrupt, and restores embedded images without depending on IndexedDB.
- Recovery writes are debounced by 300 ms and serialized. Blur/hidden events flush pending edits; unload/beforeunload flushes are **best effort**, not a guarantee that the last edit reaches disk before close or a crash. Persistence failures are logged without document contents; use explicit Save for important work.
- Desktop CSP and navigation restrictions block remote services, external navigation and new windows. Collaboration, cloud sharing, remote embeds and external links are not supported by this offline desktop slice. The browser target retains its existing behavior.

## Updates and release bundles

`src-tauri/tauri.conf.json` declares signed updater configuration with safe placeholders:

- endpoint: `https://updates.invalid/...`
- public key: `REPLACE_WITH_TAURI_UPDATER_PUBLIC_KEY`

These values are deliberately unusable for publishing. A release maintainer must generate and protect a Tauri signing key, replace the public key, provide an HTTPS endpoint containing signed artifacts, and set `TAURI_SIGNING_PRIVATE_KEY` (and optionally `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) only in the release environment. Never commit a private key or enable publishing from this repository without a separate reviewed release change.

The updater plugin is registered, but no update-check/install UI or renderer updater permissions are enabled. A separate reviewed integration is needed to offer updates. Updater signatures also do not replace Windows code signing or macOS signing/notarization.

The configured Tauri 2 bundle targets are:

- Windows NSIS setup executable
- macOS application/DMG
- Linux AppImage, Debian, and RPM packages

No release workflow or external publication step is enabled by this change.

Cross-platform bundle targets are configuration only in this repository. Validate Windows, macOS, and Linux installers on their respective build environments before publishing; the local Windows verification covers the Tauri configuration and unbundled debug build, not DMG or Linux package generation.
