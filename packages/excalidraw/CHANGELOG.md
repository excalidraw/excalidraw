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

## Excalidraw Library

## 0.18.0 (2025-03-11)

### Highlights

- Command palette [#7804](https://github.com/excalidraw/excalidraw/pull/7804)

- Multiplayer undo / redo [#7348](https://github.com/excalidraw/excalidraw/pull/7348)

- Editable element stats [#6382](https://github.com/excalidraw/excalidraw/pull/6382)

- Text element wrapping [#7999](https://github.com/excalidraw/excalidraw/pull/7999)

- Font picker with more fonts [#8012](https://github.com/excalidraw/excalidraw/pull/8012)

- Font for Chinese, Japanese and Korean [#8530](https://github.com/excalidraw/excalidraw/pull/8530)

- Font subsetting for SVG export [#8384](https://github.com/excalidraw/excalidraw/pull/8384)

- Elbow arrows [#8299](https://github.com/excalidraw/excalidraw/pull/8299), [#8952](https://github.com/excalidraw/excalidraw/pull/8952)

- Flowcharts [#8329](https://github.com/excalidraw/excalidraw/pull/8329)

- Scene search [#8438](https://github.com/excalidraw/excalidraw/pull/8438)

- Image cropping [#8613](https://github.com/excalidraw/excalidraw/pull/8613)

- Element linking [#8812](https://github.com/excalidraw/excalidraw/pull/8812)

### Breaking changes

#### Deprecated UMD bundle in favor of ES modules [#7441](https://github.com/excalidraw/excalidraw/pull/7441), [#9127](https://github.com/excalidraw/excalidraw/pull/9127)

We've transitioned from `UMD` to `ESM` bundle format. Our new `dist` folder inside `@excalidraw/excalidraw` package now contains only bundled source files, making any dependencies tree-shakable. The package comes with the following structure:

> **Note**: The structure is simplified for the sake of brevity, omitting lazy-loadable modules, including locales (previously treated as JSON assets) and source maps in the development bundle.

```
@excalidraw/excalidraw/
├── dist/
│   ├── dev/
│   │   ├── fonts/
│   │   ├── index.css
│   │   ├── index.js
│   │   ├── index.js.map
│   ├── prod/
│   │   ├── fonts/
│   │   ├── index.css
│   │   ├── index.js
│   └── types/
```

Make sure that your JavaScript environment supports ES modules. You _may_ need to define `"type": "module"` in your `package.json` file or as part of the `<script type="module" />` attribute.

##### Typescript: deprecated "moduleResolution": `"node"` or `"node10"`

Since `"node"` and `"node10"` do not support `package.json` `"exports"` fields, having these values in your `tsconfig.json` will not work. Instead, use `"bundler"`, `"node16"` or `"nodenext"` values. For more information, see [Typescript's documentation](https://www.typescriptlang.org/tsconfig/#moduleResolution).

##### ESM strict resolution

Due to ESM's strict resolution, if you're using Webpack or other bundler that expects import paths to be fully specified, you'll need to disable this feature explicitly.

For example in Webpack, you should set [`resolve.fullySpecified`](https://webpack.js.org/configuration/resolve/#resolvefullyspecified) to `false`.

For this reason, CRA will no longer work unless you eject or use a workaround such as [craco](https://stackoverflow.com/a/75109686).

##### New structure of the imports

Depending on the environment, this is how imports should look like with the `ESM`:

**With bundler (Vite, Next.js, etc.)**

```ts
// excalidraw library with public API
import * as excalidrawLib from "@excalidraw/excalidraw";
// excalidraw react component
import { Excalidraw } from "@excalidraw/excalidraw";
// excalidraw styles, usually auto-processed by the build tool (i.e. vite, next, etc.)
import "@excalidraw/excalidraw/index.css";
// excalidraw types (optional)
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
```

**Without bundler (Browser)**

```html
<!-- Environment: browser with a script tag and no bundler -->

<!-- excalidraw styles -->
<link
  rel="stylesheet"
  href="https://esm.sh/@excalidraw/excalidraw@0.18.0/dist/dev/index.css"
/>
<!-- import maps used for deduplicating react & react-dom versions -->
<script type="importmap">
  {
    "imports": {
      "react": "https://esm.sh/react@19.0.0",
      "react/jsx-runtime": "https://esm.sh/react@19.0.0/jsx-runtime",
      "react-dom": "https://esm.sh/react-dom@19.0.0"
    }
  }
</script>
<script type="module">
  import React from "https://esm.sh/react@19.0.0";
  import ReactDOM from "https://esm.sh/react-dom@19.0.0";
  import * as ExcalidrawLib from "https://esm.sh/@excalidraw/excalidraw@0.18.0/dist/dev/index.js?external=react,react-dom";
</script>
```

#### Deprecated `excalidraw-assets` and `excalidraw-assets-dev` folders [#8012](https://github.com/excalidraw/excalidraw/pull/8012), [#9127](https://github.com/excalidraw/excalidraw/pull/9127)

The `excalidraw-assets` and `excalidraw-assets-dev` folders, which contained locales and fonts, are no longer used and have been deprecated.

##### Locales

Locales are no longer treated as static `.json` assets but are transpiled with `esbuild` directly to the `.js` as ES modules. Note that some build tools (i.e. Vite) may require setting `es2022` as a build target, in order to support "Arbitrary module namespace identifier names", e.g. `export { english as "en-us" } )`.

```js
// vite.config.js
optimizeDeps: {
  esbuildOptions: {
    // Bumping to 2022 due to "Arbitrary module namespace identifier names" not being
    // supported in Vite's default browser target https://github.com/vitejs/vite/issues/13556
    target: "es2022",
    // Tree shaking is optional, but recommended
    treeShaking: true,
  },
}
```

##### Fonts

All fonts are automatically loaded from the [esm.run](https://esm.run/) CDN. For self-hosting purposes, you'll have to copy the content of the folder `node_modules/@excalidraw/excalidraw/dist/prod/fonts` to the path where your assets should be served from (i.e. `public/` directory in your project). In that case, you should also set `window.EXCALIDRAW_ASSET_PATH` to the very same path, i.e. `/` in case it's in the root:

```js
<script>window.EXCALIDRAW_ASSET_PATH = "/";</script>
```

or, if you serve your assets from the root of your CDN, you would do:

```js
<script>
  window.EXCALIDRAW_ASSET_PATH = "https://cdn.domain.com/subpath/";
</script>
```

or, if you prefer the path to be dynamically set based on the `location.origin`, you could do the following:

```jsx
// Next.js
<Script id="load-env-variables" strategy="beforeInteractive">
  {`window["EXCALIDRAW_ASSET_PATH"] = location.origin;`} // or use just "/"!
</Script>
```

#### Deprecated `commitToHistory` in favor of `captureUpdate` in `updateScene` API [#7348](https://github.com/excalidraw/excalidraw/pull/7348), [#7898](https://github.com/excalidraw/excalidraw/pull//7898)

```js
// before
updateScene({ elements, appState, commitToHistory: true }); // A
updateScene({ elements, appState, commitToHistory: false }); // B

// after
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
updateScene({
  elements,
  appState,
  captureUpdate: CaptureUpdateAction.IMMEDIATELY,
}); // A
updateScene({
  elements,
  appState,
  captureUpdate: CaptureUpdateAction.NEVER,
}); // B
```

The `updateScene` API has changed due to the added `Store` component, as part of the multiplayer undo / redo initiative. Specifically, optional `sceneData` parameter `commitToHistory: boolean` was replaced with optional `captureUpdate: CaptureUpdateActionType` parameter. Therefore, make sure to update all instances of `updateScene`, which use `commitToHistory` parameter according to the _before / after_ table below.

> **Note**: Some updates are not observed by the store / history - i.e. updates to `collaborators` object or parts of `AppState` which are not observed (not `ObservedAppState`). Such updates will never make it to the undo / redo stacks, regardless of the passed `captureUpdate` value.

| Undo behaviour | `commitToHistory` (before) | `captureUpdate` (after) | Notes |
| --- | --- | --- | --- |
| _Immediately undoable_ | `true` | `CaptureUpdateAction.IMMEDIATELY` | Use for updates which should be captured. Should be used for most of the local updates. These updates will _immediately_ make it to the local undo / redo stacks. |
| _Eventually undoable_ | `false` (default) | `CaptureUpdateAction.EVENTUALLY` (default) | Use for updates which should not be captured immediately - likely exceptions which are part of some async multi-step process. Otherwise, all such updates would end up being captured with the next `CaptureUpdateAction.IMMEDIATELY` - triggered either by the next `updateScene` or internally by the editor. These updates will _eventually_ make it to the local undo / redo stacks. |
| _Never undoable_ | n/a | `CaptureUpdateAction.NEVER` | **NEW**: Previously there was no equivalent for this value. Now, it's recommended to use `CaptureUpdateAction.NEVER` for updates which should never be recorded, such as remote updates or scene initialization. These updates will _never_ make it to the local undo / redo stacks. |

#### Other

- `ExcalidrawTextElement.baseline` was removed and replaced with a vertical offset computation based on font metrics, performed on each text element re-render. In case of custom font usage, extend the `FONT_METRICS` object with the related properties. [#7693](https://github.com/excalidraw/excalidraw/pull/7693)

- `ExcalidrawEmbeddableElement.validated` was removed and moved to the private editor state. This should largely not affect your apps unless you were reading from this attribute. We keep validating embeddable urls internally, and the public [`props.validateEmbeddable`](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props#validateembeddable) still applies. [#7539](https://github.com/excalidraw/excalidraw/pull/7539)

- Stats container CSS has changed, so if you're using `renderCustomStats`, you may need to adjust your styles to retain the same layout. [#8361](https://github.com/excalidraw/excalidraw/pull/8361)

- `<DefaultSidebar />` triggers are now always merged with host app triggers, rendered through `<DefaultSidebar.Triggers/>`. `<DefaultSidebar.Triggers/>` no longer accepts any props other than children. [#8498](https://github.com/excalidraw/excalidraw/pull/8498)

### Features

- Prefer user defined coordinates and dimensions when creating a frame using [`convertToExcalidrawElements`](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/excalidraw-element-skeleton#converttoexcalidrawelements) [#8517](https://github.com/excalidraw/excalidraw/pull/8517)

- `props.initialData` can now be a function that returns `ExcalidrawInitialDataState` or `Promise<ExcalidrawInitialDataState>` [#8107](https://github.com/excalidraw/excalidraw/pull/8135)

- `MainMenu.DefaultItems.ToggleTheme` now supports `onSelect(theme: string)` callback, and optionally `allowSystemTheme: boolean` alongside `theme: string` to indicate you want to allow users to set to system theme (you need to handle this yourself) [#7853](https://github.com/excalidraw/excalidraw/pull/7853)

- Add `useHandleLibrary`'s `opts.adapter` as the new recommended pattern to handle library initialization and persistence on library updates [#7655](https://github.com/excalidraw/excalidraw/pull/7655)

- Add `useHandleLibrary`'s `opts.migrationAdapter` adapter to handle library migration during init, when migrating from one data store to another (e.g. from LocalStorage to IndexedDB) [#7655](https://github.com/excalidraw/excalidraw/pull/7655)

- Add `onPointerUp` prop [#7638](https://github.com/excalidraw/excalidraw/pull/7638)

- Expose `getVisibleSceneBounds` helper to get scene bounds of visible canvas area [#7450](https://github.com/excalidraw/excalidraw/pull/7450)

- Soft-deprecate `useHandleLibrary`'s `opts.getInitialLibraryItems` in favor of `opts.adapter`. [#7655](https://github.com/excalidraw/excalidraw/pull/7655)

- Extended `window.EXCALIDRAW_ASSET_PATH` to accept array of paths `string[]` as a value, allowing to specify multiple base `URL` fallbacks. [#8286](https://github.com/excalidraw/excalidraw/pull/8286)

- Custom text metrics provider [#9121](https://github.com/excalidraw/excalidraw/pull/9121)

- Add `props.onDuplicate` [#9117](https://github.com/excalidraw/excalidraw/pull/9117)

- Change empty arrowhead icon [#9100](https://github.com/excalidraw/excalidraw/pull/9100)

- Tweak slider colors to be more muted [#9076](https://github.com/excalidraw/excalidraw/pull/9076)

- Improve library sidebar performance [#9060](https://github.com/excalidraw/excalidraw/pull/9060)

- Implement custom Range component for opacity control [#9009](https://github.com/excalidraw/excalidraw/pull/9009)

- Box select frame & children to allow resizing at the same time [#9031](https://github.com/excalidraw/excalidraw/pull/9031)

- Allow installing libs from excal github [#9041](https://github.com/excalidraw/excalidraw/pull/9041)

- Update jotai [#9015](https://github.com/excalidraw/excalidraw/pull/9015)

- Do not delete frame children on frame delete [#9011](https://github.com/excalidraw/excalidraw/pull/9011)

- Add action to wrap selected items in a frame [#9005](https://github.com/excalidraw/excalidraw/pull/9005)

- Reintroduce `.excalidraw.png` default when embedding scene [#8979](https://github.com/excalidraw/excalidraw/pull/8979)

- Add mimeTypes on file save [#8946](https://github.com/excalidraw/excalidraw/pull/8946)

- Add crowfoot to arrowheads [#8942](https://github.com/excalidraw/excalidraw/pull/8942)

- Make HTML attribute sanitization stricter [#8977](https://github.com/excalidraw/excalidraw/pull/8977)

- Validate library install urls [#8976](https://github.com/excalidraw/excalidraw/pull/8976)

- Cleanup svg export and move payload to `<metadata>` [#8975](https://github.com/excalidraw/excalidraw/pull/8975)

- Use stats panel to crop [#8848](https://github.com/excalidraw/excalidraw/pull/8848)

- Snap when cropping as well [#8831](https://github.com/excalidraw/excalidraw/pull/8831)

- Update blog url [#8767](https://github.com/excalidraw/excalidraw/pull/8767)

- Export scene to e+ on workspace creation/redemption [#8514](https://github.com/excalidraw/excalidraw/pull/8514)

- Added sitemap & fixed robot txt [#8699](https://github.com/excalidraw/excalidraw/pull/8699)

- Do not strip unknown element properties on restore [#8682](https://github.com/excalidraw/excalidraw/pull/8682)

- Added reddit links as embeddable [#8099](https://github.com/excalidraw/excalidraw/pull/8099)

- Self-hosting existing google fonts [#8540](https://github.com/excalidraw/excalidraw/pull/8540)

- Flip arrowheads if only arrow(s) selected [#8525](https://github.com/excalidraw/excalidraw/pull/8525)

- Common elbow mid segments [#8440](https://github.com/excalidraw/excalidraw/pull/8440)

- Merge search sidebar back to default sidebar [#8497](https://github.com/excalidraw/excalidraw/pull/8497)

- Smarter zooming when scrolling to match & only match on search/switch [#8488](https://github.com/excalidraw/excalidraw/pull/8488)

- Reset copyStatus on export dialog settings change [#8443](https://github.com/excalidraw/excalidraw/pull/8443)

- Tweak copy button success animation [#8441](https://github.com/excalidraw/excalidraw/pull/8441)

- Enable panning/zoom while in wysiwyg [#8437](https://github.com/excalidraw/excalidraw/pull/8437)

- Visual debugger [#8344](https://github.com/excalidraw/excalidraw/pull/8344)

- Improve elbow arrow keyboard move [#8392](https://github.com/excalidraw/excalidraw/pull/8392)

- Rewrite d2c to not require token [#8269](https://github.com/excalidraw/excalidraw/pull/8269)

- Split `gridSize` from enabled state & support custom `gridStep` [#8364](https://github.com/excalidraw/excalidraw/pull/8364)

- Improve zoom-to-content when creating flowchart [#8368](https://github.com/excalidraw/excalidraw/pull/8368)

- Stats popup style tweaks [#8361](https://github.com/excalidraw/excalidraw/pull/8361)

- Remove automatic frame naming [#8302](https://github.com/excalidraw/excalidraw/pull/8302)

- Ability to debug the state of fractional indices [#8235](https://github.com/excalidraw/excalidraw/pull/8235)

- Improve mermaid detection on paste [#8287](https://github.com/excalidraw/excalidraw/pull/8287)

- Upgrade mermaid-to-excalidraw to v1.1.0 [#8226](https://github.com/excalidraw/excalidraw/pull/8226)

- Bump max file size [#8220](https://github.com/excalidraw/excalidraw/pull/8220)

- Smarter preferred lang detection [#8205](https://github.com/excalidraw/excalidraw/pull/8205)

- Support Stats bound text `fontSize` editing [#8187](https://github.com/excalidraw/excalidraw/pull/8187)

- Paste as mermaid if applicable [#8116](https://github.com/excalidraw/excalidraw/pull/8116)

- Stop autoselecting text on text edit on mobile [#8076](https://github.com/excalidraw/excalidraw/pull/8076)

- Create new text with width [#8038](https://github.com/excalidraw/excalidraw/pull/8038)

- Wrap long text when pasting [#8026](https://github.com/excalidraw/excalidraw/pull/8026)

- Upgrade to mermaid-to-excalidraw v1 🚀 [#8022](https://github.com/excalidraw/excalidraw/pull/8022)

- Rerender canvas on focus [#8035](https://github.com/excalidraw/excalidraw/pull/8035)

- Add missing `type="button"` [#8030](https://github.com/excalidraw/excalidraw/pull/8030)

- Add install-PWA to command palette [#7935](https://github.com/excalidraw/excalidraw/pull/7935)

- Tweak a few icons & add line editor button to side panel [#7990](https://github.com/excalidraw/excalidraw/pull/7990)

- Allow binding only via linear element ends [#7946](https://github.com/excalidraw/excalidraw/pull/7946)

- Resize elements from the sides [#7855](https://github.com/excalidraw/excalidraw/pull/7855)

- Record freedraw tool selection to history [#7949](https://github.com/excalidraw/excalidraw/pull/7949)

- Export reconciliation [#7917](https://github.com/excalidraw/excalidraw/pull/7917)

- Add "toggle grid" to command palette [#7887](https://github.com/excalidraw/excalidraw/pull/7887)

- Fractional indexing [#7359](https://github.com/excalidraw/excalidraw/pull/7359)

- Show firefox-compatible command palette shortcut alias [#7825](https://github.com/excalidraw/excalidraw/pull/7825)

- Upgrade mermaid-to-excalidraw to 0.3.0 [#7819](https://github.com/excalidraw/excalidraw/pull/7819)

- Support to not render remote cursor & username [#7130](https://github.com/excalidraw/excalidraw/pull/7130)

- Expose more collaborator status icons [#7777](https://github.com/excalidraw/excalidraw/pull/7777)

- Close dropdown on escape [#7750](https://github.com/excalidraw/excalidraw/pull/7750)

- Text measurements based on font metrics [#7693](https://github.com/excalidraw/excalidraw/pull/7693)

- Improve collab error notification [#7741](https://github.com/excalidraw/excalidraw/pull/7741)

- Grouped together Undo and Redo buttons on mobile [#9109](https://github.com/excalidraw/excalidraw/pull/9109)

- Remove GA code from binding [#9042](https://github.com/excalidraw/excalidraw/pull/9042)

- Load old library if migration fails

- Change LibraryPersistenceAdapter `load()` `source` -> `priority`

### Fixes

- Fix inconsistency in resizing while maintaining aspect ratio [#9116](https://github.com/excalidraw/excalidraw/pull/9116)

- IFrame and elbow arrow interaction fix [#9101](https://github.com/excalidraw/excalidraw/pull/9101)

- Duplicating/removing frame while children selected [#9079](https://github.com/excalidraw/excalidraw/pull/9079)

- Elbow arrow z-index binding [#9067](https://github.com/excalidraw/excalidraw/pull/9067)

- Library item checkbox style regression [#9080](https://github.com/excalidraw/excalidraw/pull/9080)

- Elbow arrow orthogonality [#9073](https://github.com/excalidraw/excalidraw/pull/9073)

- Button bg CSS variable leaking into other styles [#9075](https://github.com/excalidraw/excalidraw/pull/9075)

- Fonts not loading on export (again) [#9064](https://github.com/excalidraw/excalidraw/pull/9064)

- Merge server-side fonts with liberation sans [#9052](https://github.com/excalidraw/excalidraw/pull/9052)

- Hyperlinks html entities [#9063](https://github.com/excalidraw/excalidraw/pull/9063)

- Remove flushSync to fix flickering [#9057](https://github.com/excalidraw/excalidraw/pull/9057)

- Excalidraw issue #9045 flowcharts: align attributes of new node [#9047](https://github.com/excalidraw/excalidraw/pull/9047)

- Align arrows bound to elements excalidraw#8833 [#8998](https://github.com/excalidraw/excalidraw/pull/8998)

- Update elbow arrow on font size change #8798 [#9002](https://github.com/excalidraw/excalidraw/pull/9002)

- Undo for elbow arrows create incorrect routing [#9046](https://github.com/excalidraw/excalidraw/pull/9046)

- Flowchart clones the current arrowhead [#8581](https://github.com/excalidraw/excalidraw/pull/8581)

- Adding partial group to frame [#9014](https://github.com/excalidraw/excalidraw/pull/9014)

- Do not refocus element link input on unrelated updates [#9037](https://github.com/excalidraw/excalidraw/pull/9037)

- Arrow binding behaving unexpectedly on pointerup [#9010](https://github.com/excalidraw/excalidraw/pull/9010)

- Change cursor by tool change immediately [#8212](https://github.com/excalidraw/excalidraw/pull/8212)

- Package build fails on worker chunks [#8990](https://github.com/excalidraw/excalidraw/pull/8990)

- Z-index clash in mobile UI [#8985](https://github.com/excalidraw/excalidraw/pull/8985)

- Elbow arrows do not work within frames (issue: #8964) [#8969](https://github.com/excalidraw/excalidraw/pull/8969)

- NormalizeSVG width and height from viewbox when size includes decimal points [#8939](https://github.com/excalidraw/excalidraw/pull/8939)

- Make arrow binding area adapt to zoom levels [#8927](https://github.com/excalidraw/excalidraw/pull/8927)

- Robust `state.editingFrame` teardown [#8941](https://github.com/excalidraw/excalidraw/pull/8941)

- Regression on dragging a selected frame by its name [#8924](https://github.com/excalidraw/excalidraw/pull/8924)

- Right-click paste for images in clipboard (Issue #8826) [#8845](https://github.com/excalidraw/excalidraw/pull/8845)

- Fixed image transparency by adding alpha option to preserve image alpha channel [#8895](https://github.com/excalidraw/excalidraw/pull/8895)

- Flush pending DOM updates before .focus() [#8901](https://github.com/excalidraw/excalidraw/pull/8901)

- Normalize svg using only absolute sizing [#8854](https://github.com/excalidraw/excalidraw/pull/8854)

- Element link selector dialog z-index & positioning [#8853](https://github.com/excalidraw/excalidraw/pull/8853)

- Update old blog links & add canonical url [#8846](https://github.com/excalidraw/excalidraw/pull/8846)

- Optimize frameToHighlight state change and snapLines state change [#8763](https://github.com/excalidraw/excalidraw/pull/8763)

- Make some events expllicitly active to avoid console warnings [#8757](https://github.com/excalidraw/excalidraw/pull/8757)

- Unify binding update options for `updateBoundElements()` [#8832](https://github.com/excalidraw/excalidraw/pull/8832)

- Cleanup scripts and support upto node 22 [#8794](https://github.com/excalidraw/excalidraw/pull/8794)

- Usage of `node12 which is deprecated` [#8791](https://github.com/excalidraw/excalidraw/pull/8791)

- Remove manifest.json [#8783](https://github.com/excalidraw/excalidraw/pull/8783)

- Load env vars correctly and set debug and linter flags to false explicitly in prod mode [#8770](https://github.com/excalidraw/excalidraw/pull/8770)

- Console error in dev mode due to missing font path in non-prod [#8756](https://github.com/excalidraw/excalidraw/pull/8756)

- Text pushes UI due to padding [#8745](https://github.com/excalidraw/excalidraw/pull/8745)

- Fix trailing line whitespaces layout shift [#8714](https://github.com/excalidraw/excalidraw/pull/8714)

- Load font faces in Safari manually [#8693](https://github.com/excalidraw/excalidraw/pull/8693)

- Restore svg image DataURL dimensions [#8730](https://github.com/excalidraw/excalidraw/pull/8730)

- Image cropping svg + compat mode [#8710](https://github.com/excalidraw/excalidraw/pull/8710)

- Usage of `node12 which is deprecated` [#8709](https://github.com/excalidraw/excalidraw/pull/8709)

- Image render perf [#8697](https://github.com/excalidraw/excalidraw/pull/8697)

- Undo/redo action for international keyboard layouts [#8649](https://github.com/excalidraw/excalidraw/pull/8649)

- Comic Shanns issues, new fonts structure [#8641](https://github.com/excalidraw/excalidraw/pull/8641)

- Remove export-to-clip-as-svg shortcut for now [#8660](https://github.com/excalidraw/excalidraw/pull/8660)

- Text disappearing on edit [#8558](https://github.com/excalidraw/excalidraw/pull/8558) (#8624)

- Elbow arrow fixedpoint flipping now properly flips on inverted resize and flip action [#8324](https://github.com/excalidraw/excalidraw/pull/8324)

- Svg and png frame clipping cases [#8515](https://github.com/excalidraw/excalidraw/pull/8515)

- Re-route elbow arrows when pasted [#8448](https://github.com/excalidraw/excalidraw/pull/8448)

- Buffer dependency [#8474](https://github.com/excalidraw/excalidraw/pull/8474)

- Linear element complete button disabled [#8492](https://github.com/excalidraw/excalidraw/pull/8492)

- Aspect ratios of distorted images are not preserved in SVG exports [#8061](https://github.com/excalidraw/excalidraw/pull/8061)

- WYSIWYG editor padding is not normalized with zoom.value [#8481](https://github.com/excalidraw/excalidraw/pull/8481)

- Improve canvas search scroll behavior further [#8491](https://github.com/excalidraw/excalidraw/pull/8491)

- AddFiles clears the whole image cache when each file is added - regression from #8471 [#8490](https://github.com/excalidraw/excalidraw/pull/8490)

- `select` instead of `focus` search input [#8483](https://github.com/excalidraw/excalidraw/pull/8483)

- Image rendering issue when passed in `initialData` [#8471](https://github.com/excalidraw/excalidraw/pull/8471)

- Add partial mocking [#8473](https://github.com/excalidraw/excalidraw/pull/8473)

- PropertiesPopover maxWidth changing fixed units to relative units [#8456](https://github.com/excalidraw/excalidraw/pull/8456)

- View mode wheel zooming does not work [#8452](https://github.com/excalidraw/excalidraw/pull/8452)

- Fixed copy to clipboard button [#8426](https://github.com/excalidraw/excalidraw/pull/8426)

- Context menu does not work after after dragging on StatsDragInput [#8386](https://github.com/excalidraw/excalidraw/pull/8386)

- Perf regression in `getCommonBounds` [#8429](https://github.com/excalidraw/excalidraw/pull/8429)

- Object snapping not working [#8381](https://github.com/excalidraw/excalidraw/pull/8381)

- Reimplement rectangle intersection [#8367](https://github.com/excalidraw/excalidraw/pull/8367)

- Round coordinates and sizes for rectangle intersection [#8366](https://github.com/excalidraw/excalidraw/pull/8366)

- Text content with tab characters act differently in view/edit [#8336](https://github.com/excalidraw/excalidraw/pull/8336)

- Drawing from 0-dimension canvas [#8356](https://github.com/excalidraw/excalidraw/pull/8356)

- Disable flowchart keybindings inside inputs [#8353](https://github.com/excalidraw/excalidraw/pull/8353)

- Yet more patching of intersect code [#8352](https://github.com/excalidraw/excalidraw/pull/8352)

- Missing `act()` in flowchart tests [#8354](https://github.com/excalidraw/excalidraw/pull/8354)

- Z-index change by one causes app to freeze [#8314](https://github.com/excalidraw/excalidraw/pull/8314)

- Patch over intersection calculation issue [#8350](https://github.com/excalidraw/excalidraw/pull/8350)

- Point duplication in LEE on ALT+click [#8347](https://github.com/excalidraw/excalidraw/pull/8347)

- Do not allow resizing unbound elbow arrows either [#8333](https://github.com/excalidraw/excalidraw/pull/8333)

- Docker build in CI [#8312](https://github.com/excalidraw/excalidraw/pull/8312)

- Duplicating arrow without bound elements throws error [#8316](https://github.com/excalidraw/excalidraw/pull/8316)

- CVE-2023-45133 [#7988](https://github.com/excalidraw/excalidraw/pull/7988)

- Throttle fractional indices validation [#8306](https://github.com/excalidraw/excalidraw/pull/8306)

- Allow binding elbow arrows to frame children [#8309](https://github.com/excalidraw/excalidraw/pull/8309)

- Skip registering font faces for local fonts [#8303](https://github.com/excalidraw/excalidraw/pull/8303)

- Load fonts for `exportToCanvas` [#8298](https://github.com/excalidraw/excalidraw/pull/8298)

- Re-add Cascadia Code with ligatures [#8291](https://github.com/excalidraw/excalidraw/pull/8291)

- Linear elements not selected on pointer up from hitting its bound text [#8285](https://github.com/excalidraw/excalidraw/pull/8285)

- Revert default element canvas padding change [#8266](https://github.com/excalidraw/excalidraw/pull/8266)

- Freedraw jittering [#8238](https://github.com/excalidraw/excalidraw/pull/8238)

- Messed up env variable [#8231](https://github.com/excalidraw/excalidraw/pull/8231)

- Log allowed events [#8224](https://github.com/excalidraw/excalidraw/pull/8224)

- Memory leak - scene.destroy() and window.launchQueue [#8198](https://github.com/excalidraw/excalidraw/pull/8198)

- Stop updating text versions on init [#8191](https://github.com/excalidraw/excalidraw/pull/8191)

- Add binding update to manual stat changes [#8183](https://github.com/excalidraw/excalidraw/pull/8183)

- Binding after duplicating is now applied for both the old and duplicate shapes [#8185](https://github.com/excalidraw/excalidraw/pull/8185)

- Incorrect point offsetting in LinearElementEditor.movePoints() [#8145](https://github.com/excalidraw/excalidraw/pull/8145)

- Stats state leaking & race conds [#8177](https://github.com/excalidraw/excalidraw/pull/8177)

- Only bind arrow [#8152](https://github.com/excalidraw/excalidraw/pull/8152)

- Repair invalid binding on restore & fix type check [#8133](https://github.com/excalidraw/excalidraw/pull/8133)

- Wysiwyg blur-submit on mobile [#8075](https://github.com/excalidraw/excalidraw/pull/8075)

- Restore linear dimensions from points [#8062](https://github.com/excalidraw/excalidraw/pull/8062)

- Lp plus url [#8056](https://github.com/excalidraw/excalidraw/pull/8056)

- Fix twitter og image [#8050](https://github.com/excalidraw/excalidraw/pull/8050)

- Flaky snapshot tests with floating point precision issues [#8049](https://github.com/excalidraw/excalidraw/pull/8049)

- Always re-generate index of defined moved elements [#8040](https://github.com/excalidraw/excalidraw/pull/8040)

- Undo/redo when exiting view mode [#8024](https://github.com/excalidraw/excalidraw/pull/8024)

- Two finger panning is slow [#7849](https://github.com/excalidraw/excalidraw/pull/7849)

- Compatible safari layers button svg [#8020](https://github.com/excalidraw/excalidraw/pull/8020)

- Correctly resolve the package version [#8016](https://github.com/excalidraw/excalidraw/pull/8016)

- Re-introduce wysiwyg width offset [#8014](https://github.com/excalidraw/excalidraw/pull/8014)

- Font not rendered correctly on init [#8002](https://github.com/excalidraw/excalidraw/pull/8002)

- Command palette filter [#7981](https://github.com/excalidraw/excalidraw/pull/7981)

- Remove unused param from drawImagePlaceholder [#7991](https://github.com/excalidraw/excalidraw/pull/7991)

- Docker build of Excalidraw app [#7430](https://github.com/excalidraw/excalidraw/pull/7430)

- Typo in doc api [#7466](https://github.com/excalidraw/excalidraw/pull/7466)

- Use Reflect API instead of Object.hasOwn [#7958](https://github.com/excalidraw/excalidraw/pull/7958)

- CTRL/CMD & arrow point drag unbinds both sides [#6459](https://github.com/excalidraw/excalidraw/pull/6459) (#7877)

- Z-index for laser pointer to be able to draw on embeds and such [#7918](https://github.com/excalidraw/excalidraw/pull/7918)

- Double text rendering on edit [#7904](https://github.com/excalidraw/excalidraw/pull/7904)

- Collision regressions from vector geometry rewrite [#7902](https://github.com/excalidraw/excalidraw/pull/7902)

- Correct unit from 'eg' to 'deg' [#7891](https://github.com/excalidraw/excalidraw/pull/7891)

- Allow same origin for all necessary domains [#7889](https://github.com/excalidraw/excalidraw/pull/7889)

- Always make sure we render bound text above containers [#7880](https://github.com/excalidraw/excalidraw/pull/7880)

- Parse embeddable srcdoc urls strictly [#7884](https://github.com/excalidraw/excalidraw/pull/7884)

- Hit test for closed sharp curves [#7881](https://github.com/excalidraw/excalidraw/pull/7881)

- Gist embed allowing unsafe html [#7883](https://github.com/excalidraw/excalidraw/pull/7883)

- Command palette tweaks and fixes [#7876](https://github.com/excalidraw/excalidraw/pull/7876)

- Include borders when testing insides of a shape [#7865](https://github.com/excalidraw/excalidraw/pull/7865)

- External link not opening [#7859](https://github.com/excalidraw/excalidraw/pull/7859)

- Add safe check for arrow points length in tranformToExcalidrawElements [#7863](https://github.com/excalidraw/excalidraw/pull/7863)

- Import [#7869](https://github.com/excalidraw/excalidraw/pull/7869)

- Theme toggle shortcut `event.code` [#7868](https://github.com/excalidraw/excalidraw/pull/7868)

- Remove incorrect check from index.html [#7867](https://github.com/excalidraw/excalidraw/pull/7867)

- Stop using lookbehind for backwards compat [#7824](https://github.com/excalidraw/excalidraw/pull/7824)

- Ejs support in html files [#7822](https://github.com/excalidraw/excalidraw/pull/7822)

- `excalidrawAPI.toggleSidebar` not switching between tabs correctly [#7821](https://github.com/excalidraw/excalidraw/pull/7821)

- Correcting Assistant metrics [#7758](https://github.com/excalidraw/excalidraw/pull/7758)

- Add missing font metrics for Assistant [#7752](https://github.com/excalidraw/excalidraw/pull/7752)

- Export utils from excalidraw package in excalidraw library [#7731](https://github.com/excalidraw/excalidraw/pull/7731)

- Split renderScene so that locales aren't imported unnecessarily [#7718](https://github.com/excalidraw/excalidraw/pull/7718)

- Remove dependency of t in blob.ts [#7717](https://github.com/excalidraw/excalidraw/pull/7717)

- Remove dependency of t from clipboard and image [#7712](https://github.com/excalidraw/excalidraw/pull/7712)

- Remove scene hack from export.ts & remove pass elementsMap to getContainingFrame [#7713](https://github.com/excalidraw/excalidraw/pull/7713)

- Decouple pure functions from hyperlink to prevent mermaid bundling [#7710](https://github.com/excalidraw/excalidraw/pull/7710)

- Make bounds independent of scene [#7679](https://github.com/excalidraw/excalidraw/pull/7679)

- Make LinearElementEditor independent of scene [#7670](https://github.com/excalidraw/excalidraw/pull/7670)

- Remove scene from getElementAbsoluteCoords and dependent functions and use elementsMap [#7663](https://github.com/excalidraw/excalidraw/pull/7663)

- Remove t from getDefaultAppState and allow name to be nullable [#7666](https://github.com/excalidraw/excalidraw/pull/7666)

- Stop using structuredClone [#9128](https://github.com/excalidraw/excalidraw/pull/9128)

- Fix elbow arrow fixed binding on restore [#9197](https://github.com/excalidraw/excalidraw/pull/9197)

- Cleanup legacy `element.rawText` (obsidian) [#9203](https://github.com/excalidraw/excalidraw/pull/9203)

- React 18 element.ref was accessed error [#9208](https://github.com/excalidraw/excalidraw/pull/9208)

- Docked sidebar width [#9213](https://github.com/excalidraw/excalidraw/pull/9213)

- Arrow updated on both sides [#8593](https://github.com/excalidraw/excalidraw/pull/8593)

- Package env vars [#9221](https://github.com/excalidraw/excalidraw/pull/9221)

- Bound elbow arrow on duplication does not route correctly [#9236](https://github.com/excalidraw/excalidraw/pull/9236)

- Do not rebind undragged elbow arrow endpoint [#9191](https://github.com/excalidraw/excalidraw/pull/9191)

- Logging and fixing extremely large scenes [#9225](https://github.com/excalidraw/excalidraw/pull/9225)

### Refactor

- Remove `defaultProps` [#9035](https://github.com/excalidraw/excalidraw/pull/9035)

- Separate resizing logic from pointer [#8155](https://github.com/excalidraw/excalidraw/pull/8155)

- `point()` -> `pointFrom()` to fix compiler issue [#8578](https://github.com/excalidraw/excalidraw/pull/8578)

- Rename example `App.tsx` -> `ExampleApp.tsx` [#8501](https://github.com/excalidraw/excalidraw/pull/8501)

- Remove unused env variable [#8457](https://github.com/excalidraw/excalidraw/pull/8457)

- Rename `draggingElement` -> `newElement` [#8294](https://github.com/excalidraw/excalidraw/pull/8294)

- Update collision from ga to vector geometry [#7636](https://github.com/excalidraw/excalidraw/pull/7636)

### Performance

- Improved pointer events related performance when the sidebar is docked with a large library open [#9086](https://github.com/excalidraw/excalidraw/pull/9086)

- Reduce unnecessary frame clippings [#8980](https://github.com/excalidraw/excalidraw/pull/8980)

- Improve new element drawing [#8340](https://github.com/excalidraw/excalidraw/pull/8340)

- Cache the temp canvas created for labeled arrows [#8267](https://github.com/excalidraw/excalidraw/pull/8267)

### Build

- Set PWA flag in dev to false [#8788](https://github.com/excalidraw/excalidraw/pull/8788)

- Add a flag VITE_APP_ENABLE_PWA for enabling pwa in dev environment [#8784](https://github.com/excalidraw/excalidraw/pull/8784)

- Upgrade vite to 5.4.x, vitest to 2.x and related vite packages [#8459](https://github.com/excalidraw/excalidraw/pull/8459)

- Add example apps `public` and vite `dev-dist` to eslintignore [#8326](https://github.com/excalidraw/excalidraw/pull/8326)

- Add `rm:build`, `rm:node_modules` & `clean-install` scripts [#8323](https://github.com/excalidraw/excalidraw/pull/8323)

- Update release script to build esm [#8308](https://github.com/excalidraw/excalidraw/pull/8308)

- Run tests on master branch [#8072](https://github.com/excalidraw/excalidraw/pull/8072)

- Specify `packageManager` field [#8010](https://github.com/excalidraw/excalidraw/pull/8010)

- Enable consistent type imports eslint rule [#7992](https://github.com/excalidraw/excalidraw/pull/7992)

- Export types for @excalidraw/utils [#7736](https://github.com/excalidraw/excalidraw/pull/7736)

- Create ESM build for utils package 🥳 [#7500](https://github.com/excalidraw/excalidraw/pull/7500)

- Upgrade to react@19 [#9182](https://github.com/excalidraw/excalidraw/pull/9182)

## 0.17.3 (2024-02-09)

### Fixes

- Keep customData when converting to ExcalidrawElement. [#7656](https://github.com/excalidraw/excalidraw/pull/7656)

- Umd build for browser since it was breaking in v0.17.0 [#7349](https://github.com/excalidraw/excalidraw/pull/7349). Also make sure that when using `Vite`, the `process.env.IS_PREACT` is set as `"true"` (string) and not a boolean.

```
define: {
  "process.env.IS_PREACT": JSON.stringify("true"),
}
```

- Disable caching bounds for arrow labels [#7343](https://github.com/excalidraw/excalidraw/pull/7343)

- Bounds cached prematurely resulting in incorrectly rendered labels [#7339](https://github.com/excalidraw/excalidraw/pull/7339)

## Excalidraw Library

### Fixes

- Disable caching bounds for arrow labels [#7343](https://github.com/excalidraw/excalidraw/pull/7343)

## 0.17.0 (2023-11-14)

### Features

- Added support for disabling `image` tool (also disabling image insertion in general, though keeps support for importing from `.excalidraw` files) [#6320](https://github.com/excalidraw/excalidraw/pull/6320).

  For disabling `image` you need to set 👇

  ```
  UIOptions.tools = {
    image: false
  }
  ```

- Support `excalidrawAPI` prop for accessing the Excalidraw API [#7251](https://github.com/excalidraw/excalidraw/pull/7251).

- Export [`getCommonBounds`](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils#getcommonbounds) helper from the package [#7247](https://github.com/excalidraw/excalidraw/pull/7247).

- Support frames via programmatic API [#7205](https://github.com/excalidraw/excalidraw/pull/7205).

- Export `elementsOverlappingBBox`, `isElementInsideBBox`, `elementPartiallyOverlapsWithOrContainsBBox` helpers for filtering/checking if elements within bounds. [#6727](https://github.com/excalidraw/excalidraw/pull/6727)

- Regenerate ids by default when using transform api and also update bindings by 0.5px to avoid possible overlapping [#7195](https://github.com/excalidraw/excalidraw/pull/7195)

- Add onChange, onPointerDown, onPointerUp api subscribers [#7154](https://github.com/excalidraw/excalidraw/pull/7154).

- Support props.locked for setActiveTool [#7153](https://github.com/excalidraw/excalidraw/pull/7153).

- Add `selected` prop for `MainMenu.Item` and `MainMenu.ItemCustom` components to indicate active state. [#7078](https://github.com/excalidraw/excalidraw/pull/7078)

### Fixes

- Double image dialog on image insertion [#7152](https://github.com/excalidraw/excalidraw/pull/7152).

### Breaking Changes

- The `Ref` support has been removed in v0.17.0 so if you are using refs, please update the integration to use the [`excalidrawAPI`](http://localhost:3003/docs/@excalidraw/excalidraw/api/props/excalidraw-api) [#7251](https://github.com/excalidraw/excalidraw/pull/7251).

- Additionally `ready` and `readyPromise` from the API have been discontinued. These APIs were found to be superfluous, and as part of the effort to streamline the APIs and maintain simplicity, they were removed in version v0.17.0 [#7251](https://github.com/excalidraw/excalidraw/pull/7251).

- [`useDevice`](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils#usedevice) hook's return value was changed to differentiate between `editor` and `viewport` breakpoints. [#7243](https://github.com/excalidraw/excalidraw/pull/7243)

### Build

- Support Preact [#7255](https://github.com/excalidraw/excalidraw/pull/7255). The host needs to set `process.env.IS_PREACT` to `true`

  When using `vite` or any build tools, you will have to make sure the `process` is accessible as we are accessing `process.env.IS_PREACT` to decide whether to use the `preact` build.

  Since `Vite` removes env variables by default, you can update the Vite config to ensure its available :point_down:

  ```
  define: {
    "process.env.IS_PREACT": process.env.IS_PREACT,
  },
  ```

## Excalidraw Library

**_This section lists the updates made to the excalidraw library and will not affect the integration._**

### Features

- Allow D&D dice app domain for embeds [#7263](https://github.com/excalidraw/excalidraw/pull/7263)

- Remove full screen shortcut [#7222](https://github.com/excalidraw/excalidraw/pull/7222)

- Make adaptive-roughness less aggressive [#7250](https://github.com/excalidraw/excalidraw/pull/7250)

- Render frames on export [#7210](https://github.com/excalidraw/excalidraw/pull/7210)

- Support mermaid flowchart and sequence diagrams to excalidraw diagrams 🥳 [#6920](https://github.com/excalidraw/excalidraw/pull/6920)

- Support frames via programmatic API [#7205](https://github.com/excalidraw/excalidraw/pull/7205)

- Make clipboard more robust and reintroduce contextmenu actions [#7198](https://github.com/excalidraw/excalidraw/pull/7198)

- Support giphy.com embed domain [#7192](https://github.com/excalidraw/excalidraw/pull/7192)

- Renderer tweaks [#6698](https://github.com/excalidraw/excalidraw/pull/6698)

- Closing of "Save to.." Dialog on Save To Disk [#7168](https://github.com/excalidraw/excalidraw/pull/7168)

- Added Copy/Paste from Google Docs [#7136](https://github.com/excalidraw/excalidraw/pull/7136)

- Remove bound-arrows from frames [#7157](https://github.com/excalidraw/excalidraw/pull/7157)

- New dark mode theme & light theme tweaks [#7104](https://github.com/excalidraw/excalidraw/pull/7104)

- Better laser cursor for dark mode [#7132](https://github.com/excalidraw/excalidraw/pull/7132)

- Laser pointer improvements [#7128](https://github.com/excalidraw/excalidraw/pull/7128)

- Initial Laser Pointer MVP [#6739](https://github.com/excalidraw/excalidraw/pull/6739)

- Export `iconFillColor()` [#6996](https://github.com/excalidraw/excalidraw/pull/6996)

- Element alignments - snapping [#6256](https://github.com/excalidraw/excalidraw/pull/6256)

### Fixes

- `appState.openDialog` type was changed from `null | string` to `null | { name: string }`. [#7336](https://github.com/excalidraw/excalidraw/pull/7336)

- Image insertion bugs [#7278](https://github.com/excalidraw/excalidraw/pull/7278)

- ExportToSvg to honor frameRendering also for name not only for frame itself [#7270](https://github.com/excalidraw/excalidraw/pull/7270)

- Can't toggle penMode off due to missing typecheck in togglePenMode [#7273](https://github.com/excalidraw/excalidraw/pull/7273)

- Replace hard coded font family with const value in addFrameLabelsAsTextElements [#7269](https://github.com/excalidraw/excalidraw/pull/7269)

- Perf issue when ungrouping elements within frame [#7265](https://github.com/excalidraw/excalidraw/pull/7265)

- Fixes the shortcut collision between "toggleHandTool" and "distributeHorizontally" [#7189](https://github.com/excalidraw/excalidraw/pull/7189)

- Allow pointer events when editing a linear element [#7238](https://github.com/excalidraw/excalidraw/pull/7238)

- Make modal use viewport breakpoints [#7246](https://github.com/excalidraw/excalidraw/pull/7246)

- Align input `:hover`/`:focus` with spec [#7225](https://github.com/excalidraw/excalidraw/pull/7225)

- Dialog remounting on className updates [#7224](https://github.com/excalidraw/excalidraw/pull/7224)

- Don't update label position when dragging labelled arrows [#6891](https://github.com/excalidraw/excalidraw/pull/6891)

- Frame add/remove/z-index ordering changes [#7194](https://github.com/excalidraw/excalidraw/pull/7194)

- Element relative position when dragging multiple elements on grid [#7107](https://github.com/excalidraw/excalidraw/pull/7107)

- Freedraw non-solid bg hitbox not working [#7193](https://github.com/excalidraw/excalidraw/pull/7193)

- Actions panel ux improvement [#6850](https://github.com/excalidraw/excalidraw/pull/6850)

- Better fill rendering with latest RoughJS [#7031](https://github.com/excalidraw/excalidraw/pull/7031)

- Fix for Strange Symbol Appearing on Canvas after Deleting Grouped Graphics (Issue #7116) [#7170](https://github.com/excalidraw/excalidraw/pull/7170)

- Attempt to fix flake in wysiwyg tests [#7173](https://github.com/excalidraw/excalidraw/pull/7173)

- Ensure `ClipboardItem` created in the same tick to fix safari [#7066](https://github.com/excalidraw/excalidraw/pull/7066)

- Wysiwyg left in undefined state on reload [#7123](https://github.com/excalidraw/excalidraw/pull/7123)

- Ensure relative z-index of elements added to frame is retained [#7134](https://github.com/excalidraw/excalidraw/pull/7134)

- Memoize static canvas on `props.renderConfig` [#7131](https://github.com/excalidraw/excalidraw/pull/7131)

- Regression from #6739 preventing redirect link in view mode [#7120](https://github.com/excalidraw/excalidraw/pull/7120)

- Update links to excalidraw-app [#7072](https://github.com/excalidraw/excalidraw/pull/7072)

- Ensure we do not stop laser update prematurely [#7100](https://github.com/excalidraw/excalidraw/pull/7100)

- Remove invisible elements safely [#7083](https://github.com/excalidraw/excalidraw/pull/7083)

- Icon size in manifest [#7073](https://github.com/excalidraw/excalidraw/pull/7073)

- Elements being dropped/duplicated when added to frame [#7057](https://github.com/excalidraw/excalidraw/pull/7057)

- Frame name not editable on dbl-click [#7037](https://github.com/excalidraw/excalidraw/pull/7037)

- Polyfill `Element.replaceChildren` [#7034](https://github.com/excalidraw/excalidraw/pull/7034)

### Refactor

- DRY out tool typing [#7086](https://github.com/excalidraw/excalidraw/pull/7086)

- Refactor event globals to differentiate from `lastPointerUp` [#7084](https://github.com/excalidraw/excalidraw/pull/7084)

- DRY out and simplify setting active tool from toolbar [#7079](https://github.com/excalidraw/excalidraw/pull/7079)

### Performance

- Improve element in frame check [#7124](https://github.com/excalidraw/excalidraw/pull/7124)

---

## 0.16.1 (2023-09-21)

## Excalidraw Library

**_This section lists the updates made to the excalidraw library and will not affect the integration._**

### Fixes

- More eye-droper fixes [#7019](https://github.com/excalidraw/excalidraw/pull/7019)

### Refactor

- Move excalidraw-app outside src [#6987](https://github.com/excalidraw/excalidraw/pull/6987)

---

## 0.16.0 (2023-09-19)

- Support creating containers, linear elements, text containers, labelled arrows and arrow bindings programatically [#6546](https://github.com/excalidraw/excalidraw/pull/6546)
- Introducing Web-Embeds (alias iframe element)[#6691](https://github.com/excalidraw/excalidraw/pull/6691)
- Added [`props.validateEmbeddable`](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props#validateembeddable) to customize embeddable src url validation. [#6691](https://github.com/excalidraw/excalidraw/pull/6691)
- Add support for `opts.fitToViewport` and `opts.viewportZoomFactor` in the [`ExcalidrawAPI.scrollToContent`](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api#scrolltocontent) API. [#6581](https://github.com/excalidraw/excalidraw/pull/6581).
- Properly sanitize element `link` urls. [#6728](https://github.com/excalidraw/excalidraw/pull/6728).
- Sidebar component now supports tabs — for more detailed description of new behavior and breaking changes, see the linked PR. [#6213](https://github.com/excalidraw/excalidraw/pull/6213)
- Exposed `DefaultSidebar` component to allow modifying the default sidebar, such as adding custom tabs to it. [#6213](https://github.com/excalidraw/excalidraw/pull/6213)

  #### BREAKING CHANGES

  - `props.renderSidebar` is removed in favor of rendering as `children`.
  - `appState.isSidebarDocked` replaced with `appState.defaultSidebarDockedPreference` with slightly different semantics, and relating only to the default sidebar. You need to handle `docked` state for your custom sidebars yourself.
  - Sidebar `props.dockable` is removed. To indicate dockability, supply `props.onDock()` alongside setting `props.docked`.
  - `Sidebar.Header` is no longer rendered by default. You need to render it yourself.
  - `props.onClose` replaced with `props.onStateChange`.
  - `restore()`/`restoreAppState()` now retains `appState.openSidebar` regardless of docked state.

## Excalidraw Library

**_This section lists the updates made to the excalidraw library and will not affect the integration._**

### Features

- allow `avif`, `jfif`, `webp`, `bmp`, `ico` image types [#6500](https://github.com/excalidraw/excalidraw/pull/6500)
- Zen-mode/go-to-plus button style tweaks [#7006](https://github.com/excalidraw/excalidraw/pull/7006)

- Holding down CMD/CTRL will disable snap to grid when grid is active [#6983](https://github.com/excalidraw/excalidraw/pull/6983)

- Update logo [#6979](https://github.com/excalidraw/excalidraw/pull/6979)

- Export `changeProperty()` and `getFormValue()`. [#6957](https://github.com/excalidraw/excalidraw/pull/6957)

- Partition main canvas vertically [#6759](https://github.com/excalidraw/excalidraw/pull/6759)

- Support creating containers, linear elements, text containers, labelled arrows and arrow bindings programatically [#6546](https://github.com/excalidraw/excalidraw/pull/6546)

- Add support for simplePDF in Web-Embeds [#6810](https://github.com/excalidraw/excalidraw/pull/6810)

- Add support for val.town embeds [#6821](https://github.com/excalidraw/excalidraw/pull/6821)

- Render bold lines in grid [#6779](https://github.com/excalidraw/excalidraw/pull/6779)

- Adds support for stackblitz.com embeds [#6813](https://github.com/excalidraw/excalidraw/pull/6813)

- Cache most of element selection [#6747](https://github.com/excalidraw/excalidraw/pull/6747)

- Support customizing what parts of frames are rendered [#6752](https://github.com/excalidraw/excalidraw/pull/6752)

- Make `appState.selectedElementIds` more stable [#6745](https://github.com/excalidraw/excalidraw/pull/6745)

- Overwrite confirmation dialogs [#6658](https://github.com/excalidraw/excalidraw/pull/6658)

- Simple analitycs [#6683](https://github.com/excalidraw/excalidraw/pull/6683)

- Introduce frames [#6123](https://github.com/excalidraw/excalidraw/pull/6123)

- Add canvas-roundrect-polyfill package [#6675](https://github.com/excalidraw/excalidraw/pull/6675)

- Polyfill `CanvasRenderingContext2D.roundRect` [#6673](https://github.com/excalidraw/excalidraw/pull/6673)

- Disable collab feature when running in iframe [#6646](https://github.com/excalidraw/excalidraw/pull/6646)

- Assign random user name when not set [#6663](https://github.com/excalidraw/excalidraw/pull/6663)

- Redesigned collab cursors [#6659](https://github.com/excalidraw/excalidraw/pull/6659)

- Eye dropper [#6615](https://github.com/excalidraw/excalidraw/pull/6615)

- Redesign of Live Collaboration dialog [#6635](https://github.com/excalidraw/excalidraw/pull/6635)

- Recover scrolled position after Library re-opening [#6624](https://github.com/excalidraw/excalidraw/pull/6624)

- Clearing library cache [#6621](https://github.com/excalidraw/excalidraw/pull/6621)

- Update design of ImageExportDialog [#6614](https://github.com/excalidraw/excalidraw/pull/6614)

- Add flipping for multiple elements [#5578](https://github.com/excalidraw/excalidraw/pull/5578)

- Color picker redesign [#6216](https://github.com/excalidraw/excalidraw/pull/6216)

- Add "unlock all elements" to canvas contextMenu [#5894](https://github.com/excalidraw/excalidraw/pull/5894)

- Library sidebar design tweaks [#6582](https://github.com/excalidraw/excalidraw/pull/6582)

- Add Trans component for interpolating JSX in translations [#6534](https://github.com/excalidraw/excalidraw/pull/6534)

- Testing simple analytics and fathom analytics for better privacy of the users [#6529](https://github.com/excalidraw/excalidraw/pull/6529)

- Retain `seed` on shift-paste [#6509](https://github.com/excalidraw/excalidraw/pull/6509)

- Allow `avif`, `jfif`, `webp`, `bmp`, `ico` image types (#6500

### Fixes

- Improperly disabling UI pointer-events on canvas interaction [#7005](https://github.com/excalidraw/excalidraw/pull/7005)

- Several eyeDropper fixes [#7002](https://github.com/excalidraw/excalidraw/pull/7002)

- IsBindableElement to affirm frames [#6900](https://github.com/excalidraw/excalidraw/pull/6900)

- Use `device.isMobile` for sidebar trigger label breakpoint [#6994](https://github.com/excalidraw/excalidraw/pull/6994)

- Export to plus url [#6980](https://github.com/excalidraw/excalidraw/pull/6980)

- Z-index inconsistencies during addition / deletion in frames [#6914](https://github.com/excalidraw/excalidraw/pull/6914)

- Update size-limit so react is not installed as dependency [#6964](https://github.com/excalidraw/excalidraw/pull/6964)

- Stale labeled arrow bounds cache after editing the label [#6893](https://github.com/excalidraw/excalidraw/pull/6893)

- Canvas flickering due to resetting canvas on skipped frames [#6960](https://github.com/excalidraw/excalidraw/pull/6960)

- Grid jittery after partition PR [#6935](https://github.com/excalidraw/excalidraw/pull/6935)

- Regression in indexing when adding elements to frame [#6904](https://github.com/excalidraw/excalidraw/pull/6904)

- Stabilize `selectedElementIds` when box selecting [#6912](https://github.com/excalidraw/excalidraw/pull/6912)

- Resetting deleted elements on duplication [#6906](https://github.com/excalidraw/excalidraw/pull/6906)

- Make canvas compos memoize appState on props they declare [#6897](https://github.com/excalidraw/excalidraw/pull/6897)

- Scope `--color-selection` retrieval to given instance [#6886](https://github.com/excalidraw/excalidraw/pull/6886)

- Webpack config exclude statement to system agnostic [#6857](https://github.com/excalidraw/excalidraw/pull/6857)

- Remove `embeddable` from generic elements [#6853](https://github.com/excalidraw/excalidraw/pull/6853)

- Resizing arrow labels [#6789](https://github.com/excalidraw/excalidraw/pull/6789)

- Eye-dropper not working with app offset correctly on non-1 dPR [#6835](https://github.com/excalidraw/excalidraw/pull/6835)

- Add self destroying service-worker.js to migrate everyone from CRA to Vite [#6833](https://github.com/excalidraw/excalidraw/pull/6833)

- Forgotten REACT_APP env variables [#6834](https://github.com/excalidraw/excalidraw/pull/6834)

- Refresh sw when browser refreshed [#6824](https://github.com/excalidraw/excalidraw/pull/6824)

- Adding to selection via shift box-select [#6815](https://github.com/excalidraw/excalidraw/pull/6815)

- Prevent binding focus NaN value [#6803](https://github.com/excalidraw/excalidraw/pull/6803)

- Use pull request in semantic workflow for better security [#6799](https://github.com/excalidraw/excalidraw/pull/6799)

- Don't show `canvasBackground` label when `UIOptions.canvasActions.changeViewBackgroundColor` is false [#6781](https://github.com/excalidraw/excalidraw/pull/6781)

- Use subdirectory for @excalidraw/excalidraw size limit [#6787](https://github.com/excalidraw/excalidraw/pull/6787)

- Use actual dock state to not close docked library on insert [#6766](https://github.com/excalidraw/excalidraw/pull/6766)

- UI disappears when pressing the eyedropper shortcut on mobile [#6725](https://github.com/excalidraw/excalidraw/pull/6725)

- Elements in non-existing frame getting removed [#6708](https://github.com/excalidraw/excalidraw/pull/6708)

- Scrollbars renders but disable [#6706](https://github.com/excalidraw/excalidraw/pull/6706)

- Typo in chart.ts [#6696](https://github.com/excalidraw/excalidraw/pull/6696)

- Do not bind text to container using text tool when it has text already [#6694](https://github.com/excalidraw/excalidraw/pull/6694)

- Don't allow binding text to images [#6693](https://github.com/excalidraw/excalidraw/pull/6693)

- Updated link for documentation page under help section [#6654](https://github.com/excalidraw/excalidraw/pull/6654)

- Collab username style fixes [#6668](https://github.com/excalidraw/excalidraw/pull/6668)

- Bound arrows not updated when rotating multiple elements [#6662](https://github.com/excalidraw/excalidraw/pull/6662)

- Delete setCursor when resize [#6660](https://github.com/excalidraw/excalidraw/pull/6660)

- Creating text while color picker open [#6651](https://github.com/excalidraw/excalidraw/pull/6651)

- Cleanup textWysiwyg and getAdjustedDimensions [#6520](https://github.com/excalidraw/excalidraw/pull/6520)

- Eye dropper not accounting for offsets [#6640](https://github.com/excalidraw/excalidraw/pull/6640)

- Color picker input closing problem [#6599](https://github.com/excalidraw/excalidraw/pull/6599)

- Export dialog shortcut toggles console on firefox [#6620](https://github.com/excalidraw/excalidraw/pull/6620)

- Add react v17 `useTransition` polyfill [#6618](https://github.com/excalidraw/excalidraw/pull/6618)

- Library dropdown visibility issue for mobile [#6613](https://github.com/excalidraw/excalidraw/pull/6613)

- `withInternalFallback` leaking state in multi-instance scenarios [#6602](https://github.com/excalidraw/excalidraw/pull/6602)

- Language list containing duplicate `en` lang [#6583](https://github.com/excalidraw/excalidraw/pull/6583)

- Garbled text displayed on avatars [#6575](https://github.com/excalidraw/excalidraw/pull/6575)

- Assign the original text to text editor only during init [#6580](https://github.com/excalidraw/excalidraw/pull/6580)

- I18n: Apply Trans component to publish library dialogue [#6564](https://github.com/excalidraw/excalidraw/pull/6564)

- Fix brave error i18n string and remove unused [#6561](https://github.com/excalidraw/excalidraw/pull/6561)

- Revert add version tags to Docker build [#6540](https://github.com/excalidraw/excalidraw/pull/6540)

- Don't refresh dimensions for text containers on font load [#6523](https://github.com/excalidraw/excalidraw/pull/6523)

- Cleanup getMaxContainerHeight and getMaxContainerWidth [#6519](https://github.com/excalidraw/excalidraw/pull/6519)

- Cleanup redrawTextBoundingBox [#6518](https://github.com/excalidraw/excalidraw/pull/6518)

- Text jumps when editing on Android Chrome [#6503](https://github.com/excalidraw/excalidraw/pull/6503)

### Styles

- Removes extra spaces [#6558](https://github.com/excalidraw/excalidraw/pull/6558)

- Fix font family inconsistencies [#6501](https://github.com/excalidraw/excalidraw/pull/6501)

### Refactor

- Factor out shape generation from `renderElement.ts` pt 2 [#6878](https://github.com/excalidraw/excalidraw/pull/6878)

- Add typeScript support to enforce valid translation keys [#6776](https://github.com/excalidraw/excalidraw/pull/6776)

- Simplify `ImageExportDialog` [#6578](https://github.com/excalidraw/excalidraw/pull/6578)

### Performance

- Limiting the suggested binding to fix performance issue [#6877](https://github.com/excalidraw/excalidraw/pull/6877)

- Memoize rendering of library [#6622](https://github.com/excalidraw/excalidraw/pull/6622)

- Improve rendering performance for Library [#6587](https://github.com/excalidraw/excalidraw/pull/6587)

- Use `UIAppState` where possible to reduce UI rerenders [#6560](https://github.com/excalidraw/excalidraw/pull/6560)

### Build

- Increase limit for bundle by 1kb [#6880](https://github.com/excalidraw/excalidraw/pull/6880)

- Update to node 18 in docker [#6822](https://github.com/excalidraw/excalidraw/pull/6822)

- Migrate to Vite 🚀 [#6818](https://github.com/excalidraw/excalidraw/pull/6818)

- Migrate to Vite 🚀 [#6713](https://github.com/excalidraw/excalidraw/pull/6713)

- Increase limit to 290 kB for prod bundle [#6809](https://github.com/excalidraw/excalidraw/pull/6809)

- Add version tags to Docker build [#6508](https://github.com/excalidraw/excalidraw/pull/6508)

---

## 0.15.2 (2023-04-20)

### Docs

- Fix docs link in readme [#6486](https://github.com/excalidraw/excalidraw/pull/6486)

## Excalidraw Library

**_This section lists the updates made to the excalidraw library and will not affect the integration._**

### Fixes

- Rotate the text element when binding to a rotated container [#6477](https://github.com/excalidraw/excalidraw/pull/6477)

- Support breaking words containing hyphen - [#6014](https://github.com/excalidraw/excalidraw/pull/6014)

- Incorrect background fill button active state [#6491](https://github.com/excalidraw/excalidraw/pull/6491)

---

## 0.15.1 (2023-04-18)

### Docs

- Add the readme back to the package which was mistakenly removed [#6484](https://github.com/excalidraw/excalidraw/pull/6484)

## Excalidraw Library

**_This section lists the updates made to the excalidraw library and will not affect the integration._**

---

## 0.15.0 (2023-04-18)

### Features

- [`ExcalidrawAPI.scrollToContent`](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props/excalidraw-api#scrolltocontent) has new opts object allowing you to fit viewport to content, and animate the scrolling. [#6319](https://github.com/excalidraw/excalidraw/pull/6319)

- Expose `useI18n()` hook return an object containing `t()` i18n helper and current `langCode`. You can use this in components you render as `<Excalidraw>` children to render any of our i18n locale strings. [#6224](https://github.com/excalidraw/excalidraw/pull/6224)

- [`restoreElements`](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/restore#restoreelements) API now takes an optional parameter `opts` which currently supports the below attributes

```js
{ refreshDimensions?: boolean, repairBindings?: boolean }
```

The same `opts` param has been added to [`restore`](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/restore#restore) API as well.

For more details refer to the [docs](https://docs.excalidraw.com)

#### BREAKING CHANGE

- The optional parameter `refreshDimensions` in [`restoreElements`](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/utils/restore#restoreelements) has been removed and can be enabled via `opts`

### Fixes

- Exporting labelled arrows via export utils [#6443](https://github.com/excalidraw/excalidraw/pull/6443)

## Excalidraw Library

**_This section lists the updates made to the excalidraw library and will not affect the integration._**

### Features

- Constrain export dialog preview size [#6475](https://github.com/excalidraw/excalidraw/pull/6475)

- Zigzag fill easter egg [#6439](https://github.com/excalidraw/excalidraw/pull/6439)

- Add container to multiple text elements [#6428](https://github.com/excalidraw/excalidraw/pull/6428)

- Starting migration from GA to Matomo for better privacy [#6398](https://github.com/excalidraw/excalidraw/pull/6398)

- Add line height attribute to text element [#6360](https://github.com/excalidraw/excalidraw/pull/6360)

- Add thai lang support [#6314](https://github.com/excalidraw/excalidraw/pull/6314)

- Create bound container from text [#6301](https://github.com/excalidraw/excalidraw/pull/6301)

- Improve text measurements in bound containers [#6187](https://github.com/excalidraw/excalidraw/pull/6187)

- Bind text to container if double clicked on filled shape or stroke [#6250](https://github.com/excalidraw/excalidraw/pull/6250)

- Make repair and refreshDimensions configurable in restoreElements [#6238](https://github.com/excalidraw/excalidraw/pull/6238)

- Show error message when not connected to internet while collabo… [#6165](https://github.com/excalidraw/excalidraw/pull/6165)

- Shortcut for clearCanvas confirmDialog [#6114](https://github.com/excalidraw/excalidraw/pull/6114)

- Disable canvas smoothing (antialiasing) for right-angled elements [#6186](https://github.com/excalidraw/excalidraw/pull/6186)Co-authored-by: Ignacio Cuadra <67276174+ignacio-cuadra@users.noreply.github.com>

### Fixes

- Center align text when wrapped in container via context menu [#6480](https://github.com/excalidraw/excalidraw/pull/6480)

- Restore original container height when unbinding text which was binded via context menu [#6444](https://github.com/excalidraw/excalidraw/pull/6444)

- Mark more props as optional for element [#6448](https://github.com/excalidraw/excalidraw/pull/6448)

- Improperly cache-busting on canvas scale instead of zoom [#6473](https://github.com/excalidraw/excalidraw/pull/6473)

- Incorrectly duplicating items on paste/library insert [#6467](https://github.com/excalidraw/excalidraw/pull/6467)

- Library ids cross-contamination on multiple insert [#6466](https://github.com/excalidraw/excalidraw/pull/6466)

- Color picker keyboard handling not working [#6464](https://github.com/excalidraw/excalidraw/pull/6464)

- Abort freedraw line if second touch is detected [#6440](https://github.com/excalidraw/excalidraw/pull/6440)

- Utils leaking Scene state [#6461](https://github.com/excalidraw/excalidraw/pull/6461)

- Split "Edit selected shape" shortcut [#6457](https://github.com/excalidraw/excalidraw/pull/6457)

- Center align text when bind to container via context menu [#6451](https://github.com/excalidraw/excalidraw/pull/6451)

- Update coords when text unbinded from its container [#6445](https://github.com/excalidraw/excalidraw/pull/6445)

- Autoredirect to plus in prod only [#6446](https://github.com/excalidraw/excalidraw/pull/6446)

- Fixing popover overflow on small screen [#6433](https://github.com/excalidraw/excalidraw/pull/6433)

- Introduce baseline to fix the layout shift when switching to text editor [#6397](https://github.com/excalidraw/excalidraw/pull/6397)

- Don't refresh dimensions for deleted text elements [#6438](https://github.com/excalidraw/excalidraw/pull/6438)

- Element vanishes when zoomed in [#6417](https://github.com/excalidraw/excalidraw/pull/6417)

- Don't jump text to end when out of viewport in safari [#6416](https://github.com/excalidraw/excalidraw/pull/6416)

- GetDefaultLineHeight should return default font family line height for unknown font [#6399](https://github.com/excalidraw/excalidraw/pull/6399)

- Revert use `ideographic` textBaseline to improve layout shift when editing text" [#6400](https://github.com/excalidraw/excalidraw/pull/6400)

- Call stack size exceeded when paste large text [#6373](https://github.com/excalidraw/excalidraw/pull/6373) (#6396)

- Use `ideographic` textBaseline to improve layout shift when editing text [#6384](https://github.com/excalidraw/excalidraw/pull/6384)

- Chrome crashing when embedding scene on chrome arm [#6383](https://github.com/excalidraw/excalidraw/pull/6383)

- Division by zero in findFocusPointForEllipse leads to infinite loop in wrapText freezing Excalidraw [#6377](https://github.com/excalidraw/excalidraw/pull/6377)

- Containerizing text incorrectly updates arrow bindings [#6369](https://github.com/excalidraw/excalidraw/pull/6369)

- Ensure export preview is centered [#6337](https://github.com/excalidraw/excalidraw/pull/6337)

- Hide text align for labelled arrows [#6339](https://github.com/excalidraw/excalidraw/pull/6339)

- Refresh dimensions when elements loaded from shareable link and blob [#6333](https://github.com/excalidraw/excalidraw/pull/6333)

- Show error message when measureText API breaks in brave [#6336](https://github.com/excalidraw/excalidraw/pull/6336)

- Add an offset of 0.5px for text editor in containers [#6328](https://github.com/excalidraw/excalidraw/pull/6328)

- Move utility types out of `.d.ts` file to fix exported declaration files [#6315](https://github.com/excalidraw/excalidraw/pull/6315)

- More jotai scopes missing [#6313](https://github.com/excalidraw/excalidraw/pull/6313)

- Provide HelpButton title prop [#6209](https://github.com/excalidraw/excalidraw/pull/6209)

- Respect text align when wrapping in a container [#6310](https://github.com/excalidraw/excalidraw/pull/6310)

- Compute bounding box correctly for text element when multiple element resizing [#6307](https://github.com/excalidraw/excalidraw/pull/6307)

- Use jotai scope for editor-specific atoms [#6308](https://github.com/excalidraw/excalidraw/pull/6308)

- Consider arrow for bound text element [#6297](https://github.com/excalidraw/excalidraw/pull/6297)

- Text never goes beyond max width for unbound text elements [#6288](https://github.com/excalidraw/excalidraw/pull/6288)

- Svg text baseline [#6285](https://github.com/excalidraw/excalidraw/pull/6273)

- Compute container height from bound text correctly [#6273](https://github.com/excalidraw/excalidraw/pull/6273)

- Fit mobile toolbar and make scrollable [#6270](https://github.com/excalidraw/excalidraw/pull/6270)

- Indenting via `tab` clashing with IME compositor [#6258](https://github.com/excalidraw/excalidraw/pull/6258)

- Improve text wrapping inside rhombus and more fixes [#6265](https://github.com/excalidraw/excalidraw/pull/6265)

- Improve text wrapping in ellipse and alignment [#6172](https://github.com/excalidraw/excalidraw/pull/6172)

- Don't allow blank space in collab name [#6211](https://github.com/excalidraw/excalidraw/pull/6211)

- Docker build architecture:linux/amd64 error occur on linux/arm64 instance [#6197](https://github.com/excalidraw/excalidraw/pull/6197)

- Sort bound text elements to fix text duplication z-index error [#5130](https://github.com/excalidraw/excalidraw/pull/5130)

- Hide welcome screen on mobile once user interacts [#6185](https://github.com/excalidraw/excalidraw/pull/6185)

- Edit link in docs [#6182](https://github.com/excalidraw/excalidraw/pull/6182)

### Refactor

- Inline `SingleLibraryItem` into `PublishLibrary` [#6462](https://github.com/excalidraw/excalidraw/pull/6462)

- Make the example React app reusable without duplication [#6188](https://github.com/excalidraw/excalidraw/pull/6188)

### Performance

- Break early if the line width <= max width of the container [#6347](https://github.com/excalidraw/excalidraw/pull/6347)

### Build

- Move TS and types to devDependencies [#6346](https://github.com/excalidraw/excalidraw/pull/6346)

---

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
