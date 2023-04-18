---
slug: /@excalidraw/excalidraw/api/utils
---

# Utils

These are pure Javascript functions exported from the @excalidraw/excalidraw [`@excalidraw/excalidraw`](https://npmjs.com/@excalidraw/excalidraw). If you want to export your drawings in different formats eg `png`, `svg` and more you can check out [Export Utilities](/docs/@excalidraw/excalidraw/API/utils/export). If you want to restore your drawings you can check out [Restore Utilities](/docs/@excalidraw/excalidraw/API/utils/restore).

### serializeAsJSON

Takes the scene elements and state and returns a JSON string. `Deleted` elements as well as most properties from `AppState` are removed from the resulting JSON. (see [`serializeAsJSON()`](https://github.com/excalidraw/excalidraw/blob/master/src/data/json.ts#L42) source for details).

If you want to overwrite the `source` field in the `JSON` string, you can set `window.EXCALIDRAW_EXPORT_SOURCE` to the desired value.

**_Signature_**

<pre>
serializeAsJSON(&#123;<br/>&nbsp;
  elements: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L114">ExcalidrawElement[]</a>,<br/>&nbsp;
  appState: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L95">AppState</a>,<br/>
}): string
</pre>

**How to use**

```js
import { serializeAsJSON } from "@excalidraw/excalidraw";
```

### serializeLibraryAsJSON

Takes the `library` items and returns a `JSON` string.

If you want to overwrite the source field in the JSON string, you can set `window.EXCALIDRAW_EXPORT_SOURCE` to the desired value.

**_Signature_**

<pre>
serializeLibraryAsJSON(
  libraryItems: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L200">LibraryItems[]</a>)
</pre>

**How to use**

```js
import { serializeLibraryAsJSON } from "@excalidraw/excalidraw";
```

#### isInvisiblySmallElement

Returns `true` if element is invisibly small (e.g. width & height are zero).

**_Signature_**

<pre>
isInvisiblySmallElement(element:  <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L114">ExcalidrawElement</a>): boolean
</pre>

**How to use**

```js
import { isInvisiblySmallElement } from "@excalidraw/excalidraw";
```

### loadFromBlob

This function loads the scene data from the blob (or file). If you pass `localAppState`, `localAppState` value will be preferred over the `appState` derived from `blob`. Throws if blob doesn't contain valid scene data.

**How to use**

```js
import { loadFromBlob } from "@excalidraw/excalidraw";

const scene = await loadFromBlob(file, null, null);
excalidrawAPI.updateScene(scene);
```

**Signature**

<pre>
loadFromBlob(<br/>&nbsp;
  blob: <a href="https://developer.mozilla.org/en-US/docs/Web/API/Blob">Blob</a>,<br/>&nbsp;
  localAppState: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L95">AppState</a> | null,<br/>&nbsp;
  localElements: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L114">ExcalidrawElement[]</a> | null,<br/>&nbsp;
  fileHandle?: FileSystemHandle | null <br/>
) => Promise&lt;<a href="https://github.com/excalidraw/excalidraw/blob/master/src/data/restore.ts#L61">RestoredDataState</a>>
</pre>

### loadLibraryFromBlob

This function loads the library from the blob. Additonally takes `defaultStatus` param which sets the default status for library item if not present, defaults to `unpublished`.

**How to use **

```js
import { loadLibraryFromBlob } from "@excalidraw/excalidraw";
```

**_Signature_**

<pre>
loadLibraryFromBlob(blob: <a href="https://developer.mozilla.org/en-US/docs/Web/API/Blob">Blob</a>, defaultStatus: "published" | "unpublished")
</pre>

### loadSceneOrLibraryFromBlob

This function loads either scene or library data from the supplied blob. If the blob contains scene data, and you pass `localAppState`, `localAppState` value will be preferred over the `appState` derived from `blob`.

:::caution

Throws if blob doesn't contain valid `scene` data or `library` data.

:::

**How to use**

```js showLineNumbers
import { loadSceneOrLibraryFromBlob, MIME_TYPES } from "@excalidraw/excalidraw";

const contents = await loadSceneOrLibraryFromBlob(file, null, null);
if (contents.type === MIME_TYPES.excalidraw) {
  excalidrawAPI.updateScene(contents.data);
} else if (contents.type === MIME_TYPES.excalidrawlib) {
  excalidrawAPI.updateLibrary(contents.data);
}
```

**_Signature_**

<pre>
loadSceneOrLibraryFromBlob(<br/>&nbsp;
  blob: <a href="https://developer.mozilla.org/en-US/docs/Web/API/Blob">Blob</a>,
  localAppState: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L95">AppState</a> | null,<br/>&nbsp;
  localElements: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L114">ExcalidrawElement[]</a> | null,<br/>&nbsp;
  fileHandle?: FileSystemHandle | null<br/>
) => Promise&lt;&#123; type: string, data: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/data/restore.ts#L53">RestoredDataState</a> | <a href="https://github.com/excalidraw/excalidraw/blob/master/src/data/types.ts#L33">ImportedLibraryState</a>}>
</pre>

### getFreeDrawSvgPath

This function returns the `free draw` svg path for the element.

**How to use**

```js
import { getFreeDrawSvgPath } from "@excalidraw/excalidraw";
```

**Signature**

<pre>
getFreeDrawSvgPath(element: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L182">ExcalidrawFreeDrawElement</a>)
</pre>

### isLinearElement

This function returns true if the element is `linear` type (`arrow` |`line`) else returns `false`.

**How to use**

```js
import { isLinearElement } from "@excalidraw/excalidraw";
```

**Signature**

```tsx
isLinearElement(elementType?: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L80">ExcalidrawElement</a>): boolean
```

### getNonDeletedElements

This function returns an array of `deleted` elements.

**How to use**

```js
import { getNonDeletedElements } from "@excalidraw/excalidraw";
```

**Signature**

<pre>
getNonDeletedElements(elements:<a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L114"> readonly ExcalidrawElement[]</a>): as readonly <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L125">NonDeletedExcalidrawElement[]</a>
</pre>

### mergeLibraryItems

This function merges two `LibraryItems` arrays, where unique items from `otherItems` are sorted first in the returned array.

```js
import { mergeLibraryItems } from "@excalidraw/excalidraw";
```

**_Signature_**

<pre>
mergeLibraryItems(localItems: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L250">LibraryItems</a>,<br/>&nbsp;
 otherItems: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L200">LibraryItems</a>) => <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L250">LibraryItems</a>
</pre>

### parseLibraryTokensFromUrl

Parses library parameters from URL if present (expects the `#addLibrary` hash key), and returns an object with the `libraryUrl` and `idToken`. Returns `null` if `#addLibrary` hash key not found.

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

### useHandleLibrary

A hook that automatically imports library from url if `#addLibrary` hash key exists on initial load, or when it changes during the editing session (e.g. when a user installs a new library), and handles initial library load if `getInitialLibraryItems` getter is supplied.

**How to use**

```js
import { useHandleLibrary } from "@excalidraw/excalidraw";

export const App = () => {
  // ...
  useHandleLibrary({ excalidrawAPI });
};
```

**Signature**

<pre>
useHandleLibrary(opts: &#123;<br/>&nbsp;
  excalidrawAPI: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L494">ExcalidrawAPI</a>,<br/>&nbsp;
  getInitialLibraryItems?: () => <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L253">LibraryItemsSource</a><br/>
});
</pre>

In the future, we will be adding support for handling `library` persistence to `browser storage` (or elsewhere).

### getSceneVersion

This function returns the current `scene` version.

**_Signature_**

<pre>
getSceneVersion(elements:  <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L114">ExcalidrawElement[]</a>)
</pre>

**How to use**

```js
import { getSceneVersion } from "@excalidraw/excalidraw";
```

### sceneCoordsToViewportCoords

This function returns equivalent `viewport` coords for the provided `scene` coords in params.

```js
import { sceneCoordsToViewportCoords } from "@excalidraw/excalidraw";
```

**_Signature_**

<pre>
sceneCoordsToViewportCoords(&#123; sceneX: number, sceneY: number },<br/>&nbsp;
  appState: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L95">AppState</a><br/>): &#123; x: number, y: number }
</pre>

### viewportCoordsToSceneCoords

This function returns equivalent `scene` coords for the provided `viewport` coords in params.

```js
import { viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";
```

**_Signature_**

<pre>
viewportCoordsToSceneCoords(&#123; clientX: number, clientY: number },<br/>&nbsp;
  appState: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L95">AppState</a><br/>): &#123;x: number, y: number}
</pre>

### useDevice

This hook can be used to check the type of device which is being used. It can only be used inside the `children` of `Excalidraw` component.

Open the `main menu` in the below example to view the footer.

```jsx live noInline
const MobileFooter = ({}) => {
  const device = useDevice();
  if (device.isMobile) {
    return (
      <Footer>
        <button
          className="custom-footer"
          style={{ marginLeft: "20px", height: "2rem" }}
          onClick={() => alert("This is custom footer in mobile menu")}
        >
          custom footer
        </button>
      </Footer>
    );
  }
  return null;
};
const App = () => (
  <div style={{ height: "400px" }}>
    <Excalidraw>
      <MainMenu>
        <MainMenu.Item> Item1 </MainMenu.Item>
        <MainMenu.Item> Item 2 </MainMenu.Item>
        <MobileFooter />
      </MainMenu>
    </Excalidraw>
  </div>
);

// Need to render when code is span across multiple components
// in Live Code blocks editor
render(<App />);
```

The `device` has the following `attributes`

| Name | Type | Description |
| --- | --- | --- |
| `isSmScreen` | `boolean` | Set to `true` when the device small screen is small (Width < `640px` ) |
| `isMobile` | `boolean` | Set to `true` when the device is `mobile` |
| `isTouchScreen` | `boolean` | Set to `true` for `touch` devices |
| `canDeviceFitSidebar` | `boolean` | Implies whether there is enough space to fit the `sidebar` |

### i18n

To help with localization, we export the following.

| name | type |
| --- | --- |
| `defaultLang` | `string` |
| `languages` | [`Language[]`](https://github.com/excalidraw/excalidraw/blob/master/src/i18n.ts#L15) |
| `useI18n` | [`() => { langCode, t }`](https://github.com/excalidraw/excalidraw/blob/master/src/i18n.ts#L15) |

```js
import { defaultLang, languages, useI18n } from "@excalidraw/excalidraw";
```

#### defaultLang

Default language code, `en`.

#### languages

List of supported language codes. You can pass any of these to `Excalidraw`'s [`langCode` prop](/docs/@excalidraw/excalidraw/api/props/#langcode).

#### useI18n

A hook that returns the current language code and translation helper function. You can use this to translate strings in the components you render as children of `<Excalidraw>`.

```jsx live
function App() {
  const { t } = useI18n();
  return (
    <div style={{ height: "500px" }}>
      <Excalidraw>
        <button
          style={{ position: "absolute", zIndex: 10, height: "2rem" }}
          onClick={() => window.alert(t("labels.madeWithExcalidraw"))}
        >
          {t("buttons.confirm")}
        </button>
      </Excalidraw>
    </div>
  );
}
```
