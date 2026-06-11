By default, form controls like `<input>`, `<textarea>`, and `<select>` have fixed dimensions. Their sizes remain constant, regardless of the amount of content the user enters or selects.

To allow these controls to automatically shrink or grow to fit their content (including placeholders), use the `field-sizing: content` CSS property.

### Auto-sizing form controls

Setting `field-sizing: content` on inputs, selects, or textareas allows them to resize dynamically as the user types or selects options. However, you must account for inherited styling, layout defaults, and minimum/maximum constraints to ensure a robust user experience.

To prevent layout issues, it is recommended to set both `min-inline-size` (or `min-width`) and `max-inline-size` (or `max-width`) alongside `field-sizing: content` on text inputs. A minimum size prevents the input from collapsing to a width of zero when empty (making it unclickable), and a maximum size ensures it doesn't expand indefinitely and break the page layout.

For textareas, allowing horizontal auto-sizing can cause a jarring UX (e.g., a textarea with a long placeholder will abruptly shrink horizontally when the user types a single character). To prevent this, apply an explicit width (like `width: 100%`) to the textarea. This forces the textarea to maintain a stable horizontal width while still auto-sizing vertically as content wraps.

It is recommended to set a `max-inline-size` (or `max-width`) on `<select>` elements using `field-sizing: content` to ensure that extremely long selected options do not break the page layout.

```css
/* Applies horizontal auto-sizing to inputs */
input {
  /* Instructs the element to size itself to fit its content */
  field-sizing: content;

  /* Reset explicit width if inherited from global styles */
  width: auto;

  /* Prevents the input from collapsing and disappearing when empty */
  min-inline-size: 15ch;

  /* Prevents infinite horizontal growth */
  max-inline-size: 50ch;
}

textarea {
  /* Instructs the element to size itself to fit its content */
  field-sizing: content;

  /* Reset explicit height if inherited from global styles */
  height: auto;

  /* Use a fixed width to prevent jarring horizontal shifts when replacing a long placeholder */
  width: 50ch; /* or 100% depending on your layout */

  /* Sets a reasonable minimum height (e.g., 3 lines) for empty textareas */
  min-block-size: 3lh;

  /* Prevents infinite vertical growth. Once a textarea hits this */
  /* height, it will stop growing and show a vertical scrollbar. */
  max-block-size: 10lh;
}

select {
  /* Sizes the select element to fit the active option only */
  field-sizing: content;

  /* Prevents the dropdown from expanding infinitely and breaking the layout */
  max-inline-size: 50ch;
}
```

IMPORTANT: Explicit `width` and `height` properties override `field-sizing: content` on all form controls. If your project's global CSS sets inputs, selects, or textareas to `width: 100%`, you must explicitly reset them to `width: auto` (or `width: fit-content`) on the elements using `field-sizing: content` for auto-sizing to work. Conversely, you should explicitly set `height: auto` on textareas if a fixed height was previously set globally.

IMPORTANT: Grid and Flexbox layouts often implicitly stretch their children to fill available space. If any form control using `field-sizing: content` refuses to shrink, check its container's alignment properties and apply `align-self: start` or `justify-self: start` to the form control to override the stretching.

### Fallback strategies

field-sizing has limited availability.
Supported by: Chrome 123 (Mar 2024), Edge 123 (Mar 2024), and Safari 26.2 (Dec 2025).
Unsupported in: Firefox.

`field-sizing` should be treated as a progressive enhancement. In browsers that do not support the property, form controls gracefully degrade back to their default, fixed sizing behavior. Users will simply experience standard scrolling for overflowing content inside fixed-size inputs and textareas.

If dynamically growing fields are absolutely required for older browsers, you must use feature detection and a complex workaround. The most robust fallback for textareas uses a CSS Grid trick where a hidden pseudo-element mirrors the user's input in real-time, forcing the grid container (and the textarea inside it) to expand.

```html
<!-- The textarea is wrapped in a container that will mirror its value -->
<div class="growable-textarea" data-replicated-value="">
  <textarea></textarea>
</div>
```

```javascript
// Only attach the fallback event listeners if field-sizing is unsupported
if (!CSS.supports('field-sizing', 'content')) {
  document.querySelectorAll('.growable-textarea > textarea').forEach(textarea => {
    textarea.addEventListener('input', () => {
      textarea.parentNode.dataset.replicatedValue = textarea.value;
    });
  });
}
```

```css
/* Only apply the fallback if field-sizing is NOT supported */
@supports not (field-sizing: content) {
  .growable-textarea {
    display: grid;
  }

  /* The pseudo-element and textarea must share the exact same cell, font, and padding */
  .growable-textarea::after,
  .growable-textarea > textarea {
    grid-area: 1 / 1 / 2 / 2;
    font: inherit;
    padding: 0.5rem;
    border: 1px solid #999;
  }

  /* The pseudo-element renders the copied text invisibly to stretch the grid */
  .growable-textarea::after {
    /* The space is necessary for trailing empty lines to be rendered */
    content: attr(data-replicated-value) " ";
    white-space: pre-wrap;
    visibility: hidden;
  }

  .growable-textarea > textarea {
    resize: none;
    overflow: hidden;
  }
}
```

Given the complexity of duplicating styles and synchronizing state across DOM nodes for every form control, relying on the default fallback behavior of fixed inputs is the recommended approach for most applications unless dynamic sizing is critical to the user experience.