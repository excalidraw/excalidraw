# Overflow Clipping Control

While `overflow: hidden` is a "blunt instrument" that almost always clips content strictly at the padding-box, `overflow: clip` combined with `overflow-clip-margin` provides the "scalpel" for fine-grained layout control across block containers.

Specify exactly where clipping occurs with `overflow: clip` and `overflow-clip-margin`. You can align the boundary precisely with inner box-model edges or extend the clipping boundary beyond the element's box by a specified offset (a safety margin). This modern approach is highly performant and eliminates the legacy requirement of adding extra wrapper containers with custom padding and negative margins just to let visual effects (like prominent child element shadows) render unclipped.

Replaced elements (`<img>`, `<video>`, `<canvas>`, etc.) default to `overflow: clip` and `overflow-clip-margin: content-box`, giving you control to cleanly contain images that use `object-fit` or `border-radius`. 

## How to Implement

1. **Apply `overflow: clip`**: Ensure the target element has `overflow: clip` enabled. Setting `overflow: clip` is **mandatory** on block layout containers for `overflow-clip-margin` to take effect. If `overflow` is set to `hidden`, `auto`, or `scroll`, the `overflow-clip-margin` property is ignored by the browser. `overflow: clip` prevents all scrolling (both user-initiated and programmatic via JavaScript).
2. **Align to a Box-Edge**: Use keywords to precisely align the clipping boundary to inner box-model edges:
   - `content-box`: Clips content exactly where the content area begins, leaving the padding area completely clean. Content stops right at the padding's edge. Excellent for nested layout modules.
   - `padding-box` (Default): Clips content at the inner edge of the border.
   - `border-box`: Clips content at the outer edge of the border, allowing content to sit under or partially overlap a translucent border.
3. **Define a Specified Offset (The Bleed)**: Provide a length value (e.g., `15px` or `5px`) to create a safety zone before cutting pixels. This allows prominent child element shadows to render unclipped past the boundary edge without expanding layout geometry.
4. **Combine Box-Edge and Offset**: Specify both a box edge and a length offset simultaneously (e.g., `content-box 15px`) to offset from a specific box edge.

## Example Code

The following examples demonstrate dynamic container layout controls, showcasing automated inner content curve nested framing and child element shadow protection alongside progressive enhancement fallbacks.

### Block Containers: Nested Rounded Curves

* Apply `overflow-clip-margin: content-box` to a parent container with rounded corners and custom padding.
* Apply similar rounded corners on inner child media and footer components along the concentric inner content box boundary, solving awkward nesting curves without custom `calc()` logic.

```html
<div class="nested-curve-parent">
  <img src="avatar.jpg" alt="Nested Curve Demo">
  <div class="nested-curve-footer">Card Footer</div>
</div>
```

```css
/**
 * Standard block layout container with outer corner radii and padding.
 * Keeps base level 1 fallback clipping roughly at the inner padding box.
 */
.nested-curve-parent {
  /* Level 1 Fallback: clips child roughly at the padding box */
  overflow: hidden;
}

/* Inner footer component with 12px rounded to visually demonstrate automatic concentric corner clipping */
.nested-curve-footer {
  background: #111;
  color: #fff;
}

@supports (overflow-clip-margin: content-box) {
  .nested-curve-parent {
    /* MANDATORY: overflow: clip is required on non-replaced elements */
    overflow: clip;
    /* Automatically curves clipping edge to match inner content-box radius */
    overflow-clip-margin: content-box;
  }
}
```

### Block Containers: Child Element Shadow Bleed

* Apply `overflow: clip` and define an extended `overflow-clip-margin` length offset to create a visible safety zone permitting the child's shadow to render unclipped outside the parent container without altering layout geometry. Without this, the child's shadow is clipped at the parent's boundary.

```html
<div class="safety-zone-parent">
  <h4>Clipped Container</h4>
  <p>Inner content boundaries safely contained.</p>
  <!-- Child button element positioned inside with a prominent shadow -->
  <button class="demo-glowing-btn">Submit</button>
</div>
```

```css
/**
 * Standard block layout container clipping inner content.
 * Base fallback uses overflow: hidden, which abruptly slices child element shadows.
 */
.safety-zone-parent {
  /* Level 1 Fallback: clips overflowing content but truncates child shadows */
  overflow: hidden;
}

/* Child button element positioned inside with an expanded shadow */
.demo-glowing-btn {
  display: block;
  box-shadow: 0 8px 13px rgba(229, 46, 113, 0.7);
}

@supports (overflow-clip-margin: 15px) {
  .safety-zone-parent {
    overflow: clip;
    /* Establishes a visible safety zone allowing child element shadows to render safely outside */
    overflow-clip-margin: 15px;
  }
}
```

## Strategic Implementation & Best Practices

- **DO** apply `overflow: clip` on target elements when utilizing `overflow-clip-margin`, as setting `overflow` strictly to `clip` is **mandatory** on standard block layout containers to activate custom or inner curved clip margins.
- **DO** set `overflow-clip-margin: content-box` on padded containers with rounded corners to automatically clip unrounded internal child elements into mathematically perfect nested border curves without manual padding subtraction logic.
- **DO** configure `overflow-clip-margin` with a specified length offset when applying external visual effects (like `filter: drop-shadow()`) to prevent sharp bounding box truncation without altering or expanding layout geometry.
- **DO NOT** apply `overflow: clip` if the container requires programmatic scroll manipulation via JavaScript or serves as the immediate layout context for `position: sticky` elements, as `clip` completely disables scrolling.

## Fallback Strategies

Baseline status for overflow: clip: Widely available. It's been Baseline since 2022-09-12.
Supported by: Chrome 90 (Apr 2021), Edge 90 (Apr 2021), Firefox 81 (Sep 2020), and Safari 16 (Sep 2022).
overflow-clip-margin has limited availability.
Supported by: Firefox 148 (Feb 2026).
Unsupported in: Chrome, Edge, and Safari.

For target environments lacking native support for `overflow: clip` or `overflow-clip-margin`, progressive enhancement fallback strategies depend directly on the visual intent:
- Fallback to `overflow: hidden` as the base experience to guarantee core boundaries are maintained.
- Fallback to `overflow: visible` on elements where drop-shadows or external corner badges must not be truncated.

### Complete Progressive Enhancement Fallback Implementation

```html
<!-- 1. Nested rounded edges fallback -->
<div class="demo-container-fallback">
  <img src="example.jpg" alt="Nested Curve Fallback">
  <div class="demo-footer-fallback">Footer</div>
</div>

<!-- 2. Child element shadow bleed fallback -->
<div class="demo-safety-parent">
  <h4>Container</h4>
  <p>Inner boundaries contained.</p>
  <button class="demo-glowing-btn">Submit</button>
</div>
```

```css
/**
 * 1. Block Container Nested Curves Fallback
 * Keeps base level 1 fallback clipping roughly at the inner padding box.
 */
.demo-container-fallback {  
  /* Level 1 Fallback: clip child roughly at padding box */
  overflow: hidden;
}

.demo-container-fallback img {
  object-fit: cover;
  display: block;
}

@supports (overflow-clip-margin: content-box) {
  .demo-container-fallback {
    overflow: clip;
    overflow-clip-margin: content-box;
  }
}

/**
 * 2. Child Element Shadow Bleed Fallback
 * Base fallback clips content using overflow: hidden, abruptly truncating child element shadows.
 */
.demo-safety-parent {  
  /* Level 1 Fallback */
  overflow: hidden;
}

.demo-glowing-btn {
  display: block;
  width: 100%;
  padding: 6px 12px;
  background: #e52e71;
  box-shadow: 0 8px 13px rgba(229, 46, 113, 0.65);
}

@supports (overflow-clip-margin: 15px) {
  .demo-safety-parent {
    overflow: clip;
    overflow-clip-margin: 15px;
  }
}
```