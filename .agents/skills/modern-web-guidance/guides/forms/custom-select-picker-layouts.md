# Custom Select Picker Layouts

"Custom Select Picker Layouts" allow developers to break away from the traditional vertical list of options in a `<select>` dropdown. Using `appearance: base-select` and the `::picker(select)` pseudo-element, you can style the options list using modern CSS layout techniques like Grid or Flexbox. This is ideal for color pickers, emoji selectors, or product variants where a visual menu is more effective than a list.

The CSS property `appearance: base-select` unlocks the ability to style the internal parts of a `<select>` element. By targeting `select::picker(select)`, you can apply `display: grid` and position options in columns, creating a rich visual experience without custom JavaScript.

## How to Implement

To implement a custom select picker layout:

1. **Activate Base Styling:** Apply `appearance: base-select` to both the `<select>` element and its internal picker pseudo-element `select::picker(select)`.
2. **Style the Picker Container:** Target `select::picker(select)` and apply `display: grid` (or `display: flex`). Define columns and gaps as you would for any container.
3. **Style Options:** Target the `<option>` elements to style them as grid items or cards. You can add images, SVGs, or complex layouts inside them.
4. **Customize the Trigger (Optional):** Use `<selectedcontent>` inside a `<button>` to render rich content for the selected value.

## Example Code: Custom Grid Picker

```html
<label for="weather-picker">Select weather</label>
<select class="grid-picker" name="weather" id="weather-picker">
  <button>
    <selectedcontent></selectedcontent>
  </button>
  <option value="sunny">
    <span class="icon">☀️</span>
    <span class="label">Sunny</span>
  </option>
  <option value="cloudy">
    <span class="icon">☁️</span>
    <span class="label">Cloudy</span>
  </option>
  <!-- More options... -->
</select>
```

```css
/* Activate the customizable select state */
.grid-picker,
.grid-picker::picker(select) {
  appearance: base-select;
}

/* Style the dropdown list as a grid */
.grid-picker::picker(select) {
  display: grid;
  grid-template-columns: repeat(2, 1fr); /* 2 columns */
  gap: 10px;
  padding: 15px;
  background: white;
  border: 1px solid #ccc;
  border-radius: 8px;
}

/* Style options as grid cards */
.grid-picker option {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 15px;
  border: 1px solid #eee;
  border-radius: 6px;
}

/* MANDATORY: Use multiple visual indicators (distinct border thickness, background shift, and font weight) for the checked state to avoid color-only state communication */
.grid-picker option:checked {
  border: 2px solid #007bff;
  background-color: #f0f7ff;
  font-weight: 700;
}
```

## Strategic Implementation & Best Practices

- **DO** use `appearance: base-select` when you need to change the visual layout of options from a standard list to a 2D grid or custom flex flow.
- **DO NOT** assume the styles apply to all browsers equally yet; verify support and provide a fallback.
- **MANDATORY Accessibility Routing**: A native `<select>` element enforces one-dimensional linear arrow-key navigation (Up/Down). Arranging options in a 2D visual grid creates a spatial mismatch where pressing Left/Right arrows does not move focus horizontally between adjacent columns. If true two-dimensional keyboard navigation is essential for usability, do not use a native `<select>`; implement a custom ARIA `role="listbox"` composite widget with manual JavaScript matrix-based arrow key navigation instead.
- **DO** use `<selectedcontent>` if you want the trigger button to show images or icons from the selected option automatically.
- **DO** use standard `value` attributes on options to ensure form submission works exactly as before.
- **DO** ensure your `<select>` has a `name` attribute and an associated `<label>`. This ensures that even with a custom UI, the component remains accessible to screen readers and works correctly with standard form submissions.

## Fallback Strategy

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