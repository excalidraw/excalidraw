# Export HTML content from canvas

Web applications frequently need to capture and export rich HTML content—such as customized dashboards, styled documents, or interactive charts—as static images or video recordings. Historically, achieving this required bulky third-party libraries that manually parse DOM nodes and CSS properties to reconstruct a visual facsimile on a canvas. This approach is computationally expensive, error-prone, and frequently fails to support modern CSS layout features. With the HTML-in-Canvas API, developers can render real DOM elements directly into the canvas context. Because the browser's native rendering engine paints the HTML subtree with pixel-perfect accuracy, capturing the exact visual output as an image or video stream is highly efficient using built-in canvas methods like `toDataURL()`, `toBlob()`, or `captureStream()`.

## How to implement

1. Check if HTML-in-Canvas is supported in the browser:

```
if ('requestPaint' in HTMLCanvasElement.prototype) {
  // Use HTML in Canvas API
} else {
  // Use fallback strategy
}
```

2. Initialize the canvas to support rendering of descendant HTML elements by adding the `layoutsubtree` attribute to the `<canvas>` HTML element. Place your HTML content inside the `<canvas>` element with the `layoutsubtree` attribute:

```html
<canvas id="canvas" layoutsubtree>
  <div id="html-content"></div>
</canvas>
```

3. Scale your canvas grid to match the device scale factor to prevent blurriness:

```js
const observer = new ResizeObserver(([entry]) => {
  const dpc = entry.devicePixelContentBoxSize;
  canvas.width = dpc
    ? dpc[0].inlineSize
    : Math.round(entry.contentRect.width * window.devicePixelRatio);
  canvas.height = dpc
    ? dpc[0].blockSize
    : Math.round(entry.contentRect.height * window.devicePixelRatio);
});

const supportsDevicePixelContentBox =
  typeof ResizeObserverEntry !== "undefined" &&
  "devicePixelContentBoxSize" in ResizeObserverEntry.prototype;
const options = supportsDevicePixelContentBox
  ? { box: "device-pixel-content-box" }
  : {};
observer.observe(canvas, options);
```

4. Render the HTML content to the canvas inside a `canvas.onpaint` event handler:

- In 2D context, use the `drawElementImage` method:

```js
canvas.onpaint = () => {
  ctx.reset();
  // Draw the form element at x:0, y:0
  let transform = ctx.drawElementImage(form_element, 0, 0);
};
```

- In WebGL context, use the `texElementImage2D` method:

```js
canvas.onpaint = () => {
  if (gl.texElementImage2D) {
    gl.texElementImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      uiElement,
    );
  }
};
```

- In WebGPU context, use the `copyElementImageToTexture` method:

```js
canvas.onpaint = () => {
  root.device.queue.copyElementImageToTexture(valueElement, 512, 128, {
    texture: targetTexture,
  });
};
```


When using a `requestAnimationFrame` loop to render the scene, call `canvas.requestPaint()` within the loop to ensure that the HTML content is rendered to the canvas. Make sure you only re-render the canvas if there has been an update to the descendant HTML elements:

  ```js
  function render() {
    // Request to update the canvas
    canvas.requestPaint();
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  canvas.onpaint = (event) => {
    if (event.changedElements && event.changedElements.length > 0) {
      // Update the texture with drawElementImage, texElementImage2D, or copyElementImageToTexture, and update the CSS transform as shown in step 5
    }
  };
  ```

5. Update the CSS transform.

- For the 2D context case, apply the transform returned by the rendering call to the `style.transform` property:

```js
canvas.onpaint = () => {
  ctx.reset();
  // Draw the form element at x:0, y:0
  let transform = ctx.drawElementImage(form_element, 0, 0);

  // Sync the DOM location with the drawn location
  form_element.style.transform = transform.toString();
};
```

- For the 3D case with WebGL or WebGPU, the browser needs to map from the 3D coordinate space into the CSS coordinate space using a viewport transform. To facilitate this, do the following:
  - Convert WebGL MVP Matrix to DOM Matrix.
  - Normalize the HTML element. HTML elements are sized in pixels (for example, 200px wide). WebGL, however, usually treats objects as "unit squares", for example, ranging from 0 to 1. If you don't normalize, your 200px button will look 200 times larger.
  - Map to the canvas viewport. This step is the "re-scaling" phase: it stretches that unit-space math back out to match the actual pixel dimensions of your `<canvas>` element on the screen. It also flips the Y-axis, because in WebGL, up is positive, but in CSS, down is positive.
  - Calculate the final transform. Multiply the matrices in order: Viewport * MVP * Normalization. Combining them into one final transform produces a "map" that tells the browser exactly where that HTML element layer should sit to align with the 3D drawing.
  - Apply the transform to the HTML element. This moves the HTML element layer to sit directly on top of its rendered pixels. This ensures that when a user clicks a button or selects text, they are actually hitting the real HTML element.

  ```js
  if (canvas.getElementTransform) {
    // 1. Convert WebGL MVP Matrix to DOM Matrix
    const mvpDOM = new DOMMatrix(Array.from(htmlElementMVP));

    // 2. Normalize the HTML element (Canvas Grid pixels -> WebGL Model Space)
    const dprX = canvas.width / canvas.clientWidth;
    const dprY = canvas.height / canvas.clientHeight;
    const gridWidth = targetHTMLElement.offsetWidth * dprX;
    const gridHeight = targetHTMLElement.offsetHeight * dprY;

    const toGLModel = new DOMMatrix()
      // Scale pixels to 1 unit, flip Y (as in CSS it points down, and in WebGL it points up)
      .scale(1 / gridWidth, -1 / gridHeight, 1 / gridHeight)
      // Center the origin: (0,0) becomes (-width/2, -height/2) before scaling
      .translate(-gridWidth / 2, -gridHeight / 2);

    // 3. Map to the canvas viewport
    const clipToCanvasViewport = new DOMMatrix()
      // Move center (0,0) to center of canvas
      .translate(canvas.width / 2, canvas.height / 2)
      // Scale normalized clip (-1..1) to viewport size
      .scale(canvas.width / 2, -canvas.height / 2, canvas.height / 2);

    // 4. Multiply: (Clip -> Pixels) * (MVP) * (pixels -> unit square)
    const screenSpaceTransform = clipToCanvasViewport
      .multiply(mvpDOM)
      .multiply(toGLModel);

    // 5. Apply to the transform
    const computedTransform = canvas.getElementTransform(
      targetHTMLElement,
      screenSpaceTransform,
    );
    targetHTMLElement.style.transform = computedTransform.toString();
  }
  ```

6. [Troubleshooting] If the developer is experiencing a mismatch in the DOM logical layout in 3D even after applying the CSS transform from step 5, check if the developer is experiencing the issue in Chromium 148 or earlier. If that's the case, check if `transform.is2D` is correctly set to false for a 3D DOMMatrix. If not, re-initialize the DOMMatrix which corrects `is2D` to be false before applying the transform to the target HTML element. This issue is fixed in Chromium 149+, and if the developer is experiencing it in newer Chromium versions, the is2D value is not the cause:

```js
if (transform.is2D) {
  // Workaround for Chromium bug https://crbug.com/512171941
  // affecting Chrome versions under 149 where `transform.is2D`
  // is incorrectly true for a 3D DOMMatrix. The assignment
  // below re-initializes the DOMMatrix which corrects is2D to be false.
  transform = DOMMatrix.fromFloat64Array(transform.toFloat64Array());
}
targetHTMLElement.style.transform = computedTransform.toString();
```

7. Use regular canvas export methods like `toDataURL()`, `toBlob()`, or `captureStream()`. The exported data will include the rendered HTML content.

## Example code

```html
<body>
    <canvas id="canvas" style="width: 400px; height: 200px;" layoutsubtree>
        <input id="element">
    </canvas>
    
    <button id="download">Download Image</button>

    <script>
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');
        const element = document.getElementById('element');
        const download = document.getElementById('download');

        canvas.onpaint = (event) => {
            ctx.reset();
            // Draw the element into the canvas
            const transform = ctx.drawElementImage(element, 10, 10);
            // Synchronize DOM position for hit testing (typing)
            element.style.transform = transform.toString();
        };

        download.onclick = () => {
            // Export the canvas content as an image
            const dataURL = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = 'exported-canvas.png';
            link.href = dataURL;
            link.click();
        };

        // Re-initialize canvas size on screen resize
        const observer = new ResizeObserver(([entry]) => {
            const dpc = entry.devicePixelContentBoxSize;
            canvas.width = dpc ? dpc[0].inlineSize : Math.round(entry.contentRect.width * window.devicePixelRatio);
            canvas.height = dpc ? dpc[0].blockSize : Math.round(entry.contentRect.height * window.devicePixelRatio);
            canvas.requestPaint();
        });
        const supportsDevicePixelContentBox = 
            typeof ResizeObserverEntry !== 'undefined' && 
            'devicePixelContentBoxSize' in ResizeObserverEntry.prototype;
        const options = supportsDevicePixelContentBox ? { box: 'device-pixel-content-box' } : {};
        observer.observe(canvas, options);
    </script>
</body>
```

## Best Practices

- **MANDATORY**: Check browser support for the HTML-in-Canvas API before using it.
- **MANDATORY**: Always add the `layoutsubtree` attribute to the `<canvas>` element.
- **MANDATORY**: Use an `onpaint` event handler to render the HTML content to the canvas.
- **MANDATORY**: Use the `drawElementImage`, `texElementImage2D`, or `copyElementImageToTexture` methods to render the HTML content to the canvas.
- **MANDATORY**: Update the CSS transform of the HTML element to match the transform of the rendered content by setting the `style.transform` property of the HTML element.
- **MANDATORY**: Use `ResizeObserver` to observe the screen size and update the canvas size to match device pixels.
- **DO NOT** embed cross-origin content in a canvas, as it is not supported.
- **DO NOT** initialize `ResizeObserver` within the `onpaint` event handler, as it may lead to memory leaks.

## Fallback strategies

HTML in canvas is not natively supported by any major browser yet.

The HTML-in-Canvas API is not currently supported in all modern browsers, thus a fallback strategy is typically required. However, given the improved performance benefits of this API, HTML-in-Canvas should be used if the browser supports it.

For the use case where HTML content needs to be exported from a canvas, use libraries like `html2canvas`, `dom-to-image`, or `snapdom`. 

To capture HTML interactions frame by frame, for example, for streaming, capture DOM mutations using libraries like `rrweb`. 

Alternatively, implement a warning that HTML media export is not supported in the browser because it doesn't support HTML-in-Canvas.