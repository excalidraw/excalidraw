# Rich Media Picker (Customizable Select)

The native `<select>` element was historically difficult to style and could only contain plain text options. The `appearance: base-select` property offers a declarative, CSS-only way to opt into a customizable state for the `<select>` element. This allows developers to include rich HTML content—such as images, SVGs, and complex layouts—inside `<option>` elements, while retaining native keyboard accessibility and form integration. Use this pattern to replace heavy, custom-built select components with standard, native elements.

## How to Implement

To implement a rich media picker using the Customizable Select API:

1. **Opt-in to base styles**: Apply `appearance: base-select` to both the `<select>` element and its internal picker using the `::picker(select)` pseudo-element. This changes the browser's HTML parser for the contents inside the `<select>`.
2. **Define the Button Content**: Use standard `<button>` and `<selectedcontent>` elements inside the `<select>` to define what is shown when the picker is closed. The `<selectedcontent>` element automatically mirrors the content of the selected option. This is required if you want to display the currently selected rich content in the button.
3. **Use Rich Content inside Options**: You can now place images, SVGs, and other HTML tags inside `<option>` tags. Prior to this API, the browser would strip tags from `<option>` tags and render only plain text.
4. **Style the Popover**: Style the dropped-down options list by targeting the `::picker(select)` pseudo-element. It renders in the top layer, meaning you don't need to fight with `z-index`. Options are positioned using the Anchor Positioning API natively.

## Example Code: Rich Role Picker

```html
<label for="role-picker">Select your role</label>
<select class="custom-select" name="role" id="role-picker">
  <button>
    <selectedcontent></selectedcontent> <!-- Mirrors the selected option's content automatically so you do not need JS to update the button -->
  </button>

  <!-- Define concise aria-label values on options whose mirrored rich content would otherwise read awkwardly as a concatenated string -->
  <option value="frontend" aria-label="Frontend Developer">
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
    </svg>
    <div class="option-text">
      <span class="option-title">Frontend Developer</span>
      <span class="option-desc">React, Vue, CSS</span>
    </div>
  </option>

  <option value="backend" aria-label="Backend Developer">
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <rect x="2" y="12" width="20" height="14" rx="2" ry="2"></rect>
    </svg>
    <div class="option-text">
      <span class="option-title">Backend Developer</span>
      <span class="option-desc">Node.js, Python</span>
    </div>
  </option>
</select>
```

```css
select.custom-select,
select.custom-select::picker(select) {
  appearance: base-select; /* MUST opt-in both the select and its picker to enable the customizable state, otherwise browser standard rendering applies */
}

select.custom-select {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px;
  background-color: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #f1f5f9;
  cursor: pointer;
}

select.custom-select::picker(select) {
  background-color: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
  width: anchor-size(width); /* Uses Anchor Positioning API to keep the dropdown precisely aligned to the button trigger width */
}

select.custom-select option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 4px;
  cursor: pointer;
}

select.custom-select option:hover {
  background-color: #1e293b;
}

/* Remove standard OS checkmark for base-select */
select.custom-select option::before {
  display: none;
}

/* MANDATORY: Provide multiple visual indicators (e.g., prominent background color and bold title font) to communicate the checked state cleanly */
select.custom-select option:checked {
  background-color: #3b82f6;
  color: #ffffff;
}
select.custom-select option:checked .option-title {
  font-weight: 700;
}
```

## Strategic Implementation & Best Practices

- **DO** use `appearance: base-select` when you need complex options layouts (icons, descriptions, images) that was previously only possible with heavy JavaScript UI frameworks.
- **DO NOT** use ad-hoc elements if you notice performance lags; the browser handles native keyboard focus natively.
- **DO** account for top-layer rendering. The picker renders in the top-layer, meaning it overrides relative `z-index` of page content.
- **DO** hide secondary details (like descriptions) in the button state if they take too much space, by styling `.custom-select selectedcontent .option-desc { display: none; }`.
- **DO** test layout behavior. Setting `appearance: base-select` removes the default browser behavior of sizing the select based on its longest option width. You may need to set a fixed width or use flex/grid constraints to prevent layout shifts.
- **DO** ensure your `<select>` has a `name` attribute and an associated `<label>`. This ensures that even with a custom UI, the component remains accessible to screen readers and works correctly with standard form submissions.

## Fallback Strategies

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
