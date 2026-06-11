When building tooltips or popovers with CSS Anchor Positioning, the browser can automatically "flip" the element to a fallback position if it would otherwise overflow the viewport. When this happens, you may want to adjust the style of the positioned content, for instance to reposition an arrow that points from the positioned content to the anchor.

**Anchored Container Queries** solve this by allowing you to query the active positioning state of an element and apply styles accordingly.

## The problem

Imagine a tooltip that appears above its anchor by default. It has a "down" arrow at the bottom. If the user scrolls and the tooltip flips to appear *below* the anchor, the arrow is now pointing the wrong way and is on the wrong side of the tooltip.

## The solution: Anchored Container Queries

By setting `container-type: anchored` on your positioned element, you turn it into a query container that knows about its own anchor-positioned state. You can then use the `@container anchored()` query to update its descendants or pseudo-elements.

### 1. Create the tooltip and trigger

Use the Popover API to create a tooltip. This creates an implicit anchor connection that can be used for positioning.

```html
<button popovertarget="tooltip" id="anchor" aria-describedby="tooltip">anchor</button>
<div id="tooltip" popover role="tooltip"></div>
```

Reset the popover inset and margin styles for use with anchor positioning, but only if anchor positioning is supported.

```css
@supports (anchor-name: --my-anchor) {
  [popover] {
    inset: auto;
    margin: unset;
  }
}
```

### 2. Set up the container

Apply `container-type: anchored` to the element being positioned. This element must also have `position-try-fallbacks` defined to enable the flipping behavior.

```css
#tooltip {
  position: fixed;
  position-area: block-start;
  position-try-fallbacks: flip-block;

  /* Enable anchored container queries */
  container-type: anchored;
}
```

### 3. Style based on the fallback

Use `@container anchored(fallback: <value>)` to apply styles when a specific fallback is active.

Like all container queries, `@container` can only style **descendants** of the container. A common strategy to create the arrows is with the `::before` and `::after` pseudo-elements, which are treated as descendants and can be styled directly. However, to style the tooltip itself (as seen in step 4), we will add a child element to the tooltip, and create the arrow in its `::before` pseudo-element.

```html
<div id="tooltip" popover role="tooltip">
  <div class="tooltip-content">Tooltip</div>
</div>
```

```css
.tooltip-content::before {
  /* Default "down" arrow for the 'top' position */
  content: "▼";
  position: absolute;
  inset-block-end: 0;
  inset-inline-start: 1rem;
}

/* Update to an "up" arrow when the 'flip-block' fallback (bottom) is active */
@container anchored(fallback: flip-block) {
  .tooltip-content::before {
    content: "▲";
    inset-block-start: 0;
    inset-block-end: auto;
  }
}
```

## 4. Styling the container itself

If you need to change properties on the container itself (like `margin` or `background-color`) when it flips, you should use an **inner wrapper element**.

1. Apply `container-type: anchored` to the outer positioned element.
2. Target the inner element inside the `@container` block.


```css
@container anchored(fallback: flip-block) {
  .tooltip-content {
    border-radius: 0 0 .5rem .5rem;
    margin-block-start: 0.25rem;
  }
}
```

## Best practices

- **Prefer logical fallbacks**: Use keywords like `flip-block` and `flip-inline` in `position-try-fallbacks` for simpler queries that handle RTL and different writing modes automatically.
- **Use pseudo-elements for arrows**: Tooltip arrows are purely decorative and are perfect candidates for `::before` or `::after`, which can be styled via anchored container queries without extra DOM.


## Fallback strategies

Anchor position container queries has limited availability.
Supported by: Chrome 143 (Dec 2025) and Edge 143 (Dec 2025).
Unsupported in: Firefox and Safari.

Positioning the arrow based on the applied fallback is a progressive enhancement, and there is not another way of reacting to the fallback position. To hide the arrow in browsers that don't support anchor position container queries, test for CSS support with `@supports (container-type: anchored)`.

```css
@supports (container-type: anchored) {
  .tooltip-content::before {
    content: "▼";
  }
}
```

### Polyfilling the Popover Attribute

Baseline status for Popover: Newly available. It's been Baseline since 2025-01-27.
Supported by: Chrome 116 (Aug 2023), Edge 116 (Aug 2023), Firefox 125 (Apr 2024), Safari 17 (Sep 2023), and Safari iOS 18.3 (Jan 2025).

To support the `popover` attribute in older browsers, use the `@oddbird/popover-polyfill`.

MANDATORY: Feature detect popover support by checking for the `popover` property on the `HTMLElement` prototype. Conditionally initialize the polyfill only if native support is missing.

**Option 1: Using a package manager**
Install the package (`npm install @oddbird/popover-polyfill`).

```javascript
// MANDATORY: Feature detect 'popover' on HTMLElement.prototype.
if (!('popover' in HTMLElement.prototype)) {
  import('@oddbird/popover-polyfill/fn').then(({ apply }) => {
    apply();
  });
}
```

**Option 2: Manual installation without npm**
If you are not using a package manager, dynamically import the polyfill directly from a CDN (such as unpkg) inside a `<script type="module">`.

```html
<script type="module">
  // MANDATORY: Feature detect 'popover' on HTMLElement.prototype.
  // Conditionally load the popover-polyfill from a CDN only in browsers lacking native support.
  if (!('popover' in HTMLElement.prototype)) {
    import('https://unpkg.com/@oddbird/popover-polyfill@latest/dist/popover-fn.js').then(({ apply }) => {
      apply();
    });
  }
</script>
```

Browsers without support for the Popover API also do not support anchor positioning, so the tooltip will appear in the center of the screen.