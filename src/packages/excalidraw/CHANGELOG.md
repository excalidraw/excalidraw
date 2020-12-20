# Changelog

<!--
Guidelines for changelog:
The change should be grouped under one of the below section and must contain PR link.
- Features: For new features.
- Fixes: For bug fixes.
- Chore: Changes for non src files example package.json.
- Improvements: For any improvements.
- Refactor: For any refactoring.

Please add the latest change on the top under the correct section.
-->

## [Unreleased]

### Features

- Add support for `exportToBackend` prop to allow host apps to implement shareable links [#2612](https://github.com/excalidraw/excalidraw/pull/2612/files)
- Add zoom to selection [#2522](https://github.com/excalidraw/excalidraw/pull/2522)
- Insert Library items in the middle of the screen [#2527](https://github.com/excalidraw/excalidraw/pull/2527)
- Show shortcut context menu [#2501](https://github.com/excalidraw/excalidraw/pull/2501)
- Aligns arrowhead schemas [#2517](https://github.com/excalidraw/excalidraw/pull/2517)
- Add Cut to menus [#2511](https://github.com/excalidraw/excalidraw/pull/2511)
- More Arrowheads: dot, bar [#2486](https://github.com/excalidraw/excalidraw/pull/2486)
- Support CSV graphs and improve the look and feel [#2495](https://github.com/excalidraw/excalidraw/pull/2495)

### Fixes
- Consistent case for export locale strings [#2622](https://github.com/excalidraw/excalidraw/pull/2622)
- Remove unnecessary console.error as it was polluting Sentry [#2637](https://github.com/excalidraw/excalidraw/pull/2637)
- Fix scroll-to-center on init for non-zero canvas offsets [#2445](https://github.com/excalidraw/excalidraw/pull/2445)
- Hide collab button when onCollabButtonClick not supplied [#2598](https://github.com/excalidraw/excalidraw/pull/2598)
- Fix resizing the pasted charts [#2586](https://github.com/excalidraw/excalidraw/pull/2586)
- Fix element visibility and zoom on cursor when canvas offset isn't 0. [#2534](https://github.com/excalidraw/excalidraw/pull/2534)
- Fix Library Menu Layout [#2502](https://github.com/excalidraw/excalidraw/pull/2502)
- Support number with commas in charts [#2636](https://github.com/excalidraw/excalidraw/pull/2636)

### Improvements

- Add tooltip with icon for embedding scenes [#2532](https://github.com/excalidraw/excalidraw/pull/2532)
- RTL support for the stats dialog [#2530](https://github.com/excalidraw/excalidraw/pull/2530)
- Expand canvas padding based on zoom. [#2515](https://github.com/excalidraw/excalidraw/pull/2515)
- Hide shortcuts on pickers for mobile [#2508](https://github.com/excalidraw/excalidraw/pull/2508)
- Hide stats and scrollToContent-button when mobile menus open [#2509](https://github.com/excalidraw/excalidraw/pull/2509)

### Chore

- Bump ini from 1.3.5 to 1.3.7 in /src/packages/excalidraw [#2500](https://github.com/excalidraw/excalidraw/pull/2500)

## 0.1.1

#### Fix

- Update the homepage URL so it redirects to correct readme [#2498](https://github.com/excalidraw/excalidraw/pull/2498)

## 0.1.0

First release of `@excalidraw/excalidraw`
