---
title: Restore Utilities
id: "restore"
---

### `restoreAppState`

**_Signature_**

```tsx
restoreAppState(appState: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/data/types.ts#L17">ImportedDataState["appState"]</a>, localAppState: Partial<<a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L79">AppState</a>> | null): <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L79">AppState</a>
```

**_How to use_**

```js
import { restoreAppState } from "@excalidraw/excalidraw";
```

This function will make sure all the keys have appropriate values in [appState](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L79) and if any key is missing, it will be set to default value.

When `localAppState` is supplied, it's used in place of values that are missing (`undefined`) in `appState` instead of defaults. Use this as a way to not override user's defaults if you persist them. Required: supply `null`/`undefined` if not applicable.

### `restoreElements`

**_Signature_**

```tsx
restoreElements(
  elements: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/data/types.ts#L16">ImportedDataState["elements"]</a>,
  localElements: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/data/types.ts#L16">ExcalidrawElement[]</a> | null | undefined): <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L106">ExcalidrawElement[]</a>,
  refreshDimensions: boolean
)
```

**_How to use_**

```js
import { restoreElements } from "@excalidraw/excalidraw";
```

This function will make sure all properties of element is correctly set and if any attribute is missing, it will be set to default value.

When `localElements` are supplied, they are used to ensure that existing restored elements reuse `version` (and increment it), and regenerate `versionNonce`. Use this when you import elements which may already be present in the scene to ensure that you do not disregard the newly imported elements if you're using element version to detect the updates.

Parameter `refreshDimensions` indicates whether we should also recalculate text element dimensions. Defaults to `false`. Since this is a potentially costly operation, you may want to disable it if you restore elements in tight loops, such as during collaboration.

### `restore`

**_Signature_**

```tsx
restoreElements(
  data: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/data/types.ts#L12">ImportedDataState</a>,
  localAppState: Partial<<a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L79">AppState</a>> | null | undefined,
  localElements: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/data/types.ts#L16">ExcalidrawElement[]</a> | null | undefined): <a href="https://github.com/excalidraw/excalidraw/blob/master/src/data/types.ts#L4">DataState</a>
)
```

See [`restoreAppState()`](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#restoreAppState) about `localAppState`, and [`restoreElements()`](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#restoreElements) about `localElements`.

**_How to use_**

```js
import { restore } from "@excalidraw/excalidraw";
```

This function makes sure elements and state is set to appropriate values and set to default value if not present. It is a combination of [restoreElements](#restoreElements) and [restoreAppState](#restoreAppState).

### `restoreLibraryItems`

**_Signature_**

<pre>
restoreLibraryItems(libraryItems: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/data/types.ts#L22">ImportedDataState["libraryItems"]</a>, defaultStatus: "published" | "unpublished")
</pre>

**_How to use_**

```js
import { restoreLibraryItems } from "@excalidraw/excalidraw";

restoreLibraryItems(libraryItems, "unpublished");
```

This function normalizes library items elements, adding missing values when needed.
