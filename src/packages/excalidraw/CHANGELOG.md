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

## Unreleased

## Excalidraw API

### Features

- Append `location.pathname` to `libraryReturnUrl` default url [#3325](https://github.com/excalidraw/excalidraw/pull/3325).

## 0.5.0 (2021-03-21)

## Excalidraw API

### Features

- Set the target to `window.name` if present during excalidraw libraries installation so it opens in same tab for the host. If `window.name` is not set it will open in a new tab [#3299](https://github.com/excalidraw/excalidraw/pull/3299).
- Add `name` prop to indicate the name of the drawing which will be used when exporting the drawing. When supplied, the value takes precedence over `intialData.appState.name`, the `name` will be fully controlled by host app and the users won't be able to edit from within Excalidraw [#3273](https://github.com/excalidraw/excalidraw/pull/3273).
- Export API `setCanvasOffsets` via `ref` to set the offsets for Excalidraw[#3265](https://github.com/excalidraw/excalidraw/pull/3265).
  #### BREAKING CHANGE
  - `offsetLeft` and `offsetTop` props have been removed now so you have to use the `setCanvasOffsets` via `ref` to achieve the same.
- Export API to export the drawing to canvas, svg and blob [#3258](https://github.com/excalidraw/excalidraw/pull/3258). For more info you can check the [readme](https://github.com/excalidraw/excalidraw/tree/master/src/packages/excalidraw/README.md#user-content-export-utils)
- Add a `theme` prop to indicate Excalidraw's theme. [#3228](https://github.com/excalidraw/excalidraw/pull/3228). When this prop is passed, the theme is fully controlled by host app.
- Support `libraryReturnUrl` prop to indicate what URL to install libraries to [#3227](https://github.com/excalidraw/excalidraw/pull/3227).

### Refactor

- #### BREAKING CHANGE
  - Rename prop `initialData.scrollToCenter` and `setScrollToCenter` API exposed via ref to `initialData.scrollToContent` and `setScrollToContent` respectively[#3261](https://github.com/excalidraw/excalidraw/pull/3261).
- Rename appearance to theme [#3237](https://github.com/excalidraw/excalidraw/pull/3237).
  #### BREAKING CHANGE
  - Since `appState.appearance` is renamed to `appState.theme` so wherever `appState.appearance` including `initialData.appState.appearance` should be renamed to `appState.theme` and `initialData.appState.theme` respectively. If the `appearance` was persisted earlier, now it needs to passed as `theme`.
  - The class `Appearance_dark` is renamed to `theme--dark`.
  - The class `Appearance_dark-background-none` is renamed to `theme--dark-background-none`.

## Excalidraw Library

### Features

- Support pasting file contents & always prefer system clip [#3257](https://github.com/excalidraw/excalidraw/pull/3257)
- Add label for name field and use input when editable in export dialog [#3286](https://github.com/excalidraw/excalidraw/pull/3286)
- Implement the Web Share Target API [#3230](https://github.com/excalidraw/excalidraw/pull/3230).

### Fixes

- Don't show export and delete when library is empty [#3288](https://github.com/excalidraw/excalidraw/pull/3288)
- Overflow in textinput in export dialog [#3284](https://github.com/excalidraw/excalidraw/pull/3284).
- Bail on noop updates for newElementWith [#3279](https://github.com/excalidraw/excalidraw/pull/3279).
- Prevent State continuously updated when holding ctrl/cmd #3283
- Debounce flush not invoked if lastArgs not defined [#3281](https://github.com/excalidraw/excalidraw/pull/3281).
- Stop preventing canvas pointerdown/tapend events [#3207](https://github.com/excalidraw/excalidraw/pull/3207).
- Double scrollbar on modals [#3226](https://github.com/excalidraw/excalidraw/pull/3226).

---

## 0.4.3 (2021-03-12)

## Excalidraw API

### Fixes

- Allow copy of excalidraw elements only when inside excalidraw [#3206](https://github.com/excalidraw/excalidraw/pull/3206).
- Position text editor absolute and fix the offsets so it doesn't remain fixed when the container is scrolled [#3200](https://github.com/excalidraw/excalidraw/pull/3200).
- Scope CSS variables so that host CSS vars don't clash with excalidraw [#3199](https://github.com/excalidraw/excalidraw/pull/3199).

## Excalidraw Library

- Apply correct translation when text editor overflows when zoom not 100% [#3225](https://github.com/excalidraw/excalidraw/pull/3225)
- Don't overflow text beyond width of Excalidraw [#3215](https://github.com/excalidraw/excalidraw/pull/3215).

---

## 0.4.2

## Excalidraw API

### Fixes

- Wrap excalidraw in position relative so host need not do it anymore & hide scrollbars in zen mode [#3174](https://github.com/excalidraw/excalidraw/pull/3174).
- Reduce the scroll debounce timeout to `100ms` so `offsets` gets updated faster if changed when container scrolled [#3182](https://github.com/excalidraw/excalidraw/pull/3182).
- Rerender UI on `renderFooter` prop change [#3183](https://github.com/excalidraw/excalidraw/pull/3183)

## Excalidraw Library

### Fixes

- Temporarily downgrade browser-fs-access to fix legacy FS API [#3172](https://github.com/excalidraw/excalidraw/pull/3172)

---

## 0.4.1

## Excalidraw API

### Fixes

- Use `Array.from` when spreading over set so that typescript transpiles correctly in the umd build[#3165](https://github.com/excalidraw/excalidraw/pull/3165).

## Excalidraw Library

### Features

- Add export info on copy PNG to clipboard toast message [#3159](https://github.com/excalidraw/excalidraw/pull/3159).
- Use the latest version of Virgil [#3124](https://github.com/excalidraw/excalidraw/pull/3124).
- Support exporting with dark mode [#3046](https://github.com/excalidraw/excalidraw/pull/3046).

### Fixes

- Cursor being leaked outside of canvas [#3161](https://github.com/excalidraw/excalidraw/pull/3161).
- Hide scrollbars in zenMode [#3144](https://github.com/excalidraw/excalidraw/pull/3144).

## 0.4.0

## Excalidraw API

### Features

- Expose `window.EXCALIDRAW_ASSET_PATH` which host can use to load assets from a different URL. By default it will be loaded from `https://unpkg.com/@excalidraw/excalidraw{currentVersion}/dist/`[#3068](https://github.com/excalidraw/excalidraw/pull/3068).

  Also now the assets will have a hash in filename so cache bursting can easily happen with version bump.

- Add support for `scrollToCenter` in [initialData](https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L18) so host can control whether to scroll to center on mount [#3070](https://github.com/excalidraw/excalidraw/pull/3070).

- Export [`restore`](https://github.com/excalidraw/excalidraw/blob/master/src/data/restore.ts#L182), [`restoreAppState`](https://github.com/excalidraw/excalidraw/blob/master/src/data/restore.ts#L144) and [`restoreElements`](https://github.com/excalidraw/excalidraw/blob/master/src/data/restore.ts#L128) to host [#3049](https://github.com/excalidraw/excalidraw/pull/3049)

### Fixes

- Show user state only when [userState](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L35) is passed on remote pointers during collaboration [#3050](https://github.com/excalidraw/excalidraw/pull/3050)

## Excalidraw Library

### Features

- Adjust line-confirm-threshold based on zoom [#2884](https://github.com/excalidraw/excalidraw/pull/2884)

### Fixes

- Hide scrollbars on mobile [#3044](https://github.com/excalidraw/excalidraw/pull/3044)

## 0.3.1

## Excalidraw API

### Fixes

- Support Excalidraw inside scrollable container [#3018](https://github.com/excalidraw/excalidraw/pull/3018)

## Excalidraw Library

### Fixes

- Allow to toggle between modes when view only mode to make UI consistent [#3009](https://github.com/excalidraw/excalidraw/pull/3009)

## 0.3.0

## Excalidraw API

### Features

- Allow host to pass [color](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L36) for [collaborator](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L27) [#2943](https://github.com/excalidraw/excalidraw/pull/2943). The unused prop `user` is now removed.
- Add `zenModeEnabled` and `gridModeEnabled` prop which enables zen mode and grid mode respectively [#2901](https://github.com/excalidraw/excalidraw/pull/2901). When this prop is used, the zen mode / grid mode will be fully controlled by the host app.
- Allow host to pass [userState](https://github.com/excalidraw/excalidraw/blob/6967d8c9851c65bb8873e2f97387749976bbe326/src/types.ts#L35) for [collaborator](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L27) to show the current user state [#2877](https://github.com/excalidraw/excalidraw/pull/2877).
- Add `viewModeEnabled` prop which enabled the view mode [#2840](https://github.com/excalidraw/excalidraw/pull/2840). When this prop is used, the view mode will not show up in context menu is so it is fully controlled by host.
- Expose `getAppState` on `excalidrawRef` [#2834](https://github.com/excalidraw/excalidraw/pull/2834).

### Build

- Remove publicPath so host can use `__webpack_public_path__` to host the assets[#2835](https://github.com/excalidraw/excalidraw/pull/2835)

## Excalidraw Library

### Features

- Add the ability to clear library [#2997](https://github.com/excalidraw/excalidraw/pull/2997)
- Updates to Collaboration and RTL UX [#2994](https://github.com/excalidraw/excalidraw/pull/2994)
- Show toast when saving to existing file [#2988](https://github.com/excalidraw/excalidraw/pull/2988)
- Support supplying custom scale when exporting canvas [#2904](https://github.com/excalidraw/excalidraw/pull/2904)
- Show version in the stats dialog [#2908](https://github.com/excalidraw/excalidraw/pull/2908)
- Add idle detection to collaboration feature [#2877](https://github.com/excalidraw/excalidraw/pull/2877)
- Add view mode in Excalidraw [#2840](https://github.com/excalidraw/excalidraw/pull/2840)
- Increase max zoom [#2881](https://github.com/excalidraw/excalidraw/pull/2881)
- Remove copy & paste from context menu on desktop [#2872](https://github.com/excalidraw/excalidraw/pull/2872)
- Add separators on context menu [#2659](https://github.com/excalidraw/excalidraw/pull/2659)
- Add ctrl-y to redo [#2831](https://github.com/excalidraw/excalidraw/pull/2831)
- Add view mode [#2840](https://github.com/excalidraw/excalidraw/pull/2840).
- Remove `copy`, `cut`, and `paste` actions from contextmenu [#2872](https://github.com/excalidraw/excalidraw/pull/2872)
- Support `Ctrl-Y` shortcut to redo on Windows [#2831](https://github.com/excalidraw/excalidraw/pull/2831).

### Fixes

- Refresh wysiwyg position on canvas resize [#3008](https://github.com/excalidraw/excalidraw/pull/3008)
- Update the `lang` attribute with the current lang. [#2995](https://github.com/excalidraw/excalidraw/pull/2995)
- Rename 'Grid mode' to 'Show grid' [#2944](https://github.com/excalidraw/excalidraw/pull/2944)
- Deal with users on systems that don't handle emoji [#2941](https://github.com/excalidraw/excalidraw/pull/2941)
- Mobile toolbar tooltip regression [#2939](https://github.com/excalidraw/excalidraw/pull/2939)
- Hide collaborator list on mobile if empty [#2938](https://github.com/excalidraw/excalidraw/pull/2938)
- Toolbar unnecessarily eats too much width [#2924](https://github.com/excalidraw/excalidraw/pull/2924)
- Mistakenly hardcoding scale [#2925](https://github.com/excalidraw/excalidraw/pull/2925)
- Text editor not visible in dark mode [#2920](https://github.com/excalidraw/excalidraw/pull/2920)
- Incorrect z-index of text editor [#2914](https://github.com/excalidraw/excalidraw/pull/2914)
- Make scrollbars draggable when offsets are set [#2916](https://github.com/excalidraw/excalidraw/pull/2916)
- Pointer-events being disabled on free-draw [#2912](https://github.com/excalidraw/excalidraw/pull/2912)
- Track zenmode and grid mode usage [#2900](https://github.com/excalidraw/excalidraw/pull/2900)
- Disable UI pointer-events on canvas drag [#2856](https://github.com/excalidraw/excalidraw/pull/2856)
- Stop flooring scroll positions [#2883](https://github.com/excalidraw/excalidraw/pull/2883)
- Apply initialData appState for zenmode and grid stats and refactor check param for actions [#2871](https://github.com/excalidraw/excalidraw/pull/2871)
- Show correct state of Nerd stats in context menu when nerd stats dialog closed [#2874](https://github.com/excalidraw/excalidraw/pull/2874)
- Remote pointers not accounting for offset [#2855](https://github.com/excalidraw/excalidraw/pull/2855)
- Toggle help dialog when "shift+?" is pressed [#2828](https://github.com/excalidraw/excalidraw/pull/2828)
- Add safe check for process so Excalidraw can be loaded via script [#2824](https://github.com/excalidraw/excalidraw/pull/2824)
- Fix UI pointer-events not disabled when dragging on canvas [#2856](https://github.com/excalidraw/excalidraw/pull/2856).
- Fix remote pointers not accounting for offset [#2855](https://github.com/excalidraw/excalidraw/pull/2855).

### Refactor

- Remove duplicate key handling [#2878](https://github.com/excalidraw/excalidraw/pull/2878)
- Reuse scss variables in js for SSOT [#2867](https://github.com/excalidraw/excalidraw/pull/2867)
- Rename browser-nativefs to browser-fs-access [#2862](https://github.com/excalidraw/excalidraw/pull/2862)
- Rewrite collabWrapper to remove TDZs and simplify [#2834](https://github.com/excalidraw/excalidraw/pull/2834)

### Chore

- Use `Sentence case` for `Live collaboration`

## 0.2.1

## Excalidraw API

### Build

- Bundle css files with js [#2819](https://github.com/excalidraw/excalidraw/pull/2819). The host would not need to import css files separately.

## 0.2.0

## Excalidraw API

### Features

- Exported few [Extra API's](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#extra-apis) which can be used by the host to communicate with Excalidraw.

- Remove language picker, and add `langCode`, `renderFooter` [#2644](https://github.com/excalidraw/excalidraw/pull/2644):
  - BREAKING: removed the language picker from UI. It is now the host app's responsibility to implement a language picker if desirable, using the newly added [`renderFooter`](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#renderFooter) prop. The reasoning is that the i18n should be controlled by the app itself, not by the nested Excalidraw component.
  - Added [`langCode`](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#langCode) prop to control the UI language.
- Add support for `exportToBackend` prop to allow host apps to implement shareable links [#2612](https://github.com/excalidraw/excalidraw/pull/2612/files)

### Fixes

- Hide collaboration button when the prop `onCollabButtonClick` is not provided [#2598](https://github.com/excalidraw/excalidraw/pull/2598)

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

### Docs

- Document some of the more exotic element props [#2673](https://github.com/excalidraw/excalidraw/pull/2673)

## 0.1.1

#### Fix

- Update the homepage URL so it redirects to correct readme [#2498](https://github.com/excalidraw/excalidraw/pull/2498)

## 0.1.0

First release of `@excalidraw/excalidraw`
