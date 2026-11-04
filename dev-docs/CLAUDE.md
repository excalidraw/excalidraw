## What This Area Is

The `dev-docs/` directory is the source for Excalidraw's public developer documentation site, published at `https://docs.excalidraw.com`. It is a standalone Docusaurus 2 application — not part of the main Yarn monorepo — with its own `dev-docs/package.json`, `dev-docs/yarn.lock`, and `node_modules`. Run it locally with `yarn start` (port 3003) from inside `dev-docs/`.

## Content Structure

Content is organised into four top-level sidebar sections, defined in `dev-docs/sidebars.js`:

### Introduction
Developer onboarding: local setup, CodeSandbox links, Docker self-hosting, collaboration server references, and contributing guidance.

### Codebase
Internal design notes for contributors:
- `dev-docs/docs/codebase/json-schema.mdx` — the `.excalidraw` file format (type, version, source, elements, appState, files) and the clipboard variant (`excalidraw/clipboard`).
- `dev-docs/docs/codebase/frames.mdx` — element-ordering invariant for frames: children must precede their frame element in the array, which the renderer depends on for correct clipping and performance.

### @excalidraw/excalidraw
Full API reference for the npm package. Key sub-sections:

**Props** (`dev-docs/docs/@excalidraw/excalidraw/api/props/`) — all props are optional. Notable ones: `initialData` (scene seed), `excalidrawAPI` (callback that delivers the imperative API object, replacing the old `ref` approach removed in v0.17.0), `onChange` (receives elements + appState + files on every change), `isCollaborating`, `theme`, `UIOptions`, `validateEmbeddable`. Custom data can be stored on any element via a `customData` object.

**ExcalidrawAPI** (`dev-docs/docs/@excalidraw/excalidraw/api/props/excalidraw-api.mdx`) — imperative methods obtained via the `excalidrawAPI` prop callback: `updateScene`, `updateLibrary`, `addFiles`, `resetScene`, `getSceneElements`, `getSceneElementsIncludingDeleted`, `getAppState`, `getFiles`, `scrollToContent`, `refresh`, `setToast`, `setActiveTool`, `setCursor`, `resetCursor`, `toggleSidebar`, `history.clear()`, plus event subscription methods `onChange`, `onPointerDown`, `onPointerUp`. The `ready`/`readyPromise` APIs were removed in v0.17.0.

**Children Components** (`dev-docs/docs/@excalidraw/excalidraw/api/children-components/`) — UI customisation via JSX children of `<Excalidraw>`: `MainMenu`, `WelcomeScreen`, `Sidebar`, `Footer`, `LiveCollaborationTrigger`. The migration to this children-component API is ongoing; some UI surfaces (toolbar, element properties panel) are not yet supported.

**Utils** (`dev-docs/docs/@excalidraw/excalidraw/api/utils/utils-intro.md`) — pure JS helpers exported from the package: serialization (`serializeAsJSON`, `serializeLibraryAsJSON`), blob loading (`loadFromBlob`, `loadLibraryFromBlob`, `loadSceneOrLibraryFromBlob`), geometry (`getCommonBounds`, `elementsOverlappingBBox`, `isElementInsideBBox`, `elementPartiallyOverlapsWithOrContainsBBox`), library helpers (`mergeLibraryItems`, `parseLibraryTokensFromUrl`, `useHandleLibrary`), element predicates (`isLinearElement`, `isInvisiblySmallElement`, `getNonDeletedElements`), coordinate conversion (`sceneCoordsToViewportCoords`, `viewportCoordsToSceneCoords`), i18n (`defaultLang`, `languages`, `useI18n`), and the `useEditorInterface` hook (form-factor detection inside `<Excalidraw>` children). Export utilities are in `dev-docs/docs/@excalidraw/excalidraw/api/utils/export.mdx` and restore utilities in `dev-docs/docs/@excalidraw/excalidraw/api/utils/restore.mdx`.

**Element skeleton** (`dev-docs/docs/@excalidraw/excalidraw/api/excalidraw-element-skeleton.mdx`) and **Constants** (`dev-docs/docs/@excalidraw/excalidraw/api/constants.mdx`) complete the reference.

**Customising styles** (`dev-docs/docs/@excalidraw/excalidraw/customizing-styles.mdx`) and an **FAQ** (`dev-docs/docs/@excalidraw/excalidraw/faq.mdx`) are also included.

### @excalidraw/mermaid-to-excalidraw
Installation, API reference, and codebase internals for the Mermaid-to-Excalidraw conversion library, including a parser walkthrough and a guide for adding new diagram types (`dev-docs/docs/@excalidraw/mermaid-to-excalidraw/codebase/new-diagram-type.mdx`).

## Live Code Examples

The site uses `@docusaurus/theme-live-codeblock`. Code blocks marked ` ```jsx live ` render as interactive editors. The available scope is defined in `dev-docs/src/theme/ReactLiveScope/index.js`, which loads `@excalidraw/excalidraw` (currently pinned at `0.18.0` in the docs package's dependencies) only on the client side (guarded by `ExecutionEnvironment.canUseDOM`). The scope exports: `Excalidraw` (a wrapper that auto-injects the `theme` from Docusaurus color mode), `Footer`, `MainMenu`, `WelcomeScreen`, `LiveCollaborationTrigger`, `Sidebar`, `useDevice`, `useI18n`, `exportToCanvas`, `convertToExcalidrawElements`, `CaptureUpdateAction`, plus `initialData` (the demo library items in `dev-docs/src/initialData.js`).

`window.EXCALIDRAW_ASSET_PATH` is set to `https://esm.sh/@excalidraw/excalidraw@0.18.0/dist/prod/` inside `ReactLiveScope` so live examples load fonts from the CDN. The Docusaurus config (`dev-docs/docusaurus.config.js`) sets `process.env.IS_PREACT = "false"` globally to prevent the Excalidraw package from throwing on `process` being undefined.

## Infrastructure

- **Deployment**: Vercel (`dev-docs/vercel.json`). The `editUrl` in `docusaurus.config.js` points to `https://github.com/excalidraw/excalidraw/tree/master/dev-docs/` so every page has an "Edit this page" link.
- **Search**: Algolia DocSearch, configured in `docusaurus.config.js`.
- **Plugins**: `docusaurus-plugin-sass` (SCSS support), `docusaurus2-dotenv` (env var injection with `systemvars: true`), and a custom inline plugin that disables the `fullySpecified` ESM resolution error and turns off Terser minification.
- **Webpack quirk**: The custom plugin disables `fullySpecified` module resolution for `.mjs` files to avoid errors from packages that ship partially-spec-compliant ESM.
- **Color mode**: Respects the OS `prefers-color-scheme` setting.

## Existing Documentation To Consult

The following docs in the repo are directly relevant to this area:
- `dev-docs/README.md` — how to install, develop, build, and deploy the docs site.
- `dev-docs/docs/@excalidraw/excalidraw/api/utils/utils-intro.md` — full listing of exported utility functions.
- `dev-docs/src/pages/markdown-page.md` — minimal example of a plain Markdown page in Docusaurus.
- `CONTRIBUTING.md` — contributing workflow (referenced from the Introduction section of the docs).