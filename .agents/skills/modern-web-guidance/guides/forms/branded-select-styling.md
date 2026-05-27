# Branded Select Styling

The customizable select API offers a declarative, CSS-driven way to style `<select>` elements to perfectly match your brand's design system. By opting into `appearance: base-select`, you gain access to the internal shadow DOM of the select element, allowing you to style the button, the options picker list, the arrow icon, and the checkmark indicator using standard CSS properties.

Previously, achieving a fully branded select required rebuilding the control from scratch with JavaScript, which often broke accessibility, keyboard navigation, and native form integration. With `appearance: base-select`, you get a custom look while the browser handles focus management, top-layer rendering, and accessibility bindings.

## How to Implement

To implement branded select styling:

1. **Opt-in to customization:** Apply `appearance: base-select` to both the `<select>` element and the `::picker(select)` pseudo-element (which targets the drop-down list of options).
2. **Structure the custom button (Optional):** Define a `<button>` element directly inside the `<select>` to replace the default trigger. Use the `<selectedcontent>` element inside this button to represent the text or content of the currently selected option.
3. **Style the Picker List:** Use the `::picker(select)` pseudo-element to apply typography, background colors, borders, and shadows to the dropdown list. The browser renders this in the top-layer, making `z-index` conflicts a thing of the past.
4. **Style Internal Icons:**
   - Use `select::picker-icon` to style or replace the arrow icon.
   - Use `option::checkmark` to style the checkmark indicator next to the active option.
5. **Style Options:** Apply styles to `<option>` elements for hover states, padding, and layout.

## Example Code: Branded Courier Select

The following example demonstrates a custom select styled with a monospace font and dashed borders to match a specific "parcel" brand aesthetic.

```css
/* Enable customization for the select and its picker */
.brand-select,
.brand-select::picker(select) {
  appearance: base-select;
}

/* Style the visible trigger button */
.brand-select {
  font-family: 'Courier New', monospace;
  background-color: #fffaf0;
  color: #8b4513;
  border: 2px dashed #8b4513;
  border-radius: 4px;
  padding: 0.75rem;
  font-size: 1rem;
  cursor: pointer;
}

/* Style the dropdown options list */
.brand-select::picker(select) {
  font-family: 'Courier New', monospace;
  background-color: #fffaf0;
  border: 2px dashed #8b4513;
  border-radius: 4px;
  padding: 0.5rem;
}

/* Customize internal part colors to match text */
.brand-select::picker-icon {
  color: #8b4513;
}

.brand-select option::checkmark {
  color: #8b4513;
}

/* Style individual options and hover effects */
.brand-select option {
  padding: 0.5rem;
  border-radius: 4px;
  color: #8b4513;
  cursor: pointer;
}

.brand-select option:hover {
  background-color: #fdf5e6;
}
```

```html
<label for="preferences">Select shipping preference</label>
<select class="brand-select" id="preferences" name="preferences">
  <button>
    <selectedcontent></selectedcontent>
  </button>
  <option value="standard">Standard Shipping</option>
  <option value="express" selected>Express Shipping</option>
  <option value="overnight">Overnight Delivery</option>
</select>
```

## Strategic Implementation & Best Practices

- **DO** use `appearance: base-select` when your design system requires high-fidelity, visual consistency across all form controls that cannot be achieved with standard cross-browser select overrides.
- **DO NOT** use this if you rely on the operating system's native picker experience (e.g., the standard scroll wheel picker on iOS devices). Opting into `base-select` opts out of native mobile UI controls in favor of web-rendered top-layer menus.
- **DO** verify that color contrast meets WCAG standards. The customizable picker allows you to set ad-hoc colors, but you are responsible for ensuring text remains legible against custom backgrounds.
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
