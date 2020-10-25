# @excalidraw/utils

## Install

    npm i @excalidraw/utils

## API

### `exportToBlob` (async)

Export an Excalidraw diagram to a [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob).

### `exportToSvg`

Export an Excalidraw diagram to a [SVGElement](https://developer.mozilla.org/en-US/docs/Web/API/SVGElement).

## Usage

### Webpack

```js
import { exportToSvg, exportToBlob } from "@excalidraw/utils";

const excalidrawDiagram = {
  type: "excalidraw",
  version: 2,
  source: "https://excalidraw.com",
  elements: [
    {
      id: "vWrqOAfkind2qcm7LDAGZ",
      type: "ellipse",
      x: 414,
      y: 237,
      width: 214,
      height: 214,
      angle: 0,
      strokeColor: "#000000",
      backgroundColor: "#15aabf",
      fillStyle: "hachure",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [],
      strokeSharpness: "sharp",
      seed: 1041657908,
      version: 120,
      versionNonce: 1188004276,
      isDeleted: false,
      boundElementIds: null,
    },
  ],
  appState: {
    viewBackgroundColor: "#ffffff",
    gridSize: null,
  },
};

const svg = exportToSvg(excalidrawDiagram);
console.log(svg.outerHTML); // Excalidraw diagram as SVG string

(async () => {
  const blob = await exportToBlob({
    ...excalidrawDiagram,
    mimeType: "image/png",
  });

  const urlCreator = window.URL || window.webkitURL;
  console.log(urlCreator.createObjectURL(blob)); // Excalidraw diagram as PNG Blob URL
})();
```

### Browser

In a Web page:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Excalidraw</title>
  </head>
  <body>
    <script src="./node_modules/@excalidraw/utils/dist/excalidraw-utils.js"></script>
    <script>
      const excalidrawDiagram = {
        type: "excalidraw",
        version: 2,
        source: "https://excalidraw.com",
        elements: [
          {
            id: "vWrqOAfkind2qcm7LDAGZ",
            type: "ellipse",
            x: 414,
            y: 237,
            width: 214,
            height: 214,
            angle: 0,
            strokeColor: "#000000",
            backgroundColor: "#15aabf",
            fillStyle: "hachure",
            strokeWidth: 1,
            strokeStyle: "solid",
            roughness: 1,
            opacity: 100,
            groupIds: [],
            strokeSharpness: "sharp",
            seed: 1041657908,
            version: 120,
            versionNonce: 1188004276,
            isDeleted: false,
            boundElementIds: null,
          },
        ],
        appState: {
          viewBackgroundColor: "#ffffff",
          gridSize: null,
        },
      };

      const svg = ExcalidrawUtils.exportToSvg(excalidrawDiagram);
      console.log(svg.outerHTML); // Excalidraw diagram as SVG string
    </script>
  </body>
</html>
```
