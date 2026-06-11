## Overview
To apply realistic weathering or texture patterns (like grunge, noise, or paper texture) to an element, use CSS Masking (`mask-image`) with a repeating texture image. This allows you to make the content itself appear textured by making parts of it semi-transparent, rather than just overlaying a texture on top. This creates a more realistic physical material appearance.

## Implementation
To apply a texture pattern:

### Method 1: Using a repeating raster image (Recommended for realistic textures)
This is the most common method for realistic textures.

```css
.weathered-element {
  /* MANDATORY: Use vendor prefix for wider support in older browsers */
  -webkit-mask-image: url('grunge-pattern.png');
  -webkit-mask-repeat: repeat; /* Repeat the pattern to fill the area */
  -webkit-mask-size: 300px; /* Control the scale of the texture */

  /* Standard property for modern browsers */
  mask-image: url('grunge-pattern.png');
  mask-repeat: repeat;
  mask-size: 300px;
}
```

### Method 2: Using CSS Gradients for geometric patterns
You can generate patterns using CSS gradients. This is self-contained and does not require external image files.

```css
.patterned-element {
  --checkerboard-gradient: 
    linear-gradient(45deg, #000 25%, transparent 25%), 
    linear-gradient(-45deg, #000 25%, transparent 25%), 
    linear-gradient(45deg, transparent 75%, #000 75%), 
    linear-gradient(-45deg, transparent 75%, #000 75%);

  /* Apply a checkerboard pattern as a mask */
  -webkit-mask-image: var(--checkerboard-gradient);
  -webkit-mask-size: 20px 20px;
  -webkit-mask-position: 0 0, 0 10px, 10px -10px, -10px 0px;
  
  mask-image: var(--checkerboard-gradient);
  mask-size: 20px 20px;
  mask-position: 0 0, 0 10px, 10px -10px, -10px 0px;
}
```

### Alpha vs Luminance Masking Modes

By default, CSS masks use `mask-mode: match-source`. This means the browser automatically decides whether to use the **alpha channel** (transparency) or the **luminance** (brightness) of the mask based on what kind of source you provide:

| Mask Source Type | Default Mask Mode | Masking Behavior |
| :--- | :--- | :--- |
| **Inline SVG `<mask>` element** | `luminance` | Opacity is determined by the brightness of colors. **White** reveals content, **black** hides it, and **gray** creates semi-transparency. |
| **Direct Image File** (e.g. PNG, SVG file) | `alpha` | Opacity is determined by transparency. **Opaque** parts reveal content, and **transparent** parts hide it. |
| **CSS Gradient** | `alpha` | Opacity is determined by transparency. **Opaque** colors (like `black`) reveal content, and **transparent** colors hide it. |

> **Note:** You can explicitly override the default mask mode using the `mask-mode` CSS property (e.g., `mask-mode: luminance;` or `mask-mode: alpha;`).

## Fallback strategies
Baseline status for Masks: Newly available. It's been Baseline since 2023-12-07.
Supported by: Chrome 120 (Dec 2023), Edge 120 (Dec 2023), Firefox 53 (Apr 2017), and Safari 15.4 (Mar 2022).

If a browser does not support `mask-image` or the prefixed version:
- The element will display without the texture (clean and solid fill).
- Ensure the content is still readable without the texture (progressive enhancement).
- You can use a background image or an overlay as a fallback to simulate the texture, although it will not affect the transparency of the content itself.

```css
/* Fallback: Use a background image for browsers without mask support */
@supports (not (mask-image: url(x))) and (not (-webkit-mask-image: url(x))) {
  .weathered-element {
    /* Fallback adds texture on top or behind, depending on implementation */
    background-image: url('grunge-pattern.svg');
    background-color: #fff; /* Ensure background is solid if needed */
  }
}
```
