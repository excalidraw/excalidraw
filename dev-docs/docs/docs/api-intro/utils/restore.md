---
title: Restore Utilities
id: "restore"
---

### restoreAppState

**_Signature_**

<pre>
restoreAppState(appState: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/data/types.ts#L34">ImportedDataState["appState"]</a>,<br/>&nbsp; localAppState: Partial&lt;<a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L95">AppState</a>> | null): <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L95">AppState</a>
</pre>

**_How to use_**

```js
import { restoreAppState } from "@excalidraw/excalidraw";
```

This function will make sure all the `keys` have appropriate `values` in [appState](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L95) and if any key is missing, it will be set to its `default` value.

When `localAppState` is supplied, it's used in place of values that are missing (`undefined`) in `appState` instead of the defaults.  
Use this as a way to not override user's defaults if you persist them.
You can pass `null` / `undefined` if not applicable.

### restoreElements

**_Signature_**

<pre>
restoreElements(
  elements: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L114">ImportedDataState["elements"]</a>,<br/>&nbsp;
  localElements: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L114">ExcalidrawElement[]</a> | null | undefined): <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L114">ExcalidrawElement[]</a>,<br/>&nbsp;
  refreshDimensions?: boolean<br/>
)
</pre>

**_How to use_**

```js
import { restoreElements } from "@excalidraw/excalidraw";
```

This function will make sure all properties of element is correctly set and if any attribute is missing, it will be set to its default value.

When `localElements` are supplied, they are used to ensure that existing restored elements reuse `version` (and increment it), and regenerate `versionNonce`.  
Use this when you import elements which may already be present in the scene to ensure that you do not disregard the newly imported elements if you're using element version to detect the updates.

Parameter `refreshDimensions` indicates whether we should also `recalculate` text element dimensions. Defaults to `false`. Since this is a potentially costly operation, you may want to disable it if you restore elements in tight loops, such as during collaboration.

### restore

**_Signature_**

<pre>
restore(
  data: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/data/types.ts#L34">ImportedDataState</a>,<br/>&nbsp;
  localAppState: Partial&lt;<a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L95">AppState</a>> | null | undefined,<br/>&nbsp;
  localElements: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L114">ExcalidrawElement[]</a> | null | undefined<br/>): <a href="https://github.com/excalidraw/excalidraw/blob/master/src/data/types.ts#L4">DataState</a>
)
</pre>

See [`restoreAppState()`](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#restoreAppState) about `localAppState`, and [`restoreElements()`](https://github.com/excalidraw/excalidraw/blob/master/src/packages/excalidraw/README.md#restoreElements) about `localElements`.

**_How to use_**

```js
import { restore } from "@excalidraw/excalidraw";
```

This function makes sure elements and state is set to appropriate values and set to default value if not present. It is a combination of [restoreElements](#restoreelements) and [restoreAppState](#restoreappstate).

### restoreLibraryItems

**_Signature_**

<pre>
restoreLibraryItems(libraryItems: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/data/types.ts#L34">ImportedDataState["libraryItems"]</a>,<br/>&nbsp;
defaultStatus: "published" | "unpublished")
</pre>

**_How to use_**

```js
import { restoreLibraryItems } from "@excalidraw/excalidraw";

restoreLibraryItems(libraryItems, "unpublished");
```

This function normalizes library items elements, adding missing values when needed.
