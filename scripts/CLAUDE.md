## Build Tooling

The `scripts/` directory owns the build, bundling, release, font processing, and i18n coverage tooling for the monorepo. All scripts are CommonJS Node.js programs invoked via `yarn` workspace commands.

### Package ESM Builds

Every publishable package uses esbuild and produces two variants: an unminified dev build with source maps under `dist/dev/`, and a minified production build without source maps under `dist/prod/`. Three build scripts handle the different packaging needs:

- `scripts/buildPackage.js` — builds `@excalidraw/excalidraw`. Entry points are `index.tsx` and any `**/*.chunk.ts` file (code-split chunks). Uses `esbuild-sass-plugin` with a custom `precompile` function that rewrites relative SCSS `@use`/`@forward` paths to `file://` absolute URLs so Sass can resolve them during bundling. `.woff2` files are emitted as file assets. All sibling `@excalidraw/*` packages (`common`, `element`, `math`, `fractional-indexing`) are marked external; `@excalidraw/utils` is aliased to its source directory. Environment variables are loaded from `.env.development` / `.env.production` via `packages/excalidraw/env.cjs`.

- `scripts/buildBase.js` — minimal build for smaller utility packages within `packages/` (used for `common`, `element`, `math`, `fractional-indexing`). Single entry `src/index.ts`, no Sass or woff2 handling. Same external/alias pattern as `buildPackage.js`.

- `scripts/buildUtils.js` — builds `@excalidraw/utils` with ALL `@excalidraw/*` packages aliased to their source directories (including `common`, `element`, `excalidraw`, `math`, `fractional-indexing`, and `utils` itself), making the utils bundle fully self-contained with no external peers. Also includes `sassPlugin()` and `woff2ServerPlugin` (see font section below). In production, `woff2ServerPlugin` receives `{ outdir: \'dist/prod/assets\' }` to trigger TTF generation; in dev, it receives no options and only inlines base64.

### WASM Modules

`scripts/buildWasm.js` converts two committed binary WASM files into TypeScript modules that export a base64 decode function. The source files are `scripts/wasm/woff2.wasm` (from `fonteditor-core`) and `scripts/wasm/hb-subset.wasm` (from `harfbuzzjs`). Running this script regenerates `packages/excalidraw/fonts/wasm/woff2-wasm.ts` and `packages/excalidraw/fonts/wasm/hb-subset-wasm.ts`. The generated files are checked in; the script is only re-run when the upstream WASM modules change. Each generated file embeds its source package\'s name, version, author, and license text as a comment block.

### Font Build Plugins

Font processing is split between two environments:

**Server-side (esbuild)** — `scripts/woff2/woff2-esbuild-plugins.js` exports `woff2ServerPlugin`. When added to an esbuild configuration, it intercepts `.woff2` imports and inlines them as base64 `data:font/woff2;base64,...` strings (needed because esbuild\'s `file` loader is broken in CommonJS and `dataurl` loader produces incorrect URIs). When an `outdir` option is provided, the plugin also generates merged TTF files at build-end: it decompresses woff2 → SNFT → TTF using `wawoff2` and `fonteditor-core`, then calls `pyftmerge` (Python `fonttools` must be installed) to merge multiple unicode-range woff2 files for the same family into a single TTF. Fallback fonts are appended to every family: NotoEmoji and LiberationSans for all fonts; Xiaolai additionally for Excalifont-family fonts (CJK support). The `vhea`/`vmtx` tables are dropped during merge to avoid pyftmerge conflicts. The 2048-unit-em variants under `scripts/woff2/assets/` exist because `pyftmerge` requires all merged fonts to share the same `unitsPerEm`; the Xiaolai family is skipped from TTF generation as it ships as a single TTF already.

**Browser (Vite)** — `scripts/woff2/woff2-vite-plugins.js` exports `woff2BrowserPlugin`. In production builds it does two things: rewrites `packages/excalidraw/fonts/fonts.css` to replace its Assistant font-face definitions with ones that point at the DigitalOcean Spaces CDN (`https://excalidraw.nyc3.cdn.digitaloceanspaces.com/oss/`) with a root-relative fallback URL, and injects a `window.EXCALIDRAW_ASSET_PATH` script and `<link rel="preload">` tags (for Excalifont, Nunito latin range, Assistant-SemiBold, and ComicShanns) into `excalidraw-app/index.html` by replacing `<!-- PLACEHOLDER:EXCALIDRAW_APP_FONTS -->`. This plugin is a no-op during development (`command === \'serve\'`).

### Release Orchestration

`scripts/release.js` is the single entry point for publishing `@excalidraw/*` packages to npm. It accepts three tags:

- `test` (default): publishes with the "test" npm tag; version is `<current-excalidraw-version>-<short-commit-hash>` for idempotent re-runs.
- `next`: same version scheme, published under the "next" npm tag; `--non-interactive` flag skips prompts for CI use.
- `latest`: requires an explicit `--version=X.Y.Z`; updates the changelog and prompts to commit before publishing.

Packages are published in dependency order: `common`, `fractional-indexing`, `math`, `element`, `excalidraw`. `@excalidraw/utils` is explicitly excluded and has its own independent release process. Before publishing, the script stamps every `package.json` with the new version and also updates any `@excalidraw/*` entries inside each package\'s `dependencies`. All package JSONs are modified atomically after all are computed, to avoid leaving the repo in a partially-updated state.

The build step inside the release flow runs `yarn --frozen-lockfile` at the root, removes existing build artifacts with `yarn rm:build`, then runs `yarn run build:esm` in each package directory in order.

### Changelog Automation

`scripts/updateChangelog.js` (a module exported for use by `release.js`) finds the previous release by grepping git log for commits matching the message `"release @excalidraw/excalidraw"`, then collects all commits since that commit on `master`. Only conventional commit types `feat`, `fix`, `style`, `refactor`, `perf`, and `build` are included. PR references are converted to GitHub markdown links. Commits without a PR number are flagged as "bad commits" and still included but without a link. The script skips PRs whose numbers already appear in the existing changelog (avoids duplicating package-update entries). The updated content replaces the `## Unreleased` heading with a versioned date heading in `packages/excalidraw/CHANGELOG.md`.

### App Version Stamping

`scripts/build-version.js` runs after the Vite app build. It writes `build/version.json` containing `{"version": "<commit-date-ISO>-<short-commit-hash>"}` (the date comes from the actual HEAD commit timestamp via `git show -s --format=%ct`, not the current wall-clock time) and replaces all `{version}` template literals in `build/index.html`.

### Docs Build Gate

`scripts/buildDocs.js` is a CI utility that diffs HEAD^ against HEAD and exits 0 if no `docs`-containing files changed (skip docs build) or exits 1 if they did (trigger docs build). It is used as a conditional build step for the docs site.

### Node.js Rendering Build

`scripts/build-node.js` is a legacy script that uses `rewire` to patch the CRA (`react-scripts`) webpack config for a headless Node.js build: it disables code splitting, sets a deterministic output filename, targets the `node` platform, and points the entry to `packages/excalidraw/index-node`. The `canvas` npm package (which requires Cairo) must be installed manually and is not part of the standard release flow.

### i18n Coverage

Two scripts manage translation coverage for the locales in `packages/excalidraw/locales/`:

- `scripts/build-locales-coverage.js` computes per-locale translation completion percentages (non-empty leaf keys / total leaf keys, via recursive flatten) and writes `packages/excalidraw/locales/percentages.json`.
- `scripts/locales-coverage-description.js` reads that percentages file and prints a Markdown table with flags, native language names, Crowdin links, and coverage percentages. The threshold for appearing on production Excalidraw is **85%**; locales below that are shown as `...`.

### Relevant Documentation

- `packages/excalidraw/locales/README.md` — explains how to contribute translations and how the Crowdin integration works.
- `CONTRIBUTING.md` — covers the general development and release workflow.