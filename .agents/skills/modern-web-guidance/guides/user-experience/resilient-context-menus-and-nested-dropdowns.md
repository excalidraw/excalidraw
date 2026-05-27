A revealed action panel or popover button group is a useful pattern for users to access additional functionality while taking up minimal space. This overlay pattern comes with layout complexity, as the panel must remain tethered to a trigger element while adapting to viewport constraints. Traditionally, this required complex JavaScript libraries (like Popper.js or Floating UI) to calculate positions and handle collisions.

CSS Anchor Positioning provides a declarative, performance-optimized way to handle these relationships entirely in CSS, allowing browsers to manage the positioning and overflow logic natively.

> [!NOTE]
> This guide demonstrates anchor-positioning and popover mechanics — it does not prescribe a specific accessible UI pattern. The trigger and panel below are shown as a plain **button-revealing-a-button-group**. If you need a true ARIA menu (`role="menu"` with arrow-key navigation), a combobox, a disclosure widget, or any other named pattern, layer that pattern's full semantics and keyboard contract on top of the positioning techniques shown here.

### 1. Define the Button and Panel Relationship

The first step is to create a trigger button that opens the overlay container using the Popover API.

**MANDATORY Accessibility Distinction:** This pattern explicitly models a **button group revealed inside a popover** rather than a true ARIA menu. Do not apply `role="menu"` or `role="menuitem"` unless you fully implement the corresponding keyboard navigation contract (such as handling spatial arrow-key navigation between items). For the same reason, do not add `aria-haspopup` to the trigger — its value (`menu`, `listbox`, `tree`, `grid`, or the legacy `true`) is a promise that the target exposes a matching role, which this pattern does not.

```html
<button popovertarget="action-panel">
  Open Actions
</button>
<!-- Use the Popover API (`popover="auto"`) for the overlay to ensure it is placed in the top layer and handled accessibly by the browser. -->
<div id="action-panel" popover="auto" class="panel">
  <button class="action-item" type="button">Edit</button>
</div>
```

This creates an *implicit* anchor association between the button and the panel, so that the panel can be positioned relative to the button.

### 2. Positioning with `position-area`

Instead of manual `top`/`left` offsets, use `position-area` to place the target on a 3x3 grid relative to the anchor.

```css
.panel {
  /* 
     Position the panel below the anchor (block-end), 
     aligned to the start of the anchor and spanning to its end (span-inline-end).
  */
  position-area: block-end span-inline-end;
  
  /* Reset insets to allow the grid to take control */
  inset: auto;
}
```

Prefer logical keywords (`span-inline-end`, `block-start`) over physical ones (`left`, `top`) to support RTL and different writing modes automatically.

**MANDATORY**: Do not mix physical and logical keywords in `position-area`.

### 3. Implement Edge-Resilience (Fallbacks)

To prevent the panel from being cut off at the edge of the screen, define "try tactics" that the browser should attempt if the default position overflows.

```css
.panel {
  /* 
     If the panel overflows the bottom, flip it to the top (flip-block).
     If it overflows the inline edges, flip it horizontally (flip-inline).
  */
  position-try-fallbacks: flip-block, flip-inline;
}
```

## Fallback strategies

Baseline status for Popover: Newly available. It's been Baseline since 2025-01-27.
Supported by: Chrome 116 (Aug 2023), Edge 116 (Aug 2023), Firefox 125 (Apr 2024), Safari 17 (Sep 2023), and Safari iOS 18.3 (Jan 2025).

Popover must conditionally be polyfilled with the `@oddbird/popover-polyfill` polyfill.

```html
<script type="module">
  if(!HTMLElement.prototype.hasOwnProperty("popover")){
    await import("https://unpkg.com/@oddbird/popover-polyfill@latest");
  }
</script>
```

Anchor positioning is not natively supported by any major browser yet.

To support browsers without anchor positioning, you must set a reasonable position. By default popovers are centered in the middle of the screen, which may work for your use case.

For some use cases, you may be able to use the `@oddbird/css-anchor-positioning` polyfill, which adds support for some anchor positioning use cases. It does not support implicit anchors, so you MUST add anchor names to the trigger. Additionally, `position-area` is not supported on popovers by the polyfill, so you MUST use `anchor()` on the desired insets. 

```html
<!-- MANDATORY: Conditionally install the anchor positioning polyfill -->
<script type="module">
  if (!("anchorName" in document.documentElement.style)) {
    await import("https://unpkg.com/@oddbird/css-anchor-positioning");
  }
</script>
```

```css
.panel {
  /* Mandatory: use explicit anchor name */
  position-anchor: --kebab-anchor;
  /* Mandatory: use insets rather that position-area for positioning */
  bottom: auto;
  right: auto;
  top: anchor(bottom);
  left: anchor(left);
  margin: 0;
}
```