## Examples

Two standalone integration examples live under `examples/`, each a self-contained project that consumes `@excalidraw/excalidraw` from the monorepo's build output. They exist to demonstrate real-world embedding patterns and serve as a live reference for the public API surface.

### with-script-in-browser

A Vite-based React app (port 3001) showing the browser-script loading pattern. The library is imported as an ES module and then assigned to `window.ExcalidrawLib` before the React entrypoint runs; the React app reads it back from `window.ExcalidrawLib` to avoid bundler-level coupling. `EXCALIDRAW_ASSET_PATH` is hardcoded in `examples/with-script-in-browser/index.html` to the esm.sh CDN URL so fonts load correctly.

`examples/with-script-in-browser/components/ExampleApp.tsx` is the **canonical showcase component**. It receives the entire library as a prop (`excalidrawLib: typeof TExcalidraw`) so it works whether the library came from a bundle, a CDN, or a local build. The component exercises the full public API:

- `ExcalidrawImperativeAPI` obtained via the `excalidrawAPI` ref callback, used to call `updateScene`, `resetScene`, `addFiles`, `updateLibrary`, `scrollToContent`, `getSceneElements`, `getAppState`, `getFiles`
- Export functions: `exportToSvg`, `exportToBlob`, `exportToCanvas`, `exportToClipboard`
- Coordinate helpers: `sceneCoordsToViewportCoords`, `viewportCoordsToSceneCoords`
- Slot components: `Footer`, `WelcomeScreen`, `MainMenu`, `Sidebar` (with `Sidebar.Tabs`, `Sidebar.Tab`, `Sidebar.TabTriggers`, `Sidebar.Trigger`)
- `LiveCollaborationTrigger` with a mock collaborators map wired through `updateScene`
- `TTDDialog` / `TTDDialogTrigger` for text-to-diagram
- A custom "comment" overlay built entirely outside Excalidraw using a custom tool type (`setActiveTool({ type: "custom", customType: "comment" })`) and pointer event listeners — this is the primary example of layering custom HTML over the canvas
- Initial data loaded asynchronously via a `resolvablePromise` pattern (deferred Promise with `.resolve` attached) so the API call and the data fetch race safely

`examples/with-script-in-browser/initialData.tsx` provides the seed scene using `ExcalidrawElementSkeleton` (the loose input format accepted by `convertToExcalidrawElements`), including a frame, labeled shapes, arrows with bound endpoints, and an image element referencing a file by `fileId`.

`examples/with-script-in-browser/utils.ts` provides thin helpers copied from the library's own internals: `resolvablePromise`, `distance2d`, a `fileOpen` wrapper over `browser-fs-access`, `withBatchedUpdates`, and `withBatchedUpdatesThrottled`. These exist because examples cannot import from private package paths.

Vite config targets `es2022` to support arbitrary module namespace identifiers (required by the library build; see comment in `examples/with-script-in-browser/vite.config.mts`).

The project has a CodeSandbox config at `examples/with-script-in-browser/.codesandbox/tasks.json` that auto-runs `yarn start` on preview.

### with-nextjs

A Next.js 14 app showing embedding in both the App Router and Pages Router. Dev server runs on port 3005; production start on port 3006. It **reuses ExampleApp directly** by importing it from the sibling example via a relative path: `../../with-script-in-browser/components/ExampleApp` — so any change to ExampleApp affects both examples.

**SSR must be disabled.** Both `examples/with-nextjs/src/app/page.tsx` (App Router) and `examples/with-nextjs/src/pages/excalidraw-in-pages.tsx` (Pages Router) use `next/dynamic` with `{ ssr: false }` for the same reason: Excalidraw references browser APIs and cannot run on the server.

`EXCALIDRAW_ASSET_PATH` is injected via a `<Script strategy="beforeInteractive">` tag set to `window.origin` so the app serves fonts from its own public directory.

The build script copies font files from the monorepo's build output before Next.js builds:
```
copy:assets: cp -r ../../packages/excalidraw/dist/prod/fonts ./public
```

`examples/with-nextjs/next.config.js` sets `ignoreBuildErrors: true` to work around a TypeScript conflict between `jsx: preserve` (required by Next.js) and the monorepo's tsconfig. `transpilePackages: ["../"]` is set so that importing types from outside the Next.js root does not throw.

Both examples deploy to Vercel; each has a `vercel.json` pointing to its respective build output directory.

### Build Dependency

Both examples depend on the monorepo packages being built first (`build:packages` at the repo root). The Next.js example chains it automatically — its `dev`/`build` run `build:workspace` → `build:packages` first. The browser example does not: its `build` is just `vite build`, and it exposes a standalone `build:packages` script you run yourself. Working on an example without first building packages will result in missing or stale imports.

### Relevant Documentation

- `examples/with-nextjs/README.md` — standard Next.js getting-started guide (dev server, deploy)
- `packages/excalidraw/README.md` — library API reference, the public surface these examples exercise