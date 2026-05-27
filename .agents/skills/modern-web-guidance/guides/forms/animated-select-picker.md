# Animated Select Picker

The customizable select API offers a declarative, CSS-driven way to animate `<select>` elements and their dropdown pickers. By combining `appearance: base-select` with modern CSS animation techniques—such as `@starting-style` and the `allow-discrete` transition behavior—you can create fluid, premium UI transitions for top-layer elements without relying on heavy JavaScript libraries.

Previously, animating native select dropdowns was impossible because their UI was rendered outside the accessible viewport constraints. With `appearance: base-select`, the picker becomes styleable and animatable like any other page element.

## How to Implement

To implement an animated select picker:

1. **Opt-in to customization:** Apply `appearance: base-select` to both the `<select>` element and the `::picker(select)` pseudo-element.
2. **Enable auto-sizing transitions (Optional):** Define `interpolate-size: allow-keywords` (usually on `:root`) to allow the browser to transition between discrete metric values like `height: auto` and `height: 0`.
3. **Animate the top-layer container:** Apply standard entry/exit styles to `::picker(select)`. To make sure the opacity transition works when moving between `display: none` and `display: block`, you must use `transition-behavior: allow-discrete` (often written inline as `transition: display 0.3s allow-discrete`).
4. **Hook into the opening state with `@starting-style`:** Use `@starting-style` to define the baseline styles the browser should compute *before* the transition begins. For example, if you want it to fade in, set the opacity to `0` inside the `@starting-style` block.
5. **Rotate the icon:** Use pseudo-element focus or active selectors like `:open::picker-icon` to apply transitions (such as rotation or translation) to the arrow indicator.

## Example Code: Smooth Select Scale and Fade

The following example demonstrates a custom select styled with standard page animations for the picker container.

```html
<!-- Always use a <label> linked via 'for' to the select for accessibility -->
<label for="theme-select">Visual Theme</label>
<select id="theme-select" class="animated-select" name="theme">
  <!-- The <button> inside <select> becomes the visible trigger when appearance: base-select is used -->
  <button>
    <!-- <selectedcontent> automatically displays the content of the chosen <option> -->
    <selectedcontent></selectedcontent>
  </button>
  <option value="system">
    <!-- MANDATORY: Decorative inline SVGs MUST set aria-hidden="true" to prevent redundant screen reader announcement -->
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
      <line x1="8" y1="21" x2="16" y2="21"></line>
      <line x1="12" y1="17" x2="12" y2="21"></line>
    </svg>
    System Default
  </option>
  <option value="light">
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
    Light UI
  </option>
</select>
```

```css
/* Opt-in to customizable select */
.animated-select,
.animated-select::picker(select) {
  appearance: base-select;
}

/* Enable auto-keyword transitions (usually set globally at :root) */
:root {
  interpolate-size: allow-keywords;
}

/* Style the visible trigger and icon rotation */
.animated-select {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.875rem 1rem;
  font-size: 1rem;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.animated-select::picker-icon {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.animated-select:open::picker-icon {
  transform: rotate(180deg);
}

/*
 * The Picker Container
 * Uses top-layer animations with `allow-discrete` visibility hooks
 */
.animated-select::picker(select) {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 25px -3px rgba(0,0,0,0.1);
  padding: 0.5rem;
  margin-top: 0.25rem;
  width: anchor-size(width);
  overflow: hidden;

  /* The crucial transition setting for popover animations */
  transition:
    display 0.4s allow-discrete,
    overlay 0.4s allow-discrete,
    opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1),
    height 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  opacity: 0;
  height: 0;
}

/* Open State */
.animated-select:open::picker(select) {
  opacity: 1;
  height: auto;
}

/* @starting-style to hook the transition on initial popover open */
@starting-style {
  .animated-select:open::picker(select) {
    opacity: 0;
    height: 0;
  }
}

/* Support for SVG inside Options and Selected Content */
.animated-select option svg,
.animated-select selectedcontent svg {
  flex-shrink: 0; /* Prevent icons from shrinking */
  width: 1.25rem;
  height: 1.25rem;
}

/* MANDATORY: Provide multiple indicators (e.g. bold font and distinct background) for the checked state to avoid color-only state communication */
.animated-select option:checked {
  font-weight: 700;
  background-color: #f1f5f9;
}

/* Ensure copy-paste safety for users with motion sensitivities */
@media (prefers-reduced-motion: reduce) {
  .animated-select::picker(select),
  .animated-select::picker-icon {
    transition: none !important;
  }
}
```

## Strategic Implementation & Best Practices

- **DO** use `@starting-style` when you need animations to trigger exactly when an element transitions from `display: none` to visible.
- **DO NOT** use ad-hoc scroll locking. Top-layer elements managed by ‘base-select’ should allow natural backdrop dismiss behaviors.
- **DO** verify reduced motion preferences. Always wrap animation constraints in a `prefers-reduced-motion` media query to ensure accessible environments for those affected by motion sickness.
- **DO** test layout behavior. Setting `appearance: base-select` removes the default browser behavior of sizing the select based on its longest option width. You may need to set a fixed width or use flex/grid constraints to prevent layout shifts.
- **DO** ensure your `<select>` has a `name` attribute and an associated `<label>`. This ensures that even with a custom UI, the component remains accessible to screen readers and works correctly with standard form submissions.

## Fallback strategies

### Fallbacks & browser support for Customizable <select>

Customizable <select> has limited availability.
Supported by: Chrome 135 (Apr 2025) and Edge 135 (Apr 2025).
Unsupported in: Firefox and Safari.

For browsers that do not yet support `appearance: base-select`, the `<select>` element degrades gracefully to a standard operating system dropdown.

- **Non-Text Content Ignored**: Older browsers strip HTML tags (like `<svg>` or `<div>`) inside `<option>` tags and render only the text nodes. Ensure the text content of the `<option>` is readable and meaningful on its own.
- **HTML Structure Handling**: Standard parsers may ignore the `<button>` and `<selectedcontent>` tags inside `<select>` or treat them as invalid. No heavy JavaScript polyfills are strictly required for progressive enhancement if you view standard text as a readable fallback.


```javascript
document.addEventListener("DOMContentLoaded", () => {
  // Check if browser supports base-select value
  if (!CSS.supports("appearance", "base-select")) {
    // Custom select overrides are not supported natively.
  }
});
```
