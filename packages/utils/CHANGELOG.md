# Changelog

## [Unreleased]

### Breaking

- `exportToCanvas`, `exportToBlob` and `exportToSvg` are replaced by `exportScene({ type: "canvas" | "png" | "jpeg" | "svg", data, config })`, with the rendering options moved from `appState` into `config`. See the "Export API: `exportScene`" entry in the [`@excalidraw/excalidraw` changelog](../excalidraw/CHANGELOG.md) for the migration.

First release of `@excalidraw/utils` to provide utilities functions.

- Added `exportToBlob` and `exportToSvg` to export an Excalidraw diagram definition, respectively, to a [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) and to a [SVGElement](https://developer.mozilla.org/en-US/docs/Web/API/SVGElement) ([#2246](https://github.com/excalidraw/excalidraw/pull/2246))

### Features

- Flip single elements horizontally or vertically [#2520](https://github.com/excalidraw/excalidraw/pull/2520)
