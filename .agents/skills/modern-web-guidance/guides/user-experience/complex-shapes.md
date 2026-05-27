## Overview
To clip elements to complex, free-form shapes like brush strokes or organic textures, use CSS Masking (`mask-image`). While `clip-path` is excellent for geometric shapes or vector paths, `mask-image` allows you to use images (like PNGs with transparency) or SVGs to define the visible area of an element. This approach is more expressive because it supports semi-transparency, allowing for soft edges and complex textures that are difficult or impossible to achieve with `clip-path`.

## Implementation
To implement complex shapes using CSS masks:

### Using transparency from an image
You can use the transparency of an image as a mask, with opaque parts visible and transparent parts hidden. This can be a PNG, SVG, or other image with transparency, or a generated image, like a CSS gradient.

```css
.shaped-element {
  /* MANDATORY: Use vendor prefix for wider support in older browsers */
  -webkit-mask-image: url('mask.svg');
  -webkit-mask-size: cover; /* Scale mask to cover element */
  -webkit-mask-repeat: no-repeat; /* Do not tile the mask */

  /* Standard property for modern browsers */
  mask-image: url('mask.svg');
  mask-size: cover;
  mask-repeat: no-repeat;
}
```

### Using an SVG element in HTML
You can also reference a `<mask>` element defined in an inline SVG in your page's HTML. Use `maskContentUnits="objectBoundingBox"` to make the mask scale automatically with the size of the element. This tells the browser to interpret all coordinates inside the mask as fractions from `0` to `1` (like `0.5` for 50%) instead of absolute pixels.

> **Luminance vs. Alpha Masking**: By default, SVG masks use **luminance** (brightness) to determine opacity, where white reveals, black hides, and gray creates semi-transparency. If you want the mask to use the **alpha channel** (transparency) of your SVG shapes instead, you can specify `mask-type: alpha;` in your CSS or `mask-type="alpha"` directly on the SVG `<mask>` element.

```html
<!-- White areas reveal content, gray creates semi-transparency, black or transparent hides it -->
<svg width="0" height="0">
  <defs>
    <!-- objectBoundingBox scales mask coordinates (0 to 1) with the element's size -->
    <mask id="custom-shape" maskContentUnits="objectBoundingBox">
      <!-- Use white shapes to define fully opaque areas -->
      <circle cx="0.5" cy="0.5" r="0.5" fill="white" />
      <!-- Use gray shapes to define semi-transparent/faded areas -->
      <circle cx="0.5" cy="0.5" r="0.25" fill="gray" />
    </mask>
  </defs>
</svg>

<div class="masked-content">
  <!-- Content to be masked -->
</div>

<style>
.masked-content {
  /* Reference the SVG mask ID */
  -webkit-mask-image: url(#custom-shape);
  mask-image: url(#custom-shape);
}
</style>
```

### Fallback strategies
Baseline status for Masks: Newly available. It's been Baseline since 2023-12-07.
Supported by: Chrome 120 (Dec 2023), Edge 120 (Dec 2023), Firefox 53 (Apr 2017), and Safari 15.4 (Mar 2022).

If a browser does not support `mask-image` or the prefixed version:
- The element will not be clipped and will display as a normal rectangle.
- Ensure the content is still readable and the layout does not break without the mask (progressive enhancement).
- Optionally, use feature detection to provide a simpler fallback shape with `clip-path`.

```css
/* Fallback for browsers that do not support masking */
@supports (not (mask-image: url(x))) and (not (-webkit-mask-image: url(x))) {
  .shaped-element {
    /* Use a simple rounded rectangle as fallback */
    clip-path: inset(5% round 15px);
  }
}
```
