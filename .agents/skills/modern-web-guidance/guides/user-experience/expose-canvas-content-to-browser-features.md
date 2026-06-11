# Expose canvas content to browser features

Regular `<canvas>` content is not exposed to browser features such as screen readers, indexing, translation tools, accessibility assistive tools, find-in-page, print, etc. With `HTML in canvas`, you can render real DOM directly in a canvas element. Adding the `layoutsubtree` attribute to a `<canvas>` HTML element allows rendering descendant HTML elements within the canvas's rendering context. You can use it to style and lay out text in a canvas, expose canvas content to browser features (like accessibility, translation, or find-in-page), and apply 2D and 3D effects to HTML.

## How to implement

1. Check if HTML-in-Canvas is supported in the browser:

```
if ('requestPaint' in HTMLCanvasElement.prototype) {
  // Use HTML in Canvas API
} else {
  // Use fallback strategy
}
```

2. Add the `layoutsubtree` attribute to the `<canvas>` HTML element.
3. Place your HTML content inside the `<canvas>` element with the `layoutsubtree` attribute.

```html
<canvas id="canvas" layoutsubtree>
  <div id="html-content"></div>
</canvas>
```

4. Scale your canvas grid to match the device scale factor to prevent blurriness:

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

5. Render the HTML content to the canvas inside a `canvas.onpaint` event handler:

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
    // Update the texture with drawElementImage, texElementImage2D, or copyElementImageToTexture, and update the CSS transform as shown in step 6
  }
};
```

6. Update the CSS transform.

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
  - Calculate the final transform. Multiply the matrices in order: Viewport _ MVP _ Normalization. Combining them into one final transform produces a "map" that tells the browser exactly where that HTML element layer should sit to align with the 3D drawing.
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

7. [Troubleshooting] If the developer is experiencing a mismatch in the DOM logical layout in 3D even after applying the CSS transform from step 5, check if the developer is experiencing the issue in Chromium 148 or earlier. If that's the case, check if `transform.is2D` is correctly set to false for a 3D DOMMatrix. If not, re-initialize the DOMMatrix which corrects `is2D` to be false before applying the transform to the target HTML element. This issue is fixed in Chromium 149+, and if the developer is experiencing it in newer Chromium versions, the is2D value is not the cause:

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

## Example code

### 2D Canvas

```html
<canvas id="canvas" layoutsubtree style="width: 400px; height: 200px;">
  <div id="ui-element">
    <p>
      This text is rendered inside the canvas but is present in the DOM tree.
    </p>
    <input type="email" name="email" placeholder="enter your email" />
    <button type="button">Submit</button>
  </div>
</canvas>

<script>
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");
  const uiElement = document.getElementById("ui-element");

  canvas.onpaint = () => {
    ctx.reset();
    // Draw the HTML element at x:0, y:0
    const transform = ctx.drawElementImage(uiElement, 0, 0);

    // Sync the DOM location with the drawn location
    uiElement.style.transform = transform.toString();
  };

  // Handle resizing to match device pixels
  const observer = new ResizeObserver(([entry]) => {
    const dpc = entry.devicePixelContentBoxSize;
    canvas.width = dpc
      ? dpc[0].inlineSize
      : Math.round(entry.contentRect.width * window.devicePixelRatio);
    canvas.height = dpc
      ? dpc[0].blockSize
      : Math.round(entry.contentRect.height * window.devicePixelRatio);
    canvas.requestPaint();
  });

  const supportsDevicePixelContentBox =
    typeof ResizeObserverEntry !== "undefined" &&
    "devicePixelContentBoxSize" in ResizeObserverEntry.prototype;
  const options = supportsDevicePixelContentBox
    ? { box: "device-pixel-content-box" }
    : {};
  observer.observe(canvas, options);
</script>
```

### WebGL Canvas

```html
<canvas id="canvas" layoutsubtree style="width: 400px; height: 400px;">
  <div id="ui-element">
    <p>WebGL UI Element</p>
    <button>Action</button>
  </div>
</canvas>

<script>
  const canvas = document.getElementById("canvas");
  const gl = canvas.getContext("webgl");
  const uiElement = document.getElementById("ui-element");

  // Setup WebGL texture...
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  canvas.onpaint = () => {
    // 1. Update texture with HTML content
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

    // ... Render your 3D scene here, calculating htmlElementMVP matrix ...

    // 2. Sync DOM position with 3D scene
    if (canvas.getElementTransform) {
      const mvpDOM = new DOMMatrix(Array.from(htmlElementMVP));

      // Recalculate the DPR compensation mapping
      const dprX = canvas.width / canvas.clientWidth;
      const dprY = canvas.height / canvas.clientHeight;
      const gridWidth = uiElement.offsetWidth * dprX;
      const gridHeight = uiElement.offsetHeight * dprY;

      const cssToUnitSpace = new DOMMatrix()
        .scale(1 / gridWidth, -1 / gridHeight, 1 / gridHeight)
        .translate(-gridWidth / 2, -gridHeight / 2);

      const clipToCanvasViewport = new DOMMatrix()
        .translate(canvas.width / 2, canvas.height / 2)
        .scale(canvas.width / 2, -canvas.height / 2, canvas.height / 2);

      const screenSpaceTransform = clipToCanvasViewport
        .multiply(mvpDOM)
        .multiply(cssToUnitSpace);

      const computedTransform = canvas.getElementTransform(
        uiElement,
        screenSpaceTransform,
      );
      uiElement.style.transform = computedTransform.toString();
    }
  };
</script>
```

### WebGPU Canvas

```html
<canvas id="canvas" layoutsubtree style="width: 400px; height: 400px;">
  <div id="ui-element">
    <p>WebGPU UI Element</p>
  </div>
</canvas>

<script>
  const canvas = document.getElementById("canvas");
  const context = canvas.getContext("webgpu");
  const uiElement = document.getElementById("ui-element");

  // Setup WebGPU...
  // const device = ...
  // const targetTexture = ...

  canvas.onpaint = () => {
    // 1. Copy HTML content to texture
    if (device.queue.copyElementImageToTexture) {
      device.queue.copyElementImageToTexture(uiElement, width, height, {
        texture: targetTexture,
      });
    }

    // 2. Sync DOM position (same matrix math as WebGL)
    if (canvas.getElementTransform) {
      const mvpDOM = new DOMMatrix(Array.from(htmlElementMVP));

      // Recalculate the DPR compensation mapping
      const dprX = canvas.width / canvas.clientWidth;
      const dprY = canvas.height / canvas.clientHeight;
      const gridWidth = uiElement.offsetWidth * dprX;
      const gridHeight = uiElement.offsetHeight * dprY;

      const cssToUnitSpace = new DOMMatrix()
        .scale(1 / gridWidth, -1 / gridHeight, 1 / gridHeight) // Retain Z scale
        .translate(-gridWidth / 2, -gridHeight / 2);

      const clipToCanvasViewport = new DOMMatrix()
        .translate(canvas.width / 2, canvas.height / 2)
        .scale(canvas.width / 2, -canvas.height / 2, canvas.height / 2); // Retain Z scale

      const screenSpaceTransform = clipToCanvasViewport
        .multiply(mvpDOM)
        .multiply(cssToUnitSpace);

      const computedTransform = canvas.getElementTransform(
        uiElement,
        screenSpaceTransform,
      );
      uiElement.style.transform = computedTransform.toString();
    }
  };
</script>
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

The HTML-in-Canvas API is not currently supported in all modern browsers, thus a fallback strategy is typically required.

However, given the improved performance benefits of this API, HTML-in-Canvas should be used if the browser supports it.

The fallback strategy depends on the use case. For example, for an interactive HTML content in canvas, if HTML-in-Canvas is not supported, place the HTML content on top of the canvas using CSS.

### HTML-in-Canvas polyfills

Use the following polyfill script to mimic the HTML-in-Canvas API in browsers that do not support it.

1. Install or embed the library:

```
# Install
npm install three-html-render
```

```
# Embed
<script src="https://cdn.jsdelivr.net/npm/three-html-render/dist/polyfill.js"></script>
```

2. Run the `installHtmlInCanvasPolyfill()` method to translate HTML-in-Canvas.
