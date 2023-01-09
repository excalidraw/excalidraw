---
title: Export Utilities
id: 'export'
---

### `exportToCanvas`

**_Signature_**

<pre>
exportToCanvas(&#123;
  elements,
  appState
  getDimensions,
  files,
  exportPadding?: number;
&#125;: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/packages/utils.ts#L12">ExportOpts</a>
</pre>

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| elements | [Excalidraw Element []](https://github.com/excalidraw/excalidraw/blob/master/src/element/types) |  | The elements to be exported to canvas |
| appState | [AppState](https://github.com/excalidraw/excalidraw/blob/master/src/packages/utils.ts#L12) | [defaultAppState](https://github.com/excalidraw/excalidraw/blob/master/src/appState.ts#L11) | The app state of the scene |
| getDimensions | `(width: number, height: number) => { width: number, height: number, scale?: number }` | undefined | A function which returns the `width`, `height`, and optionally `scale` (defaults `1`), with which canvas is to be exported. |
| maxWidthOrHeight | `number` | undefined | The maximum width or height of the exported image. If provided, `getDimensions` is ignored. |
| files | [BinaryFiles](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L64) | undefined | The files added to the scene. |
| exportPadding | number | 10 | The padding to be added on canvas |

**How to use**

```js
import { exportToCanvas } from "@excalidraw/excalidraw";
```

This function returns the canvas with the exported elements, appState and dimensions.

### `exportToBlob`

**_Signature_**

```tsx
exportToBlob(
  opts: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/packages/utils.ts#L14">ExportOpts</a> & {
  mimeType?: string,
  quality?: number,
  exportPadding?: number;
})
```

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| opts |  |  | This param is passed to `exportToCanvas`. You can refer to [`exportToCanvas`](#exportToCanvas) |
| mimeType | string | "image/png" | Indicates the image format |
| quality | number | 0.92 | A value between 0 and 1 indicating the [image quality](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob#parameters). Applies only to `image/jpeg`/`image/webp` MIME types. |
| exportPadding | number | 10 | The padding to be added on canvas |

**How to use**

```js
import { exportToBlob } from "@excalidraw/excalidraw";
```

Returns a promise which resolves with a [blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob). It internally uses [canvas.ToBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob).

### `exportToSvg`

**_Signature_**

<pre>
exportToSvg(&#123;
  elements: (
    <a href="https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L106">
      ExcalidrawElement[]
    </a>
  ),
  appState: (
    <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L79">
      AppState
    </a>
  ),
  exportPadding: number,
  metadata: string,
  files: (
    <a href="https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L64">
      BinaryFiles
    </a>
  ),
&#125;);
</pre>

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| elements | [Excalidraw Element []](https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts#L106) |  | The elements to exported as svg |
| appState | [AppState](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L79) | [defaultAppState](https://github.com/excalidraw/excalidraw/blob/master/src/appState.ts#L11) | The app state of the scene |
| exportPadding | number | 10 | The padding to be added on canvas |
| files | [BinaryFiles](https://github.com/excalidraw/excalidraw/blob/master/src/types.ts#L64) | undefined | The files added to the scene. |

This function returns a promise which resolves to svg of the exported drawing.

### `exportToClipboard`

**_Signature_**

```tsx
exportToClipboard(
  opts: <a href="https://github.com/excalidraw/excalidraw/blob/master/src/packages/utils.ts#L14">ExportOpts</a> & {
  mimeType?: string,
  quality?: number;
  type: 'png' | 'svg' |'json'
})
```

| Name | Type | Default | Description |
| --- | --- | --- | --- | --- | --- |
| opts |  |  | This param is same as the params passed to `exportToCanvas`. You can refer to [`exportToCanvas`](#exportToCanvas). |
| mimeType | string | "image/png" | Indicates the image format, this will be used when exporting as `png`. |
| quality | number | 0.92 | A value between 0 and 1 indicating the [image quality](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob#parameters). Applies only to `image/jpeg`/`image/webp` MIME types. This will be used when exporting as `png`. |
| type | 'png' | 'svg' | 'json' |  | This determines the format to which the scene data should be exported. |

**How to use**

```js
import { exportToClipboard } from "@excalidraw/excalidraw";
```

Copies the scene data in the specified format (determined by `type`) to clipboard.

### Additional attributes of appState for `export\*` APIs

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| exportBackground | boolean | true | Indicates whether background should be exported |
| viewBackgroundColor | string | #fff | The default background color |
| exportWithDarkMode | boolean | false | Indicates whether to export with dark mode |
| exportEmbedScene | boolean | false | Indicates whether scene data should be embedded in svg/png. This will increase the image size. |
