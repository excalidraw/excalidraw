## Overview
CSS Masking allows you to clip an element to a custom shape, such as adding a notch to a card or creating a shaped border. When combining shapes for complex layouts, choose your masking strategy based on the type of content the element contains:

| Masking strategy                | Best For                        | Text Impact                    |
| ------------------------------- | ------------------------------- | ------------------------------ |
| Direct Element SVG Masking      | Images, Icons, Decorative shapes, Complex shapes | Not recommended (can crop text) |
| Adjacent Element SVG Masking    | Cards with Text, Crucial content | Text remains fully readable    |
| Pure CSS Gradients              | Simple Geometric Shapes           | Not recommended (can crop text) |

---

## Implementation
To implement shaped cutouts:

### Using an SVG Mask
SVG masks allow you to define shapes that subtract from or add to the visible area using white (reveal) and black (hide) fills.

> **Luminance vs. Alpha Masking**: SVG masks default to **luminance** (brightness) mode, which is why we use `fill="white"` to reveal areas and `fill="black"` to cut them out. If you prefer to use the SVG's transparency (alpha channel) instead of colors, you can set `mask-type: alpha;` in CSS or `mask-type="alpha"` on the SVG `<mask>` element.

#### Direct Element SVG Masking
When there is no text inside the element to worry about (such as profile avatars, product images, or illustrations), you can apply the SVG mask directly to the element.

Using `maskContentUnits="objectBoundingBox"` inside the SVG mask ensures that the mask scales automatically to the width and height of any element it is applied to.

```html
<!-- 1. Define the mask in SVG (hidden from view) -->
<svg width="0" height="0" style="position: absolute;" aria-hidden="true">
  <defs>
    <!-- objectBoundingBox makes the mask scale from 0 to 1 along the element's borders -->
    <mask id="splat-mask" maskContentUnits="objectBoundingBox">
      <!-- Organic Bezier path defining an artistic paint splat shape -->
      <path d="M 0.5 0.05 C 0.58 0.05, 0.58 0.21, 0.67 0.18 C 0.76 0.15, 0.79 0.08, 0.85 0.15 C 0.91 0.22, 0.83 0.32, 0.89 0.38 C 0.95 0.44, 1.03 0.45, 0.99 0.55 C 0.95 0.65, 0.82 0.62, 0.8 0.72 C 0.78 0.82, 0.89 0.92, 0.8 0.97 C 0.71 1.02, 0.64 0.88, 0.55 0.93 C 0.46 0.98, 0.44 1.06, 0.35 1.01 C 0.26 0.96, 0.31 0.81, 0.22 0.79 C 0.13 0.77, 0.01 0.88, 0.01 0.77 C 0.01 0.66, 0.16 0.62, 0.14 0.52 C 0.12 0.42, -0.02 0.39, 0.03 0.29 C 0.08 0.19, 0.23 0.27, 0.29 0.19 C 0.35 0.11, 0.3 0.01, 0.4 0.01 C 0.5 0.01, 0.42 0.05, 0.5 0.05 Z" fill="white" />
    </mask>
  </defs>
</svg>

<!-- 2. Apply the mask to the image element -->
<img src="avatar.jpg" alt="User Profile" class="shaped-avatar">

<style>
.shaped-avatar {
  width: 200px;
  height: 200px;
  object-fit: cover;
  
  /* Apply the SVG mask ID with standard and webkit-prefixed properties */
  -webkit-mask-image: url(#splat-mask);
  mask-image: url(#splat-mask);
}
</style>
```

#### Adjacent Element SVG Masking
Apply the mask to an adjacent element rather than the parent element containing text. This ensures that text doesn't get clipped and remains readable.

To solve this, structure your component into a two-part layout:
1. A **safe, unmasked text container** (`.card-body`) for all readable content.
2. An **empty decorative `div`** (`.card-accent`) placed next to it, which receives the custom SVG mask.

By assigning both parts the same background color, they visually merge into a single, custom-shaped component.

```html
<!-- 1. Define the SVG mask (hidden from view) -->
<svg width="0" height="0" style="position: absolute;" aria-hidden="true">
  <defs>
    <!-- Use objectBoundingBox to make the mask scale with the element -->
    <mask id="accent-stencil" maskContentUnits="objectBoundingBox">
      <!-- Fill the entire area with white (fully visible) -->
      <rect width="1" height="1" fill="white" />
      <!-- Draw a black shape to cut out a concave curve. Extending the path to x=1.1 guarantees it fully clears the right edge, preventing subpixel lines -->
      <path d="M 1.1,0 C 0.4,0.1 0.4,0.9 1.1,1 L 1.1,0 Z" fill="black" />
    </mask>
  </defs>
</svg>

<!-- 2. Create the unified card layout -->
<div class="unified-card">
  <!-- The text-bearing element remains unmasked and perfectly rectangular -->
  <div class="card-body">
    <h3>Premium Membership</h3>
    <p>Get exclusive weekly updates on modern web standards and premium UI designs.</p>
  </div>
  <!-- The empty accent element next to it is masked to form the custom shape -->
  <div class="card-accent"></div>
</div>

<style>
.unified-card {
  display: flex;
  width: 400px;
}

.card-body {
  flex: 1;
  background-color: #1e293b; /* Elegant slate color */
  color: #f8fafc;
  padding: 24px;
  border-top-left-radius: 16px;
  border-bottom-left-radius: 16px;
}

.card-accent {
  width: 60px;
  background-color: #1e293b; /* Same background color so they merge visually without seams */
  border-top-right-radius: 16px;
  border-bottom-right-radius: 16px;

  /* Reference the SVG mask */
  -webkit-mask-image: url(#card-accent-mask);
  mask-image: url(#card-accent-mask);
}
</style>
```

### Using a Single CSS Gradient for Simple Cutouts
When you only need simple geometric cutouts (such as a semi-circular top notch, side indentations, or straight diagonal cuts), you do not need to write or reference an external SVG. Instead, you can define a CSS radial or linear gradient directly inside the `mask-image` property.

```html
<div class="gradient-masked-card">
  <h3>Notched Coupon Card</h3>
  <p>This card uses a pure CSS radial gradient to cut out a semi-circular notch along its top edge.</p>
</div>

<style>
.gradient-masked-card {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
  padding: 40px 24px 24px 24px; /* Extra top padding ensures content clears the notch */
  border-radius: 16px;
  text-align: center;

  /* radial-gradient places a circle at 50% (horizontal center) and 0% (top edge), cutting out a 20px transparent notch */
  -webkit-mask-image: radial-gradient(circle at 50% 0%, transparent 20px, black 21px);
  mask-image: radial-gradient(circle at 50% 0%, transparent 20px, black 21px);
}
</style>
```

## Fallback strategies
Baseline status for Masks: Newly available. It's been Baseline since 2023-12-07.
Supported by: Chrome 120 (Dec 2023), Edge 120 (Dec 2023), Firefox 53 (Apr 2017), and Safari 15.4 (Mar 2022).

If a browser does not support `mask-image` or the prefixed version:
- **For Shaped Images**: The element will degrade gracefully, displaying as a normal rectangular element with its default fallback styles.
- **For Shaped Cards**: The adjacent decorative `.card-accent` element will remain a solid, unmasked rectangle. Since it shares the same background color as the text container, the entire card will simply render as a standard, clean rectangular container.
- **Progressive Enhancement**: By keeping text layers outside the mask entirely, your content is guaranteed to remain completely readable, structured, and accessible on older browsers.
