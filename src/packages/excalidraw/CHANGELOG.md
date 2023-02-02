# Changelog

<!--
Guidelines for changelog:
The change should be grouped under one of the below section and must contain PR link.
- Features: For new features.
- Fixes: For bug fixes.
- Chore: Changes for non src files example package.json.
- Refactor: For any refactoring.

Please add the latest change on the top under the correct section.
-->

## 0.14.2 (2023-02-01)

### Features

- Welcome screen no longer renders by default, and you need to render it yourself. `UIOptions.welcomeScreen` option is now deprecated. [#6117](https://github.com/excalidraw/excalidraw/pull/6117)
- `MainMenu`, `MainMenu.Item`, and `MainMenu.ItemLink` components now all support `onSelect(event: Event): void` callback. If you call `event.preventDefault()`, it will prevent the menu from closing when an item is selected (clicked on). [#6152](https://github.com/excalidraw/excalidraw/pull/6152)

### Fixes

- declare css variable for font in excalidraw so its available in host [#6160](https://github.com/excalidraw/excalidraw/pull/6160)

## Excalidraw Library

**_This section lists the updates made to the excalidraw library and will not affect the integration._**

### Features

- Add hand/panning tool [#6141](https://github.com/excalidraw/excalidraw/pull/6141)

- Show copy-as-png export button on firefox and show steps how to enable it [#6125](https://github.com/excalidraw/excalidraw/pull/6125)

### Fixes

- Horizontal padding when aligning bound text containers [#6180](https://github.com/excalidraw/excalidraw/pull/6180)

- Make tunnels work in multi-instance scenarios [#6178](https://github.com/excalidraw/excalidraw/pull/6178)

- Add 1px width to the container to calculate more accurately [#6174](https://github.com/excalidraw/excalidraw/pull/6174)

- Quick typo fix [#6167](https://github.com/excalidraw/excalidraw/pull/6167)

- Set the width correctly using measureText in editor [#6162](https://github.com/excalidraw/excalidraw/pull/6162)

- :bug: broken emojis when wrap text [#6153](https://github.com/excalidraw/excalidraw/pull/6153)

- Button background and svg sizes [#6155](https://github.com/excalidraw/excalidraw/pull/6155)

### Styles

- Change in ExportButton style [#6147](https://github.com/excalidraw/excalidraw/pull/6147) (#6148)

### Build

- Temporarily disable pre-commit [#6132](https://github.com/excalidraw/excalidraw/pull/6132)

---

## 0.14.1 (2023-01-16)

### Fixes

- remove overflow hidden from button [#6110](https://github.com/excalidraw/excalidraw/pull/6110). This fixes the collaborator count css in the [LiveCollaborationTrigger](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#LiveCollaborationTrigger) component.

## 0.14.0 (2023-01-13)

### Features

- Support customization for the editor [welcome screen](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#WelcomeScreen) [#6048](https://github.com/excalidraw/excalidraw/pull/6048).

- Expose component API for the Excalidraw main menu [#6034](https://github.com/excalidraw/excalidraw/pull/6034), You can read more about its usage [here](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#MainMenu)

- Support customization for the Excalidraw [main menu](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#MainMenu) [#6034](https://github.com/excalidraw/excalidraw/pull/6034).

- [Footer](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#Footer) is now rendered as child component instead of passed as a render prop [#5970](https://github.com/excalidraw/excalidraw/pull/5970).

- Any top-level children passed to the `<Excalidraw/>` component that do not belong to one of the officially supported Excalidraw children components are now rendered directly inside the Excalidraw container (previously, they weren't rendered at all) [#6096](https://github.com/excalidraw/excalidraw/pull/6096).

- Expose [LiveCollaborationTrigger](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#LiveCollaborationTrigger) component. Replaces `props.onCollabButtonClick` [#6104](https://github.com/excalidraw/excalidraw/pull/6104).

#### BREAKING CHANGES

- `props.onCollabButtonClick` is now removed. You need to render the main menu item yourself, and optionally also render the `<LiveCollaborationTrigger>` component using [renderTopRightUI](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#renderTopRightUI) prop if you want to retain the canvas button at top-right.
- The prop `renderFooter` is now removed in favor of rendering as a child component.

### Excalidraw schema

- Merged `appState.currentItemStrokeSharpness` and `appState.currentItemLinearStrokeSharpness` into `appState.currentItemRoundness`. Renamed `changeSharpness` action to `changeRoundness`. Excalidraw element's `strokeSharpness` was changed to `roundness`. Check the PR for types and more details [#5553](https://github.com/excalidraw/excalidraw/pull/5553).

## Excalidraw Library

**_This section lists the updates made to the excalidraw library and will not affect the integration._**

### Features

- Generic button export [#6092](https://github.com/excalidraw/excalidraw/pull/6092)

- Scroll using PageUp and PageDown [#6038](https://github.com/excalidraw/excalidraw/pull/6038)

- Support shrinking text containers to original height when text removed [#6025](https://github.com/excalidraw/excalidraw/pull/6025)

- Move contextMenu into the component tree and control via appState [#6021](https://github.com/excalidraw/excalidraw/pull/6021)

- Allow readonly actions to be used in viewMode [#5982](https://github.com/excalidraw/excalidraw/pull/5982)

- Support labels for arrow 🔥 [#5723](https://github.com/excalidraw/excalidraw/pull/5723)

- Don't add midpoint until dragged beyond a threshold [#5927](https://github.com/excalidraw/excalidraw/pull/5927)

- Changed text copy/paste behaviour [#5786](https://github.com/excalidraw/excalidraw/pull/5786)

- Reintroduce `x` shortcut for `freedraw` [#5840](https://github.com/excalidraw/excalidraw/pull/5840)

- Tweak toolbar shortcuts & remove library shortcut [#5832](https://github.com/excalidraw/excalidraw/pull/5832)

- Clean unused images only after 24hrs (local-only) [#5839](https://github.com/excalidraw/excalidraw/pull/5839)

- Refetch errored/pending images on collab room init load [#5833](https://github.com/excalidraw/excalidraw/pull/5833)

- Stop deleting whole line when no point select in line editor [#5676](https://github.com/excalidraw/excalidraw/pull/5676)

- Editor redesign 🔥 [#5780](https://github.com/excalidraw/excalidraw/pull/5780)

### Fixes

- Mobile tools positioning [#6107](https://github.com/excalidraw/excalidraw/pull/6107)

- Renamed folder MainMenu->main-menu and support rest props [#6103](https://github.com/excalidraw/excalidraw/pull/6103)

- Use position absolute for mobile misc tools [#6099](https://github.com/excalidraw/excalidraw/pull/6099)

- React.memo resolvers not accounting for all props [#6042](https://github.com/excalidraw/excalidraw/pull/6042)

- Image horizontal flip fix + improved tests [#5799](https://github.com/excalidraw/excalidraw/pull/5799)

- Png-exporting does not preserve angles correctly for flipped images [#6085](https://github.com/excalidraw/excalidraw/pull/6085)

- Stale appState of MainMenu defaultItems rendered from Actions [#6074](https://github.com/excalidraw/excalidraw/pull/6074)

- HelpDialog [#6072](https://github.com/excalidraw/excalidraw/pull/6072)

- Show error message on collab save failure [#6063](https://github.com/excalidraw/excalidraw/pull/6063)

- Remove ga from docker build [#6059](https://github.com/excalidraw/excalidraw/pull/6059)

- Use displayName since name gets stripped off when uglifying/minifiyng in production [#6036](https://github.com/excalidraw/excalidraw/pull/6036)

- Remove background from wysiwyg when editing arrow label [#6033](https://github.com/excalidraw/excalidraw/pull/6033)

- Use canvas measureText to calculate width in measureText [#6030](https://github.com/excalidraw/excalidraw/pull/6030)

- Restoring deleted bindings [#6029](https://github.com/excalidraw/excalidraw/pull/6029)

- ColorPicker getColor [#5949](https://github.com/excalidraw/excalidraw/pull/5949)

- Don't push whitespace to next line when exceeding max width during wrapping and make sure to use same width of text editor on DOM when measuring dimensions [#5996](https://github.com/excalidraw/excalidraw/pull/5996)

- Showing `grabbing` cursor when holding `spacebar` [#6015](https://github.com/excalidraw/excalidraw/pull/6015)

- Resize sometimes throwing on missing null-checks [#6013](https://github.com/excalidraw/excalidraw/pull/6013)

- PWA not working after CRA@5 update [#6012](https://github.com/excalidraw/excalidraw/pull/6012)

- Not properly restoring element stroke and bg colors [#6002](https://github.com/excalidraw/excalidraw/pull/6002)

- Avatar outline on safari & center [#5997](https://github.com/excalidraw/excalidraw/pull/5997)

- Chart pasting not working due to removing tab characters [#5987](https://github.com/excalidraw/excalidraw/pull/5987)

- Apply the right type of roundness when pasting styles [#5979](https://github.com/excalidraw/excalidraw/pull/5979)

- Remove editor onpaste handler [#5971](https://github.com/excalidraw/excalidraw/pull/5971)

- Remove blank space [#5950](https://github.com/excalidraw/excalidraw/pull/5950)

- Galego and Kurdî missing in languages plus two locale typos [#5954](https://github.com/excalidraw/excalidraw/pull/5954)

- `ExcalidrawArrowElement` rather than `ExcalidrawArrowEleement` [#5955](https://github.com/excalidraw/excalidraw/pull/5955)

- RenderFooter styling [#5962](https://github.com/excalidraw/excalidraw/pull/5962)

- Repair element bindings on restore [#5956](https://github.com/excalidraw/excalidraw/pull/5956)

- Don't allow whitespaces for bound text [#5939](https://github.com/excalidraw/excalidraw/pull/5939)

- Bindings do not survive history serialization [#5942](https://github.com/excalidraw/excalidraw/pull/5942)

- Dedupe boundElement ids when container duplicated with alt+drag [#5938](https://github.com/excalidraw/excalidraw/pull/5938)

- Scale font correctly when using shift [#5935](https://github.com/excalidraw/excalidraw/pull/5935)

- Always bind to container selected by user [#5880](https://github.com/excalidraw/excalidraw/pull/5880)

- Fonts not rendered on init if `loadingdone` not fired [#5923](https://github.com/excalidraw/excalidraw/pull/5923)

- Stop replacing `del` word with `Delete` [#5897](https://github.com/excalidraw/excalidraw/pull/5897)

- Remove legacy React.render() from the editor [#5893](https://github.com/excalidraw/excalidraw/pull/5893)

- Allow adding text via enter only for text containers [#5891](https://github.com/excalidraw/excalidraw/pull/5891)

- Stop font `loadingdone` loop when rendering element SVGs [#5883](https://github.com/excalidraw/excalidraw/pull/5883)

- Refresh text dimensions only after font load done [#5878](https://github.com/excalidraw/excalidraw/pull/5878)

- Correctly paste contents parsed by `JSON.parse()` as text. [#5868](https://github.com/excalidraw/excalidraw/pull/5868)

- SVG element attributes in icons.tsx [#5871](https://github.com/excalidraw/excalidraw/pull/5871)

- Merge existing text with new when pasted [#5856](https://github.com/excalidraw/excalidraw/pull/5856)

- Disable FAST_REFRESH to fix live reload [#5852](https://github.com/excalidraw/excalidraw/pull/5852)

- Paste clipboard contents into unbound text elements [#5849](https://github.com/excalidraw/excalidraw/pull/5849)

- Compute dimensions of container correctly when text pasted on container [#5845](https://github.com/excalidraw/excalidraw/pull/5845)

- Line editor points rendering below elements [#5781](https://github.com/excalidraw/excalidraw/pull/5781)

- Syncing 1-point lines to remote clients [#5677](https://github.com/excalidraw/excalidraw/pull/5677)

- Incorrectly selecting linear elements on creation while tool-locked [#5785](https://github.com/excalidraw/excalidraw/pull/5785)

- Corrected typo in toggle theme shortcut [#5813](https://github.com/excalidraw/excalidraw/pull/5813)

- Hide canvas-modifying UI in view mode [#5815](https://github.com/excalidraw/excalidraw/pull/5815)

- Fix vertical/horizntal centering icons [#5812](https://github.com/excalidraw/excalidraw/pull/5812)

- Consistent use of ZOOM_STEP [#5801](https://github.com/excalidraw/excalidraw/pull/5801)

- Multiple elements resizing regressions [#5586](https://github.com/excalidraw/excalidraw/pull/5586)

- Changelog typo [#5795](https://github.com/excalidraw/excalidraw/pull/5795)

### Refactor

- Remove unnecessary code [#5933](https://github.com/excalidraw/excalidraw/pull/5933)

### Build

- Move release scripts to use release branch [#5958](https://github.com/excalidraw/excalidraw/pull/5958)

- Stops ignoring .env files from docker context so env variables get set during react app build. [#5809](https://github.com/excalidraw/excalidraw/pull/5809)

---

## 0.13.0 (2022-10-27)

### Excalidraw API

#### Features

- `restoreElements()` now takes an optional parameter to indicate whether we should also recalculate text element dimensions. Defaults to `true`, but since this is a potentially costly operation, you may want to disable it if you restore elements in tight loops, such as during collaboration [#5432](https://github.com/excalidraw/excalidraw/pull/5432).
- Support rendering custom sidebar using [`renderSidebar`](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#renderSidebar) prop ([#5663](https://github.com/excalidraw/excalidraw/pull/5663)).
- Add [`toggleMenu`](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#toggleMenu) prop to toggle specific menu open/close state ([#5663](https://github.com/excalidraw/excalidraw/pull/5663)).
- Support [theme](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#theme) to be semi-controlled [#5660](https://github.com/excalidraw/excalidraw/pull/5660).
- Added support for storing [`customData`](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#storing-custom-data-on-excalidraw-elements) on Excalidraw elements [#5592].
- Added `exportPadding?: number;` to [exportToCanvas](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#exporttocanvas) and [exportToBlob](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#exporttoblob). The default value of the padding is `10`.

#### Breaking Changes

- `props.UIOptions.canvasActions.theme` is now renamed to `props.UIOptions.canvasActions.toggleTheme` [#5660](https://github.com/excalidraw/excalidraw/pull/5660).
- `setToastMessage` API is now renamed to `setToast` API and the function signature is also updated [#5427](https://github.com/excalidraw/excalidraw/pull/5427). You can also pass `duration` and `closable` attributes along with `message`.

## Excalidraw Library

**_This section lists the updates made to the excalidraw library and will not affect the integration._**

### Features

- Render library into `Sidebar` on mobile [#5774](https://github.com/excalidraw/excalidraw/pull/5774)

- Additional drag and drop image format support (webp, bmp, ico) [#5749](https://github.com/excalidraw/excalidraw/pull/5749)

- Enter and Exit line editor via context menu [#5719](https://github.com/excalidraw/excalidraw/pull/5719)

- Further reduce darkmode init flash [#5701](https://github.com/excalidraw/excalidraw/pull/5701)

- Support segment midpoints in line editor [#5641](https://github.com/excalidraw/excalidraw/pull/5641)

- Added exportPadding to PNG (blob) export in @excalidraw/utils [#5626](https://github.com/excalidraw/excalidraw/pull/5626)

- Introduce ExcalidrawElements and ExcalidrawAppState provider [#5463](https://github.com/excalidraw/excalidraw/pull/5463)

- Enable midpoint inside linear element editor [#5564](https://github.com/excalidraw/excalidraw/pull/5564)

- Show a mid point for linear elements [#5534](https://github.com/excalidraw/excalidraw/pull/5534)

- Lock angle when editing linear elements with shift pressed [#5527](https://github.com/excalidraw/excalidraw/pull/5527)

- Redesign linear elements 🎉 [#5501](https://github.com/excalidraw/excalidraw/pull/5501)

- Cursor alignment when creating linear elements with shift pressed [#5518](https://github.com/excalidraw/excalidraw/pull/5518)

- Shift-clamp when creating multi-point lines/arrows [#5500](https://github.com/excalidraw/excalidraw/pull/5500)

- Cursor alignment when creating generic elements [#5516](https://github.com/excalidraw/excalidraw/pull/5516)

- Make context menu scrollable [#4030](https://github.com/excalidraw/excalidraw/pull/4030)

### Fixes

- Ungroup short cut key [#5779](https://github.com/excalidraw/excalidraw/pull/5779)

- Replaced KeyboardEvent.code with KeyboardEvent.key for all letters [#5523](https://github.com/excalidraw/excalidraw/pull/5523)

- Free draw flip not scaling correctly [#5752](https://github.com/excalidraw/excalidraw/pull/5752)

- Wait for window focus until prompting for library install [#5751](https://github.com/excalidraw/excalidraw/pull/5751)

- Update perfect freehand library to fix extra dot [#5727](https://github.com/excalidraw/excalidraw/pull/5727)

- RestoreElementWithProperties drops "parent" property [#5742](https://github.com/excalidraw/excalidraw/pull/5742)

- Horizontal text alignment for bound text when resizing [#5721](https://github.com/excalidraw/excalidraw/pull/5721)

- Set the dimensions of bound text correctly [#5710](https://github.com/excalidraw/excalidraw/pull/5710)

- Image-mirroring in export preview and in exported svg [#5700](https://github.com/excalidraw/excalidraw/pull/5700)

- Double state update incorrectly resetting state [#5704](https://github.com/excalidraw/excalidraw/pull/5704)

- Remove no longer used code related to collab room loading [#5699](https://github.com/excalidraw/excalidraw/pull/5699)

- Revert webpack deduping to fix `@next` runtime [#5695](https://github.com/excalidraw/excalidraw/pull/5695)

- Move to release notes for v0.9.0 and after [#5686](https://github.com/excalidraw/excalidraw/pull/5686)

- Zen-mode exit button not working [#5682](https://github.com/excalidraw/excalidraw/pull/5682)

- Buttons jump around on the mobile menu [#5658](https://github.com/excalidraw/excalidraw/pull/5658)

- #5622 - prevent session theme reset during collaboration [#5640](https://github.com/excalidraw/excalidraw/pull/5640)

- Library actions inside the sidebar [#5638](https://github.com/excalidraw/excalidraw/pull/5638)

- Don't render library menu twice for mobile [#5636](https://github.com/excalidraw/excalidraw/pull/5636)

- Reintroduce help dialog button [#5631](https://github.com/excalidraw/excalidraw/pull/5631)

- Add display name to components so it doesn't show as anonymous [#5616](https://github.com/excalidraw/excalidraw/pull/5616)

- Improve solveQuadratic when a = 0 [#5618](https://github.com/excalidraw/excalidraw/pull/5618)

- Add random tiny offsets to avoid linear elements from being clipped [#5615](https://github.com/excalidraw/excalidraw/pull/5615)

- Crash when adding a new point in the line editor #5602 [#5606](https://github.com/excalidraw/excalidraw/pull/5606)

- Allow box selection of points when inside editor [#5594](https://github.com/excalidraw/excalidraw/pull/5594)

- Remove unnecessary conditions in pointerup for linear elements [#5575](https://github.com/excalidraw/excalidraw/pull/5575)

- Check if hitting link in handleSelectionOnPointerDown [#5589](https://github.com/excalidraw/excalidraw/pull/5589)

- Points not being normalized on single-elem resize [#5581](https://github.com/excalidraw/excalidraw/pull/5581)

- Deselect linear element when clicked inside bounding box outside editor [#5579](https://github.com/excalidraw/excalidraw/pull/5579)

- Resize multiple elements from center [#5560](https://github.com/excalidraw/excalidraw/pull/5560)

- Call static methods via class instead of instance in linearElementEditor [#5561](https://github.com/excalidraw/excalidraw/pull/5561)

- Show bounding box for 3 or more linear point elements [#5554](https://github.com/excalidraw/excalidraw/pull/5554)

- Cleanup the condition for dragging elements [#5555](https://github.com/excalidraw/excalidraw/pull/5555)

- Shareable links being merged with current scene data [#5547](https://github.com/excalidraw/excalidraw/pull/5547)

- Scene lookup failing when looking up by id [#5542](https://github.com/excalidraw/excalidraw/pull/5542)

- Remove rounding to fix jitter when shift-editing [#5543](https://github.com/excalidraw/excalidraw/pull/5543)

- Line deselected when shift-dragging point outside editor [#5540](https://github.com/excalidraw/excalidraw/pull/5540)

- Flip linear elements after redesign [#5538](https://github.com/excalidraw/excalidraw/pull/5538)

- Disable locking aspect ratio for box-selection [#5525](https://github.com/excalidraw/excalidraw/pull/5525)

- Add `title` attribute to the modal close button [#5521](https://github.com/excalidraw/excalidraw/pull/5521)

- Context menu positioning when component has offsets [#5520](https://github.com/excalidraw/excalidraw/pull/5520)

- Resolve paths in prebuild.js script [#5498](https://github.com/excalidraw/excalidraw/pull/5498)

- Use flushSync when moving line editor since we need to read previous value after setting state [#5508](https://github.com/excalidraw/excalidraw/pull/5508)

- UseLayout effect cleanup in dev mode for charts [#5505](https://github.com/excalidraw/excalidraw/pull/5505)

- Revert browser toast for high/low zoom [#5495](https://github.com/excalidraw/excalidraw/pull/5495)

- Fixing push to DockerHub [#5468](https://github.com/excalidraw/excalidraw/pull/5468)

- Incorrectly rendering freedraw elements [#5481](https://github.com/excalidraw/excalidraw/pull/5481)

- Generate types when building example [#5480](https://github.com/excalidraw/excalidraw/pull/5480)

- Use React.FC as react-dom is not able to infer types of Modal [#5479](https://github.com/excalidraw/excalidraw/pull/5479)

- Missing translation for "Scale" to Export Dialog [#5456](https://github.com/excalidraw/excalidraw/pull/5456)

- Add display name for Excalidraw component so it doesn't show as anonymous [#5464](https://github.com/excalidraw/excalidraw/pull/5464)

- Account for safe area for floating buttons on mobile [#5420](https://github.com/excalidraw/excalidraw/pull/5420)

- Attribute warnings in comment svg example [#5465](https://github.com/excalidraw/excalidraw/pull/5465)

- Check for ctrl key when wheel event triggered to only disable zooming [#5459](https://github.com/excalidraw/excalidraw/pull/5459)

- Disable render throttling by default & during resize [#5451](https://github.com/excalidraw/excalidraw/pull/5451)

- Attach wheel event to exscalidraw container only [#5443](https://github.com/excalidraw/excalidraw/pull/5443)

- Show toast when browser zoom is not 100% [#5304](https://github.com/excalidraw/excalidraw/pull/5304)

- Prevent browser zoom inside Excalidraw [#5426](https://github.com/excalidraw/excalidraw/pull/5426)

- Typo in changelog [#5425](https://github.com/excalidraw/excalidraw/pull/5425)

### Refactor

- Create a util to compute container dimensions for bound text container [#5708](https://github.com/excalidraw/excalidraw/pull/5708)

- Reuse common ui dialogs and message for mobile and LayerUI [#5611](https://github.com/excalidraw/excalidraw/pull/5611)

- Stats component [#5610](https://github.com/excalidraw/excalidraw/pull/5610)

- Move footer to its own component [#5609](https://github.com/excalidraw/excalidraw/pull/5609)

- Remove unused attribute hasHitElementInside from pointerDownState [#5591](https://github.com/excalidraw/excalidraw/pull/5591)

- Cleanup renderScene [#5573](https://github.com/excalidraw/excalidraw/pull/5573)

- Rename docs to dev-docs [#5487](https://github.com/excalidraw/excalidraw/pull/5487)

- Remove unnecessary if condition for linear element onKeyDown [#5486](https://github.com/excalidraw/excalidraw/pull/5486)

- Improve typing & check [#5415](https://github.com/excalidraw/excalidraw/pull/5415)

- Don't pass zenModeEnable, viewModeEnabled and toggleZenMode props to LayerUI [#5444](https://github.com/excalidraw/excalidraw/pull/5444)

### Build

- Add missing dependencies: pica, lodash [#5656](https://github.com/excalidraw/excalidraw/pull/5656)

- Move dotenv to dev deps [#5472](https://github.com/excalidraw/excalidraw/pull/5472)

---

## 0.12.0 (2022-07-07)

Check out the [release notes](https://github.com/excalidraw/excalidraw/releases/tag/v0.12.0) )

**_This section lists the updates made to the excalidraw library and will not affect the integration._**

## 0.11.0 (2022-02-17)

Check out the [release notes](https://github.com/excalidraw/excalidraw/releases/tag/v0.11.0)

## 0.10.0 (2021-10-13)

Check out the [release notes](https://github.com/excalidraw/excalidraw/releases/tag/v0.10.0)

## 0.9.0 (2021-07-10)

Check out the [release notes](https://github.com/excalidraw/excalidraw/releases/tag/v0.9.0)

## 0.8.0 (2021-05-15)

## Excalidraw API

**_These section lists the updates which may affect your integration, so it is recommended to go through this when upgrading the version._**

### Features

- Support updating any `appState` properties in [`updateScene`](https://github.com/excalidraw/excalidraw/blob/master/src/components/App.tsx#L282) API. Earlier only `appState.viewBackgroundColor` was supported, now any attribute can be updated with this API.
- Expose [`serializeAsJSON`](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#serializeAsJSON) helper that we use when saving Excalidraw scene to a file [#3538](https://github.com/excalidraw/excalidraw/pull/3538).
- Add support to render custom UI in the top right corner via [`renderTopRightUI`](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#renderTopRightUI) prop [#3539](https://github.com/excalidraw/excalidraw/pull/3539), [#3572](https://github.com/excalidraw/excalidraw/pull/3572) .

  This also removes the GitHub icon, keeping it local to the https://excalidraw.com app.

### Fixes

- The encryption shield icon is now removed from excalidraw package as it was specific to excalidraw app and is now rendered via [`renderFooter`](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#renderFooter) prop. In case you were hiding this icon earlier, you need not do that anymore [#3577](https://github.com/excalidraw/excalidraw/pull/3577).

  Now `appState` is also passed to [`renderFooter`](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#renderFooter) prop.

## Excalidraw Library

**_These section lists the updates made to the excalidraw library and will not affect the integration._**

### Features

- Shortcut key for nerd stats [#3552](https://github.com/excalidraw/excalidraw/pull/3552).
- Better rendering of curved rectangles [#3562](https://github.com/excalidraw/excalidraw/pull/3562).
- Improved freedraw [#3512](https://github.com/excalidraw/excalidraw/pull/3512).
- Add shortcut for dark mode [#3543](https://github.com/excalidraw/excalidraw/pull/3543).
- Adds rounded icons, joins and caps.[#3521](https://github.com/excalidraw/excalidraw/pull/3521).

### Fixes

- Exporting freedraw with color to svg [#3565](https://github.com/excalidraw/excalidraw/pull/3565).
- Handle render errors [#3557](https://github.com/excalidraw/excalidraw/pull/3557).
- Restore on paste or lib import [#3558](https://github.com/excalidraw/excalidraw/pull/3558).
- Improve mobile user experience [#3508](https://github.com/excalidraw/excalidraw/pull/3508).
- Prevent selecting `.visually-hidden` elements [#3501](https://github.com/excalidraw/excalidraw/pull/3501).

### Perf

- Reduce SVG export size by more than half by reducing precision to 2 decimal places [#3567](https://github.com/excalidraw/excalidraw/pull/3567).
- Remove `backdrop-filter` to improve perf [#3506](https://github.com/excalidraw/excalidraw/pull/3506)

---

## 0.7.0 (2021-04-26)

## Excalidraw API

### Features

- [`scrollToContent`](https://github.com/excalidraw/excalidraw/blob/master/src/components/App.tsx#L265) API now supports passing just a single Excalidraw element, or none at all (which will default to current elements on the scene) [#3482](https://github.com/excalidraw/excalidraw/pull/3482).

  #### BREAKING CHANGE

  - Renamed `setScrollToContent` to [`scrollToContent`](https://github.com/excalidraw/excalidraw/blob/master/src/components/App.tsx#L265).

- Make library local to given excalidraw instance (previously, all instances on the same page shared one global library) [#3451](https://github.com/excalidraw/excalidraw/pull/3451).

  - Added prop [onLibraryChange](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#onLibraryChange) which if supplied will be called when library is updated.

  - Added attribute `libraryItems` to prop [initialData](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#initialdata) which can be used to load excalidraw with existing library items.

  - Assign a [unique id](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#Id) to the excalidraw component. The id can be accessed via [`ref`](https://github.com/excalidraw/excalidraw/blob/master/src/components/App.tsx#L298).

  #### BREAKING CHANGE

  - From now on the host application is responsible for [persisting the library](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#onLibraryChange) to LocalStorage (or elsewhere), and [importing it on mount](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#initialdata).

- Bind the keyboard events to component and added a prop [`handleKeyboardGlobally`](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#handleKeyboardGlobally) which if set to true will bind the keyboard events to document [#3430](https://github.com/excalidraw/excalidraw/pull/3430).

  #### BREAKING CHANGE

  - Earlier keyboard events were bind to document but now its bind to Excalidraw component by default. So you will need to set [`handleKeyboardGlobally`](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#handleKeyboardGlobally) to true if you want the previous behaviour (bind the keyboard events to document).

- Recompute offsets on `scroll` of the nearest scrollable container [#3408](https://github.com/excalidraw/excalidraw/pull/3408). This can be disabled by setting [`detectScroll`](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#detectScroll) to `false`.

- Add `onPaste` prop to handle custom clipboard behaviours [#3420](https://github.com/excalidraw/excalidraw/pull/3420).

### Fixes

- Changing z-index of elements (sorting them below/above other elements) now updates their `version` and `versionNonce` (only applies to the selected elements). This fix will allow you account for z-index changes if you're syncing just the elements that changed (and not the whole scene) [#3483](https://github.com/excalidraw/excalidraw/pull/3483).
- Only handle cut/paste events inside excalidraw [#3484](https://github.com/excalidraw/excalidraw/pull/3484).

- Make history local to a given Excalidraw instance. This fixes a case where history was getting shared when you have multiple Excalidraw components on the same page [#3481](https://github.com/excalidraw/excalidraw/pull/3481).
- Use active Excalidraw component when editing text. This fixes a case where text editing was not working when you have multiple Excalidraw components on the same page [#3478](https://github.com/excalidraw/excalidraw/pull/3478).

- Fix library being pasted off-center [#3462](https://github.com/excalidraw/excalidraw/pull/3462).

- When switching theme, apply it only to the active Excalidraw component. This fixes a case where the theme was getting applied to the first Excalidraw component if you had multiple Excalidraw components on the same page [#3446](https://github.com/excalidraw/excalidraw/pull/3446).

### Refactor

- #### BREAKING CHANGE

  - Removed exposing `getSyncableElements` helper which was specific to excalidraw app collab implementation [#3471](https://github.com/excalidraw/excalidraw/pull/3471). If you happened to use it, you can easily reimplement it yourself using the newly exposed [isInvisiblySmallElement](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#isInvisiblySmallElement) helper:

    ```ts
    const getSyncableElements = (elements: readonly ExcalidrawElement[]) =>
      elements.filter((el) => el.isDeleted || !isInvisiblySmallElement(el));
    ```

### Build

- Add vendor prefixes to css rules [#3476](https://github.com/excalidraw/excalidraw/pull/3476).

## Types

- Renamed the following types in case you depend on them (via [#3427](https://github.com/excalidraw/excalidraw/pull/3427)):
  - `DataState` → `ExportedDataState`
  - `LibraryData` → `ExportedLibraryData`

## Excalidraw Library

### Features

- Support tab-to-indent when editing text [#3411](https://github.com/excalidraw/excalidraw/pull/3411).

- App now breaks into mobile view using the component dimensions, not viewport dimensions. This fixes a case where the app would break sooner than necessary when the component's size is smaller than viewport [#3414](https://github.com/excalidraw/excalidraw/pull/3414).

- Add screenshots to manifest.json [#3369](https://github.com/excalidraw/excalidraw/pull/3369).

- Enable drop event on the whole component [#3406](https://github.com/excalidraw/excalidraw/pull/3406).

### Fixes

- Focus on last active element when dialog closes [#3447](https://github.com/excalidraw/excalidraw/pull/3447).

- Fix incorrectly caching png file handle [#3407](https://github.com/excalidraw/excalidraw/pull/3407).

- Fix popover position incorrect on Safari for non-zero offsets/scroll [#3399](https://github.com/excalidraw/excalidraw/pull/3399).

---

## 0.6.0 (2021-04-04)

## Excalidraw API

### Features

- Add `UIOptions` prop to customise `canvas actions` which includes customising `background color picker`, `clear canvas`, `export`, `load`, `save`, `save as` & `theme toggle` [#3364](https://github.com/excalidraw/excalidraw/pull/3364). Check the [readme](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#uioptions) for more details.
- Calculate `width/height` of canvas based on excalidraw component (".excalidraw" selector) & also resize and update offsets whenever the dimensions of excalidraw component gets updated [#3379](https://github.com/excalidraw/excalidraw/pull/3379). You also don't need to add a resize handler anymore for excalidraw as its handled now in excalidraw itself.
  #### BREAKING CHANGE
  - `width/height` props have been removed. Instead now it takes `100%` of `width` and `height` of the container so you need to make sure the container in which you are rendering Excalidraw has non zero dimensions (It should have non zero width and height so Excalidraw can match the dimensions of containing block)
- Calculate offsets when excalidraw container resizes using resize observer api [#3374](https://github.com/excalidraw/excalidraw/pull/3374).
- Export types for the package so now it can be used with typescript [#3337](https://github.com/excalidraw/excalidraw/pull/3337). The types are available at `@excalidraw/excalidraw/types`.
- Add `renderCustomStats` prop to render extra stats on host, and expose `setToastMessage` API via refs which can be used to show toast with custom message [#3360](https://github.com/excalidraw/excalidraw/pull/3360).
- Support passing a CSRF token when importing libraries to prevent prompting before installation. The token is passed from [https://libraries.excalidraw.com](https://libraries.excalidraw.com/) using the `token` URL key [#3329](https://github.com/excalidraw/excalidraw/pull/3329).
- #### BREAKING CHANGE
  Use `location.hash` when importing libraries to fix installation issues. This will require host apps to add a `hashchange` listener and call the newly exposed `excalidrawAPI.importLibrary(url)` API when applicable [#3320](https://github.com/excalidraw/excalidraw/pull/3320). Check the [readme](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#importlibrary) for more details.
- Append `location.pathname` to `libraryReturnUrl` default url [#3325](https://github.com/excalidraw/excalidraw/pull/3325).
- Support image elements [#3424](https://github.com/excalidraw/excalidraw/pull/3424).

### Build

- Expose separate builds for dev and prod and support source maps in dev build [#3330](https://github.com/excalidraw/excalidraw/pull/3330). Check the [readme](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#installation) for more details.
  #### BREAKING CHANGE
  - If you are using script tag to embed excalidraw then the name of the file will have to be updated to `excalidraw.production.min.js` instead of `excalidraw.min.js`. If you want to use dev build you can use `excalidraw.development.js`

### Refactor

#### BREAKING CHANGE

- Rename the API `setCanvasOffsets` exposed via [`ref`](https://github.com/excalidraw/excalidraw/blob/master/src/components/App.tsx#L265) to `refresh` [#3398](https://github.com/excalidraw/excalidraw/pull/3398).

## Excalidraw Library

### Features

- Reopen library menu on import from file [#3383](https://github.com/excalidraw/excalidraw/pull/3383).
- Don't unnecessarily prompt when installing libraries [#3329](https://github.com/excalidraw/excalidraw/pull/3329).
- Add option to flip single element on the context menu [#2520](https://github.com/excalidraw/excalidraw/pull/2520).
- Replace fontSize and fontFamily text with icons [#2857](https://github.com/excalidraw/excalidraw/pull/2857).

### Fixes

- Export dialog canvas positioning [#3397](https://github.com/excalidraw/excalidraw/pull/3397).
- Don't share collab types with core [#3353](https://github.com/excalidraw/excalidraw/pull/3353).
- Support d&d of files without extension [#3168](https://github.com/excalidraw/excalidraw/pull/3168).
- Positions stats for linear elements [#3331](https://github.com/excalidraw/excalidraw/pull/3331).
- Debounce.flush invokes func even if never queued before [#3326](https://github.com/excalidraw/excalidraw/pull/3326).
- State selection state on opening contextMenu [#3333](https://github.com/excalidraw/excalidraw/pull/3333).
- Add unique key for library header to resolve dev warnings [#3316](https://github.com/excalidraw/excalidraw/pull/3316).
- disallow create text in viewMode on mobile [#3219](https://github.com/excalidraw/excalidraw/pull/3219).
- Make help toggle tabbable [#3310](https://github.com/excalidraw/excalidraw/pull/3310)
- Show Windows share icon for Windows users [#3306](https://github.com/excalidraw/excalidraw/pull/3306).
- Don't scroll to content on INIT websocket message [#3291](https://github.com/excalidraw/excalidraw/pull/3291).

### Refactor

- Use arrow function where possible [#3315](https://github.com/excalidraw/excalidraw/pull/3315).

---

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
