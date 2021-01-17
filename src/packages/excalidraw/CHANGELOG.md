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

## 0.2.0

## Excalidraw API

### Features

- Exported few [Extra API's](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#extra-apis) which can be used by the host to communicate with Excalidraw.

- Remove language picker, and add `langCode`, `renderFooter` [#2644](https://github.com/excalidraw/excalidraw/pull/2644):
  - BREAKING: removed the language picker from UI. It is now the host app's responsibility to implement a language picker if desirable, using the newly added [`renderFooter`](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#renderFooter) prop. The reasoning is that the i18n should be controlled by the app itself, not by the nested Excalidraw component.
  - Added [`langCode`](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#langCode) prop to control the UI language.
- Add support for `exportToBackend` prop to allow host apps to implement shareable links [#2612](https://github.com/excalidraw/excalidraw/pull/2612/files)

### Fixes

- Fix typo for initialData and point all links to master [#2707](https://github.com/excalidraw/excalidraw/pull/2707)

## Excalidraw Library

### Features

- Add toast [#2772](https://github.com/excalidraw/excalidraw/pull/2772)
- Add `cmd+o` shortcut to load scene [#2732](https://github.com/excalidraw/excalidraw/pull/2732)
- Require use of a preset dialog size; adjust dialog sizing [#2684](https://github.com/excalidraw/excalidraw/pull/2684)
- Add line chart and paste dialog selection [#2670](https://github.com/excalidraw/excalidraw/pull/2670)
- Tweak editing behavior [#2668](https://github.com/excalidraw/excalidraw/pull/2668)
- Change title to Excalidraw after a timeout
- Checkmark to toggle context-menu-items [#2645](https://github.com/excalidraw/excalidraw/pull/2645)
- Add zoom to selection [#2522](https://github.com/excalidraw/excalidraw/pull/2522)
- Insert Library items in the middle of the screen [#2527](https://github.com/excalidraw/excalidraw/pull/2527)
- Show shortcut context menu [#2501](https://github.com/excalidraw/excalidraw/pull/2501)
- Aligns arrowhead schemas [#2517](https://github.com/excalidraw/excalidraw/pull/2517)
- Add Cut to menus [#2511](https://github.com/excalidraw/excalidraw/pull/2511)
- More Arrowheads: dot, bar [#2486](https://github.com/excalidraw/excalidraw/pull/2486)
- Support CSV graphs and improve the look and feel [#2495](https://github.com/excalidraw/excalidraw/pull/2495)

### Fixes

- Fix compile error [#2685](https://github.com/excalidraw/excalidraw/pull/2685)
- Center zoom on iPhone and iPad [#2642](https://github.com/excalidraw/excalidraw/pull/2642)
- Allow text-selecting in dialogs & reset cursor [#2783](https://github.com/excalidraw/excalidraw/pull/2783)
- Don't render due to zoom after unmount [#2779](https://github.com/excalidraw/excalidraw/pull/2779)
- Track the chart type correctly [#2773](https://github.com/excalidraw/excalidraw/pull/2773)
- Fix late-render due to debounced zoom [#2779](https://github.com/excalidraw/excalidraw/pull/2779)
- Fix initialization when browser tab not focused [#2677](https://github.com/excalidraw/excalidraw/pull/2677)
- Consistent case for export locale strings [#2622](https://github.com/excalidraw/excalidraw/pull/2622)
- Remove unnecessary console.error as it was polluting Sentry [#2637](https://github.com/excalidraw/excalidraw/pull/2637)
- Fix scroll-to-center on init for non-zero canvas offsets [#2445](https://github.com/excalidraw/excalidraw/pull/2445)
- Hide collab button when onCollabButtonClick not supplied [#2598](https://github.com/excalidraw/excalidraw/pull/2598)
- Fix resizing the pasted charts [#2586](https://github.com/excalidraw/excalidraw/pull/2586)
- Fix element visibility and zoom on cursor when canvas offset isn't 0. [#2534](https://github.com/excalidraw/excalidraw/pull/2534)
- Fix Library Menu Layout [#2502](https://github.com/excalidraw/excalidraw/pull/2502)
- Support number with commas in charts [#2636](https://github.com/excalidraw/excalidraw/pull/2636)
- Don't break zoom when zooming in on UI [#2638](https://github.com/excalidraw/excalidraw/pull/2638)

### Improvements

- Added Zen Mode to the context menu [#2734](https://github.com/excalidraw/excalidraw/pull/2734)
- Do not reset to selection for draw tool [#2721]((https://github.com/excalidraw/excalidraw/pull/2721)
- Make dialogs look more like dialogs [#2686](https://github.com/excalidraw/excalidraw/pull/2686)
- Browse libraries styles fixed [#2694](https://github.com/excalidraw/excalidraw/pull/2694)
- Change hint for 2-point lines on resize [#2655](https://github.com/excalidraw/excalidraw/pull/2655)
- Align items in context menu [#2640](https://github.com/excalidraw/excalidraw/pull/2640)
- Do not reset to selection when using the draw tool [#2721](https://github.com/excalidraw/excalidraw/pull/2721)
- Display proper tooltip for 2-point lines during resize, and normalize modifier key labels in hints [#2655](https://github.com/excalidraw/excalidraw/pull/2655)
- Improve error message around importing images [#2619](https://github.com/excalidraw/excalidraw/pull/2619)
- Add tooltip with icon for embedding scenes [#2532](https://github.com/excalidraw/excalidraw/pull/2532)
- RTL support for the stats dialog [#2530](https://github.com/excalidraw/excalidraw/pull/2530)
- Expand canvas padding based on zoom. [#2515](https://github.com/excalidraw/excalidraw/pull/2515)
- Hide shortcuts on pickers for mobile [#2508](https://github.com/excalidraw/excalidraw/pull/2508)
- Hide stats and scrollToContent-button when mobile menus open [#2509](https://github.com/excalidraw/excalidraw/pull/2509)

### Refactor

- refactor: Converting span to kbd tag [#2774](https://github.com/excalidraw/excalidraw/pull/2774)
- Media queries [#2680](https://github.com/excalidraw/excalidraw/pull/2680)
- Remove duplicate entry from en.json[#2654](https://github.com/excalidraw/excalidraw/pull/2654)
- Remove the word toggle from labels [#2648](https://github.com/excalidraw/excalidraw/pull/2648)
-

### Chore

- Bump ini from 1.3.5 to 1.3.7 in /src/packages/excalidraw [#2500](https://github.com/excalidraw/excalidraw/pull/2500)

### Docs

- Document some of the more exotic element props [#2673](https://github.com/excalidraw/excalidraw/pull/2673)

## 0.1.1

#### Fix

- Update the homepage URL so it redirects to correct readme [#2498](https://github.com/excalidraw/excalidraw/pull/2498)

## 0.1.0

First release of `@excalidraw/excalidraw`
