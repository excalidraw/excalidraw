# Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| [`onChange`](#onChange) | Function |  | This callback is triggered whenever the component updates due to any change. This callback will receive the excalidraw elements and the current app state. |
| [`initialData`](#initialData) | <code>{elements?: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L106">ExcalidrawElement[]</a>, appState?: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L79">AppState</a> } </code> | null | The initial data with which app loads. |
| [`ref`](#ref) | [`createRef`](https://reactjs.org/docs/refs-and-the-dom.html#creating-refs) &#124; [`useRef`](https://reactjs.org/docs/hooks-reference.html#useref) &#124; [`callbackRef`](https://reactjs.org/docs/refs-and-the-dom.html#callback-refs) &#124; <code>{ current: { readyPromise: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/utils.ts#L317">resolvablePromise</a> } }</code> |  | Ref to be passed to Excalidraw |
| [`onCollabButtonClick`](#onCollabButtonClick) | Function |  | Callback to be triggered when the collab button is clicked |
| [`isCollaborating`](#isCollaborating) | `boolean` |  | This implies if the app is in collaboration mode |
| [`onPointerUpdate`](#onPointerUpdate) | Function |  | Callback triggered when mouse pointer is updated. |
| [`langCode`](#langCode) | string | `en` | Language code string |
| [`renderTopRightUI`](#renderTopRightUI) | Function |  | Function that renders custom UI in top right corner |
| [`renderCustomStats`](#renderCustomStats) | Function |  | Function that can be used to render custom stats on the stats dialog. |
| [`renderSIdebar`](#renderSIdebar) | Function |  | Render function that renders custom sidebar. |
| [`viewModeEnabled`](#viewModeEnabled) | boolean |  | This implies if the app is in view mode. |
| [`zenModeEnabled`](#zenModeEnabled) | boolean |  | This implies if the zen mode is enabled |
| [`gridModeEnabled`](#gridModeEnabled) | boolean |  | This implies if the grid mode is enabled |
| [`libraryReturnUrl`](#libraryReturnUrl) | string |  | What URL should [libraries.excalidraw.com](https://libraries.excalidraw.com) be installed to |
| [`theme`](#theme) | [THEME.LIGHT](#THEME-1) &#124; [THEME.DARK](#THEME-1) | [THEME.LIGHT](#THEME-1) | The theme of the Excalidraw component |
| [`name`](#name) | string |  | Name of the drawing |
| [`UIOptions`](#UIOptions) | <code>{ canvasActions: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L208"> CanvasActions</a> }</code> | [DEFAULT UI OPTIONS](https://github.com/excalidraw/excalidraw/blob/master/src/constants.ts#L129) | To customise UI options. Currently we support customising [`canvas actions`](#canvasActions) |
| [`onPaste`](#onPaste) | <code>(data: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/clipboard.ts#L21">ClipboardData</a>, event: ClipboardEvent &#124; null) => boolean</code> |  | Callback to be triggered if passed when the something is pasted in to the scene |
| [`detectScroll`](#detectScroll) | boolean | true | Indicates whether to update the offsets when nearest ancestor is scrolled. |
| [`handleKeyboardGlobally`](#handleKeyboardGlobally) | boolean | false | Indicates whether to bind the keyboard events to document. |
| [`onLibraryChange`](#onLibraryChange) | <code>(items: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L200">LibraryItems</a>) => void &#124; Promise&lt;any&gt; </code> |  | The callback if supplied is triggered when the library is updated and receives the library items. |
| [`autoFocus`](#autoFocus) | boolean | false | Implies whether to focus the Excalidraw component on page load |
| [`generateIdForFile`](#generateIdForFile) | `tsx(file: File) => string \| Promise<string>` |  | Allows you to override `id` generation for files added on canvas |
| [`onPointerDown`](#onPointerDown) | <code>(activeTool: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L93"> AppState["activeTool"]</a>, pointerDownState: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L365">PointerDownState</a>) => void</code> |  | This prop if passed gets triggered on pointer down evenets |
| [`onScrollChange`](#onScrollChange) | <code>(scrollX: number, scrollY: number)</code> |  | This prop if passed gets triggered when scrolling the canvas. |

### onChange

Every time component updates, this callback if passed will get triggered and has the below signature.

```js
(excalidrawElements, appState, files) => void;
```

1.`excalidrawElements`: Array of [excalidrawElements](https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L106) in the scene.

2.`appState`: [AppState](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L79) of the scene.

3. `files`: The [`BinaryFiles`]([BinaryFiles](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L64) which are added to the scene.

Here you can try saving the data to your backend or local storage for example.

### initialData

This helps to load Excalidraw with `initialData`. It must be an object or a [promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise) which resolves to an object containing the below optional fields.

| Name | Type | Description |
| --- | --- | --- |
| `elements` | [ExcalidrawElement[]](https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L106) | The elements with which Excalidraw should be mounted. |
| `appState` | [AppState](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L79) | The App state with which Excalidraw should be mounted. |
| `scrollToContent` | boolean | This attribute implies whether to scroll to the nearest element to center once Excalidraw is mounted. By default, it will not scroll the nearest element to the center. Make sure you pass `initialData.appState.scrollX` and `initialData.appState.scrollY` when `scrollToContent` is false so that scroll positions are retained |
| `libraryItems` | [LibraryItems](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L200) &#124; Promise&lt;[LibraryItems](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L200)&gt; | This library items with which Excalidraw should be mounted. |
| `files` | [BinaryFiles](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L64) | The files added to the scene. |

```json
{
  "elements": [
    {
      "type": "rectangle",
      "version": 141,
      "versionNonce": 361174001,
      "isDeleted": false,
      "id": "oDVXy8D6rom3H1-LLH2-f",
      "fillStyle": "hachure",
      "strokeWidth": 1,
      "strokeStyle": "solid",
      "roughness": 1,
      "opacity": 100,
      "angle": 0,
      "x": 100.50390625,
      "y": 93.67578125,
      "strokeColor": "#000000",
      "backgroundColor": "transparent",
      "width": 186.47265625,
      "height": 141.9765625,
      "seed": 1968410350,
      "groupIds": []
    }
  ],
  "appState": { "zenModeEnabled": true, "viewBackgroundColor": "#AFEEEE" }
}
```

You might want to use this when you want to load excalidraw with some initial elements and app state.

### Storing custom data on Excalidraw elements

Beyond attributes that Excalidraw elements already support, you can store custom data on each element in a `customData` object. The type of the attribute is [`Record<string, any>`](https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L59) and is optional.

You can use this to add any extra information you need to keep track of.

You can add `customData` to elements when passing them as `initialData`, or using [`updateScene`](#updateScene)/[`updateLibrary`](#updateLibrary) afterwards.

### `ref`

You can pass a `ref` when you want to access some excalidraw APIs. We expose the below APIs:

| API | Signature | Usage |
| --- | --- | --- |
| ready | `boolean` | This is set to true once Excalidraw is rendered |
| readyPromise | [resolvablePromise](https://github.com/excalidraw/excalidraw/blob/master/src/utils.ts#L317) | This promise will be resolved with the api once excalidraw has rendered. This will be helpful when you want do some action on the host app once this promise resolves. For this to work you will have to pass ref as shown [here](#readyPromise) |
| [updateScene](#updateScene) | <code>(scene: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L207">sceneData</a>) => void </code> | updates the scene with the sceneData |
| [updateLibrary](#updateLibrary) | <code>(<a href="https://github.com/excalidraw/excalidraw/blob/master/src/data/library.ts#L136">opts</a>) => Promise<<a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L200">LibraryItems</a>> </code> | updates the scene with the sceneData |
| [addFiles](#addFiles) | <code>(files: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts">BinaryFileData</a>) => void </code> | add files data to the appState |
| resetScene | `({ resetLoadingState: boolean }) => void` | Resets the scene. If `resetLoadingState` is passed as true then it will also force set the loading state to false. |
| getSceneElementsIncludingDeleted | <code> () => <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L106">ExcalidrawElement[]</a></code> | Returns all the elements including the deleted in the scene |
| getSceneElements | <code> () => <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L106">ExcalidrawElement[]</a></code> | Returns all the elements excluding the deleted in the scene |
| getAppState | <code> () => <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L66">AppState</a></code> | Returns current appState |
| history | `{ clear: () => void }` | This is the history API. `history.clear()` will clear the history |
| scrollToContent | <code> (target?: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L106">ExcalidrawElement</a> &#124; <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L106">ExcalidrawElement</a>[]) => void </code> | Scroll the nearest element out of the elements supplied to the center. Defaults to the elements on the scene. |
| refresh | `() => void` | Updates the offsets for the Excalidraw component so that the coordinates are computed correctly (for example the cursor position). You don't have to call this when the position is changed on page scroll or when the excalidraw container resizes (we handle that ourselves). For any other cases if the position of excalidraw is updated (example due to scroll on parent container and not page scroll) you should call this API. |
| [importLibrary](#importlibrary) | <code>(url: string, token?: string) => void</code> | Imports library from given URL |
| [setToast](#setToast) | <code>({ message: string, closable?:boolean, duration?:number } &#124; null) => void</code> | This API can be used to show the toast with custom message. |
| [id](#id) | string | Unique ID for the excalidraw component. |
| [getFiles](#getFiles) | <code>() => <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L64">files</a> </code> | This API can be used to get the files present in the scene. It may contain files that aren't referenced by any element, so if you're persisting the files to a storage, you should compare them against stored elements. |
| [setActiveTool](#setActiveTool) | <code>(tool: { type: typeof <a href="https://github.com/excalidraw/excalidraw/blob/master/src/shapes.tsx#L4">SHAPES</a> [number]["value"]&#124; "eraser" } &#124; { type: "custom"; customType: string }) => void</code> | This API can be used to set the active tool |
| [setCursor](#setCursor) | <code>(cursor: string) => void </code> | This API can be used to set customise the mouse cursor on the canvas |
| [resetCursor](#resetCursor) | <code>() => void </code> | This API can be used to reset to default mouse cursor on the canvas |
| [toggleMenu](#toggleMenu) | <code>(type: string, force?: boolean) => boolean</code> | Toggles specific menus on/off |

### `readyPromise`

```tsx
const excalidrawRef = {
  current: {
    readyPromise: (
      <a href="https://github.com/excalidraw/excalidraw/blob/master/src/utils.ts#L317">
        resolvablePromise
      </a>
    ),
  },
};
```

Since plain object is passed as a `ref`, the `readyPromise` is resolved as soon as the component is mounted. Most of the time you will not need this unless you have a specific use case where you can't pass the `ref` in the react way and want to do some action on the host when this promise resolves. You can check the [example](https://codesandbox.io/s/eexcalidraw-resolvable-promise-d0qg3?file=/src/App.js) for the usage.

### `updateScene`

```tsx
(scene: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L207">sceneData</a>) => void
```

You can use this function to update the scene with the sceneData. It accepts the below attributes.

| Name | Type | Description |
| --- | --- | --- |
| `elements` | [`ImportedDataState["elements"]`](https://github.com/excalidraw/excalidraw/blob/master/src/data/types.ts#L17) | The `elements` to be updated in the scene |
| `appState` | [`ImportedDataState["appState"]`](https://github.com/excalidraw/excalidraw/blob/master/src/data/types.ts#L18) | The `appState` to be updated in the scene. |
| `collaborators` | `tsx Map<string, <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L35">Collaborator></a>` | The list of collaborators to be updated in the scene. |
| `commitToHistory` | `boolean` | Implies if the `history (undo/redo)` should be recorded. Defaults to `false`. |
| `libraryItems` | [LibraryItems](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L200) &#124; Promise&lt;[LibraryItems](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L200)&gt; &#124; ((currentItems: [LibraryItems](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L200)>) => [LibraryItems](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L200) &#124; Promise&lt;[LibraryItems](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L200)&gt;) | The `libraryItems` to be update in the scene. |

### `updateLibrary`

<pre>
(opts: &#123;
  libraryItems: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L224">LibraryItemsSource</a>;
  merge?: boolean;
  prompt?: boolean;
  openLibraryMenu?: boolean;
  defaultStatus?: "unpublished" | "published";
&#125;) => Promise&lt;<a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L200">LibraryItems</a>&gt;
</pre>

You can use this function to update the library. It accepts the below attributes.

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `libraryItems` |  | [LibraryItems](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L224) | The `libraryItems` to be replaced/merged with current library |
| `merge` | boolean | `false` | Whether to merge with existing library items. |
| `prompt` | boolean | `false` | Whether to prompt user for confirmation. |
| `openLibraryMenu` | boolean | `false` | Whether to open the library menu before importing. |
| `defaultStatus` | <code>"unpublished" &#124; "published"</code> | `"unpublished"` | Default library item's `status` if not present. |

### `addFiles`

```tsx
(files: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts">BinaryFileData</a>) => void
```

Adds supplied files data to the `appState.files` cache on top of existing files present in the cache.

### `onCollabButtonClick`

This callback is triggered when clicked on the collab button in excalidraw. If not supplied, the collab dialog button is not rendered.

### `isCollaborating`

This prop indicates if the app is in collaboration mode.

### `onPointerUpdate`

This callback is triggered when mouse pointer is updated.

```js
({ x, y }, button, pointersMap}) => void;
```

1.`{x, y}`: Pointer coordinates

2.`button`: The position of the button. This will be one of `["down", "up"]`

3.`pointersMap`: [`pointers map`](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L131) of the scene

```js
(exportedElements, appState, canvas) => void
```

1. `exportedElements`: An array of [non deleted elements](https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L87) which needs to be exported.
2. `appState`: [AppState](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L79) of the scene.
3. `canvas`: The `HTMLCanvasElement` of the scene.

### `langCode`

Determines the language of the UI. It should be one of the [available language codes](https://github.com/excalidraw/excalidraw/blob/master/src/i18n.ts#L14). Defaults to `en` (English). We also export default language and supported languages which you can import as shown below.

```js
import { defaultLang, languages } from "@excalidraw/excalidraw";
```

| name | type |
| --- | --- |
| defaultLang | string |
| languages | [Language[]](https://github.com/excalidraw/excalidraw/blob/master/src/i18n.ts#L8) |

### `renderTopRightUI`

```tsx
(isMobile: boolean, appState: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L79">AppState</a>) => JSX | null
```

A function returning JSX to render custom UI in the top right corner of the app.

#### `renderCustomStats`

A function that can be used to render custom stats (returns JSX) in the nerd stats dialog. For example you can use this prop to render the size of the elements in the storage.

#### `renderSidebar`

```tsx
() => JSX | null;
```

Optional function that can render custom sidebar. This sidebar is the same that the library menu sidebar is using, and can be used for any purposes your app needs. The render function should return a `<Sidebar>` instance — a component that is exported from the Excalidraw package. It accepts `children` which can be any content you like to render inside.

The `<Sidebar>` component takes these props (all are optional except `children`):

| name | type | description |
| --- | --- | --- |
| className | string |
| children | `tsxReact.ReactNode` | Content you want to render inside the sidebar. |
| onClose | `tsx() => void` | Invoked when the component is closed (by user, or the editor). No need to act on this event, as the editor manages the sidebar open state on its own. |
| onDock | `tsx(isDocked: boolean) => void` | Invoked when the user toggles the dock button. |
| docked | boolean | Indicates whether the sidebar is docked. By default, the sidebar is undocked. If passed, the docking becomes controlled, and you are responsible for updating the `docked` state by listening on `onDock` callback. See [here](#dockedSidebarBreakpoint) for more info docking. |
| dockable | boolean | Indicates whether the sidebar can be docked by user (=the dock button is shown). If `false`, you can still dock programmatically by passing `docked=true` |

The sidebar will always include a header with close/dock buttons (when applicable).

You can also add custom content to the header, by rendering `<Sidebar.Header>` as a child of the `<Sidebar>` component. Note that the custom header will still include the default buttons.

The `<Sidebar.Header>` component takes these props children (all are optional):

| name | type | description |
| --- | --- | --- |
| className | string |
| children | `tsx React.ReactNode` | Content you want to render inside the sidebar header, sibling of the header buttons. |

For example code, see the example [`App.tsx`](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/example/App.tsx#L524) file.

### `viewModeEnabled`

This prop indicates whether the app is in `view mode`. When supplied, the value takes precedence over `intialData.appState.viewModeEnabled`, the `view mode` will be fully controlled by the host app, and users won't be able to toggle it from within the app.

### `zenModeEnabled`

This prop indicates whether the app is in `zen mode`. When supplied, the value takes precedence over `intialData.appState.zenModeEnabled`, the `zen mode` will be fully controlled by the host app, and users won't be able to toggle it from within the app.

### `gridModeEnabled`

This prop indicates whether the shows the grid. When supplied, the value takes precedence over `intialData.appState.gridModeEnabled`, the grid will be fully controlled by the host app, and users won't be able to toggle it from within the app.

### `libraryReturnUrl`

If supplied, this URL will be used when user tries to install a library from [libraries.excalidraw.com](https://libraries.excalidraw.com). Defaults to `window.location.origin + window.location.pathname`. To install the libraries in the same tab from which it was opened, you need to set `window.name` (to any alphanumeric string) — if it's not set it will open in a new tab.

### `theme`

This prop controls Excalidraw's theme. When supplied, the value takes precedence over `intialData.appState.theme`, the theme will be fully controlled by the host app, and users won't be able to toggle it from within the app unless `UIOptions.canvasActions.toggleTheme` is set to `true`, in which case the `theme` prop will control Excalidraw's default theme with ability to allow theme switching (you must take care of updating the `theme` prop when you detect a change to `appState.theme` from the [onChange](#onChange) callback).

You can use [`THEME`](#THEME-1) to specify the theme.

### `name`

This prop sets the name of the drawing which will be used when exporting the drawing. When supplied, the value takes precedence over `intialData.appState.name`, the `name` will be fully controlled by host app and the users won't be able to edit from within Excalidraw.

### `UIOptions`

This prop can be used to customise UI of Excalidraw. Currently we support customising [`canvasActions`](#canvasActions) and [`dockedSidebarBreakpoint`](#dockedSidebarBreakpoint). It accepts the below parameters

```tsx
{ canvasActions: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L208"> CanvasActions<a/> }
```

##### canvasActions

| Attribute | Type | Default | Description |
| --- | --- | --- | --- |
| `changeViewBackgroundColor` | boolean | true | Implies whether to show `Background color picker` |
| `clearCanvas` | boolean | true | Implies whether to show `Clear canvas button` |
| `export` | false &#124; [exportOpts](#exportOpts) | `tsx{ saveFileToDisk: true }` | This prop allows to customize the UI inside the export dialog. By default it shows the "saveFileToDisk". If this prop is `false` the export button will not be rendered. For more details visit [`exportOpts`](#exportOpts). |
| `loadScene` | boolean | true | Implies whether to show `Load button` |
| `saveToActiveFile` | boolean | true | Implies whether to show `Save button` to save to current file |
| `toggleTheme` | boolean &#124; null | null | Implies whether to show `Theme toggle`. When defined as `boolean`, takes precedence over [`props.theme`](#theme) to show `Theme toggle` |
| `saveAsImage` | boolean | true | Implies whether to show `Save as image button` |

##### `dockedSidebarBreakpoint`

This prop indicates at what point should we break to a docked, permanent sidebar. If not passed it defaults to [`MQ_RIGHT_SIDEBAR_MAX_WIDTH_PORTRAIT`](https://github.com/excalidraw/excalidraw/blob/master/src/constants.ts#L167). If the `width` of the `excalidraw` container exceeds `dockedSidebarBreakpoint`, the sidebar will be dockable. If user choses to dock the sidebar, it will push the right part of the UI towards the left, making space for the sidebar as shown below.

![image](https://user-images.githubusercontent.com/11256141/174664866-c698c3fa-197b-43ff-956c-d79852c7b326.png)

### `exportOpts`

The below attributes can be set in `UIOptions.canvasActions.export` to customize the export dialog. If `UIOptions.canvasActions.export` is `false` the export button will not be rendered.

| Attribute | Type | Default | Description |
| --- | --- | --- | --- |
| `saveFileToDisk` | boolean | true | Implies if save file to disk button should be shown |
| `onExportToBackend` | `tsx (exportedElements: readonly NonDeletedExcalidrawElement[],appState: AppState,canvas: HTMLCanvasElement &#124; null) => void ` |  | This callback is triggered when the shareable-link button is clicked in the export dialog. The link button will only be shown if this callback is passed. |
| `renderCustomUI` | `tsx (exportedElements: readonly NonDeletedExcalidrawElement[],appState: AppState,canvas: HTMLCanvasElement &#124; null) => void ` |  | This callback should be supplied if you want to render custom UI in the export dialog. |

### `onPaste`

This callback is triggered if passed when something is pasted into the scene. You can use this callback in case you want to do something additional when the paste event occurs.

```tsx
(data: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/clipboard.ts#L21">ClipboardData</a>, event: ClipboardEvent &#124; null) => boolean
```

This callback must return a `boolean` value or a [promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/Promise) which resolves to a boolean value.

In case you want to prevent the excalidraw paste action you must return `false`, it will stop the native excalidraw clipboard management flow (nothing will be pasted into the scene).

### `importLibrary`

Imports library from given URL. You should call this on `hashchange`, passing the `addLibrary` value if you detect it as shown below. Optionally pass a CSRF `token` to skip prompting during installation (retrievable via `token` key from the url coming from [https://libraries.excalidraw.com](https://libraries.excalidraw.com/)).

```js
useEffect(() => {
  const onHashChange = () => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const libraryUrl = hash.get("addLibrary");
    if (libraryUrl) {
      excalidrawRef.current.importLibrary(libraryUrl, hash.get("token"));
    }
  };
  window.addEventListener("hashchange", onHashChange, false);
  return () => {
    window.removeEventListener("hashchange", onHashChange);
  };
}, []);
```

Try out the [Demo](#Demo) to see it in action.

### `setToast`

This API can be used to show the toast with custom message.

```tsx
({ message: string,
 closable?:boolean,
 duration?:number } | null) => void
```

| Attribute | type | Description |
| --- | --- | --- |
| message | string | The message to be shown on the toast. |
| closable | boolean | Indicates whether to show the closable button on toast to dismiss the toast. |
| duration | number | Determines the duration after which the toast should auto dismiss. To prevent autodimiss you can pass `Infinity`. |

To dismiss an existing toast you can simple pass `null`

```js
setToast(null);
```

### `setActiveTool`

This API has the below signature. It sets the `tool` passed in param as the active tool.

```tsx
(tool: { type: typeof <a href="https://github.com/excalidraw/excalidraw/blob/master/src/shapes.tsx#L4">SHAPES</a>[number]["value"] &#124; "eraser" } &#124; { type: "custom"; customType: string }) => void
```

### `setCursor`

This API can be used to customise the mouse cursor on the canvas and has the below signature. It sets the mouse cursor to the cursor passed in param.

```tsx
(cursor: string) => void
```

### `toggleMenu`

```tsx
(type: "library" | "customSidebar", force?: boolean) => boolean;
```

This API can be used to toggle a specific menu (currently only the sidebars), and returns whether the menu was toggled on or off. If the `force` flag passed, it will force the menu to be toggled either on/off based on the boolean passed.

This API is especially useful when you render a custom sidebar using [`renderSidebar`](#renderSidebar) prop, and you want to toggle it from your app based on a user action.

### `resetCursor`

This API can be used to reset to default mouse cursor.

### `detectScroll`

Indicates whether Excalidraw should listen for `scroll` event on the nearest scrollable container in the DOM tree and recompute the coordinates (e.g. to correctly handle the cursor) when the component's position changes. You can disable this when you either know this doesn't affect your app or you want to take care of it yourself (calling the [`refresh()`](#ref) method).

### `handleKeyboardGlobally`

Indicates whether to bind keyboard events to `document`. Disabled by default, meaning the keyboard events are bound to the Excalidraw component. This allows for multiple Excalidraw components to live on the same page, and ensures that Excalidraw keyboard handling doesn't collide with your app's (or the browser) when the component isn't focused.

Enable this if you want Excalidraw to handle keyboard even if the component isn't focused (e.g. a user is interacting with the navbar, sidebar, or similar).

### `onLibraryChange`

This callback if supplied will get triggered when the library is updated and has the below signature.

<pre>
(items: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L200">LibraryItems</a>) => void | Promise&lt;any&gt;
</pre>

It is invoked with empty items when user clears the library. You can use this callback when you want to do something additional when library is updated for example persisting it to local storage.

### `id`

The unique id of the excalidraw component. This can be used to identify the excalidraw component, for example importing the library items to the excalidraw component from where it was initiated when you have multiple excalidraw components rendered on the same page as shown in [multiple excalidraw demo](https://codesandbox.io/s/multiple-excalidraw-k1xx5).

### `autoFocus`

This prop implies whether to focus the Excalidraw component on page load. Defaults to false.

### `generateIdForFile`

Allows you to override `id` generation for files added on canvas (images). By default, an SHA-1 digest of the file is used.

```
(file: File) => string | Promise<string>
```

### `onLinkOpen`

This prop if passed will be triggered when clicked on link. To handle the redirect yourself (such as when using your own router for internal links), you must call `event.preventDefault()`.

```
(element: ExcalidrawElement, event: CustomEvent<{ nativeEvent: MouseEvent }>) => void
```

Example:

```ts
const history = useHistory();

// open internal links using the app's router, but opens external links in
// a new tab/window
const onLinkOpen: ExcalidrawProps["onLinkOpen"] = useCallback(
  (element, event) => {
    const link = element.link;
    const { nativeEvent } = event.detail;
    const isNewTab = nativeEvent.ctrlKey || nativeEvent.metaKey;
    const isNewWindow = nativeEvent.shiftKey;
    const isInternalLink =
      link.startsWith("/") || link.includes(window.location.origin);
    if (isInternalLink && !isNewTab && !isNewWindow) {
      history.push(link.replace(window.location.origin, ""));
      // signal that we're handling the redirect ourselves
      event.preventDefault();
    }
  },
  [history],
);
```

### `onPointerDown`

This prop if passed will be triggered on pointer down events and has the below signature.

```tsx
(activeTool: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L93"> AppState["activeTool"]</a>, pointerDownState: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L365">PointerDownState</a>) => void
```

### `onScrollChange`

This prop if passed will be triggered when canvas is scrolled and has the below signature.

```ts
(scrollX: number, scrollY: number) => void
```

### Restore utilities
