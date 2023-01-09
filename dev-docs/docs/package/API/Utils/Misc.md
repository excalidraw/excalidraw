# Extra APIs

### `serializeAsJSON`

**_Signature_**

```tsx
serializeAsJSON({
  elements: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L106">ExcalidrawElement[]</a>,
  appState: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L79">AppState</a>,
}): string
```

Takes the scene elements and state and returns a JSON string. Deleted `elements`as well as most properties from `AppState` are removed from the resulting JSON. (see [`serializeAsJSON()`](https://github.com/excalidraw/excalidraw/blob/master/src/data/json.ts#L16) source for details).

If you want to overwrite the source field in the JSON string, you can set `window.EXCALIDRAW_EXPORT_SOURCE` to the desired value.

### `serializeLibraryAsJSON`

**_Signature_**

<pre>
serializeLibraryAsJSON(
  libraryItems: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L200">LibraryItems[]</a>)
</pre>

Takes the library items and returns a JSON string.

If you want to overwrite the source field in the JSON string, you can set `window.EXCALIDRAW_EXPORT_SOURCE` to the desired value.

### `getSceneVersion`

**How to use**

```tsx
import { getSceneVersion } from "@excalidraw/excalidraw";
getSceneVersion(elements:  <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L106">ExcalidrawElement[]</a>)
```

This function returns the current scene version.

#### `isInvisiblySmallElement`

**_Signature_**

```tsx
isInvisiblySmallElement(element:  <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L106">ExcalidrawElement</a>): boolean
```

**How to use**

```js
import { isInvisiblySmallElement } from "@excalidraw/excalidraw";
```

Returns `true` if element is invisibly small (e.g. width & height are zero).

### `loadLibraryFromBlob`

```js
import { loadLibraryFromBlob } from "@excalidraw/excalidraw";
```

**_Signature_**

```tsx
loadLibraryFromBlob(blob: <a href="https://developer.mozilla.org/en-US/docs/Web/API/Blob">Blob</a>, defaultStatus: "published" | "unpublished")
```

This function loads the library from the blob. Additonally takes `defaultStatus` param which sets the default status for library item if not present, defaults to `unpublished`.

### `loadFromBlob`

**How to use**

```js
import { loadFromBlob } from "@excalidraw/excalidraw";

const scene = await loadFromBlob(file, null, null);
excalidrawAPI.updateScene(scene);
```

**Signature**

```tsx
loadFromBlob(
  blob: <a href="https://developer.mozilla.org/en-US/docs/Web/API/Blob">Blob</a>,
  localAppState: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L79">AppState</a> | null,
  localElements: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L106">ExcalidrawElement[]</a> | null,
  fileHandle?: FileSystemHandle | null
) => Promise<<a href="https://github.com/excalidraw/excalidraw/blob/master/src/data/restore.ts#L53">RestoredDataState</a>>
```

This function loads the scene data from the blob (or file). If you pass `localAppState`, `localAppState` value will be preferred over the `appState` derived from `blob`. Throws if blob doesn't contain valid scene data.

### `loadSceneOrLibraryFromBlob`

**How to use**

```js
import { loadSceneOrLibraryFromBlob, MIME_TYPES } from "@excalidraw/excalidraw";

const contents = await loadSceneOrLibraryFromBlob(file, null, null);
if (contents.type === MIME_TYPES.excalidraw) {
  excalidrawAPI.updateScene(contents.data);
} else if (contents.type === MIME_TYPES.excalidrawlib) {
  excalidrawAPI.updateLibrary(contents.data);
}
```

**Signature**

```tsx
loadSceneOrLibraryFromBlob(
  blob: <a href="https://developer.mozilla.org/en-US/docs/Web/API/Blob">Blob</a>,
  localAppState: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L79">AppState</a> | null,
  localElements: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L106">ExcalidrawElement[]</a> | null,
  fileHandle?: FileSystemHandle | null
) => Promise<{ type: string, data: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/data/restore.ts#L53">RestoredDataState</a> | <a href="https://github.com/excalidraw/excalidraw/blob/master/src/data/types.ts#L33">ImportedLibraryState</a>}>
```

This function loads either scene or library data from the supplied blob. If the blob contains scene data, and you pass `localAppState`, `localAppState` value will be preferred over the `appState` derived from `blob`. Throws if blob doesn't contain neither valid scene data or library data.

### `getFreeDrawSvgPath`

**How to use**

```js
import { getFreeDrawSvgPath } from "@excalidraw/excalidraw";
```

**Signature**

```tsx
getFreeDrawSvgPath(element: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L127">ExcalidrawFreeDrawElement</a>
```

This function returns the free draw svg path for the element.

### `isLinearElement`

**How to use**

```js
import { isLinearElement } from "@excalidraw/excalidraw";
```

**Signature**

```tsx
isLinearElement(elementType?: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L80">ExcalidrawElement</a>): boolean
```

This function returns true if the element is linear type (`arrow` |`line`) else returns false.

### `getNonDeletedElements`

**How to use**

```js
import { getNonDeletedElements } from "@excalidraw/excalidraw";
```

**Signature**

```tsx
getNonDeletedElements(elements: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L80"> readonly ExcalidrawElement[]</a>): as readonly <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L90">NonDeletedExcalidrawElement[]</a>
```

This function returns an array of deleted elements.

### `mergeLibraryItems`

```js
import { mergeLibraryItems } from "@excalidraw/excalidraw";
```

**_Signature_**

```tsx
mergeLibraryItems(localItems: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L200">LibraryItems</a>, otherItems: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L200">LibraryItems</a>) => <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L200">LibraryItems</a>
```

This function merges two `LibraryItems` arrays, where unique items from `otherItems` are sorted first in the returned array.

### `parseLibraryTokensFromUrl`

**How to use**

```js
import { parseLibraryTokensFromUrl } from "@excalidraw/excalidraw";
```

**Signature**

```tsx
parseLibraryTokensFromUrl(): {
    libraryUrl: string;
    idToken: string | null;
} | null
```

Parses library parameters from URL if present (expects the `#addLibrary` hash key), and returns an object with the `libraryUrl` and `idToken`. Returns `null` if `#addLibrary` hash key not found.

### `useHandleLibrary`

**How to use**

```js
import { useHandleLibrary } from "@excalidraw/excalidraw";

export const App = () => {
  // ...
  useHandleLibrary({ excalidrawAPI });
};
```

**Signature**

```tsx
useHandleLibrary(opts: {
  excalidrawAPI: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L432">ExcalidrawAPI</a>,
  getInitialLibraryItems?: () => <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L224">LibraryItemsSource</a>
});
```

A hook that automatically imports library from url if `#addLibrary` hash key exists on initial load, or when it changes during the editing session (e.g. when a user installs a new library), and handles initial library load if `getInitialLibraryItems` getter is supplied.

In the future, we will be adding support for handling library persistence to browser storage (or elsewhere).

### `sceneCoordsToViewportCoords`

```js
import { sceneCoordsToViewportCoords } from "@excalidraw/excalidraw";
```

**_Signature_**

```tsx
sceneCoordsToViewportCoords({sceneX: number, sceneY: number}, appState: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L79">AppState</a>): {x: number, y: number}
```

This function returns equivalent viewport coords for the provided scene coords in params.

### `viewportCoordsToSceneCoords`

```js
import { viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";
```

**_Signature_**

```tsx
viewportCoordsToSceneCoords({clientX: number, clientY: number}, appState: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L79">AppState</a>): {x: number, y: number}
```

This function returns equivalent scene coords for the provided viewport coords in params.

### useDevice

This hook can be used to check the type of device which is being used. It can only be used inside the `children` of `Excalidraw` component

```js
import { useDevice, Footer } from "@excalidraw/excalidraw";

const MobileFooter = ({
}) => {
  const device = useDevice();
  if (device.isMobile) {
    return (
      <Footer>
       <button
        className="custom-footer"
        onClick={() => alert("This is custom footer in mobile menu")}
      >
        {" "}
        custom footer{" "}
      </button>
      </Footer>
    );
  }
  return null;

};
const App = () => {
  <Excalidraw>
    <MainMenu>
      <MainMenu.Item> Item1 </MainMenu.Item>
      <MainMenu.Item> Item 2 </>
      <MobileFooter/>
    </MainMenu>
  </Excalidraw>
}

```

The `device` has the following `attributes`

| Name | Type | Description |
| --- | --- | --- |
| `isSmScreen` | `boolean` | Set to `true` when the device small screen is small (Width < `640px` ) |
| `isMobile` | `boolean` | Set to `true` when the device is `mobile` |
| `isTouchScreen` | `boolean` | Set to `true` for `touch` devices |
| `canDeviceFitSidebar` | `boolean` | Implies whether there is enough space to fit the `sidebar` |

## Exported constants

### `FONT_FAMILY`

**How to use**

```js
import { FONT_FAMILY } from "@excalidraw/excalidraw";
```

`FONT_FAMILY` contains all the font families used in `Excalidraw` as explained below

| Font Family | Description          |
| ----------- | -------------------- |
| Virgil      | The handwritten font |
| Helvetica   | The Normal Font      |
| Cascadia    | The Code Font        |

Defaults to `FONT_FAMILY.Virgil` unless passed in `initialData.appState.currentItemFontFamily`.

### `THEME`

**How to use**

```js
import { THEME } from "@excalidraw/excalidraw";
```

`THEME` contains all the themes supported by `Excalidraw` as explained below

| Theme | Description     |
| ----- | --------------- |
| LIGHT | The light theme |
| DARK  | The Dark theme  |

Defaults to `THEME.LIGHT` unless passed in `initialData.appState.theme`

### `MIME_TYPES`

**How to use **

```js
import { MIME_TYPES } from "@excalidraw/excalidraw";
```

[`MIME_TYPES`](https://github.com/excalidraw/excalidraw/blob/master/src/constants.ts#L92) contains all the mime types supported by `Excalidraw`.

## Need help?

Check out the existing [Q&A](https://github.com/excalidraw/excalidraw/discussions?discussions_q=label%3Apackage%3Aexcalidraw). If you have any queries or need help, ask us [here](https://github.com/excalidraw/excalidraw/discussions?discussions_q=label%3Apackage%3Aexcalidraw).
