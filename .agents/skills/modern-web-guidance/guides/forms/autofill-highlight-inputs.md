# Use the CSS :autofill pseudo-class to highlight form fields that have been autofilled by the browser and not edited by the user

Use the CSS `:autofill` to highlight fields that have (or have not been) autofilled, to help guide the user to successful form completion.

## How to implement

To highlight a form field that has been autofilled by the browser (and not edited by the user) add a selector to your CSS using the `:autofill` class. This can be used for an `<input>`, `<select>`, or `<textarea>` element.

When styling autofilled states, you must adhere to accessibility best practices:
- **Multiple State Indicators**: Do not rely on border color alone to indicate the autofilled state. Use multiple indicators such as border thickness and custom background shading to ensure the state is perceivable.
- **Preserve Focus Indicators**: Never remove focus outlines (`outline: none`) without providing a clear, high-contrast replacement for keyboard users.

The following example uses `:autofill` to set a custom border and background, along with explicit focus styles:

```css
input:autofill,
input:-webkit-autofill {
  /* Multiple indicators: use both a distinct border and background color via box-shadow to avoid color-only state */
  border: 2px solid #2e7d32;
  box-shadow: 0 0 0 100vmax #e8f5e9 inset;
}

/* MANDATORY: Always provide an explicit focus indicator when styling autofilled states */
input:autofill:focus-visible,
input:-webkit-autofill:focus-visible {
  outline: 3px solid #000;
  outline-offset: 2px;
}
```

As shown in this example, the `box-shadow` property is used to customize the background, since `background-color` cannot be overridden directly on autofilled fields.

## Use the correct CSS pseudo-class name

**Do not** use `:auto-fill`: this is incorrect.

MANDATORY: Use `:autofill` as this is the correct pseudo-class name.

### Fallback strategies

:autofill has limited availability.
Supported by: Chrome 110 (Feb 2023), Edge 110 (Feb 2023), and Safari 15 (Sep 2021).
Unsupported in: Firefox.

The `:autofill` pseudo-class is a progressive enhancement. In browsers that do not support it, the form will still function normally, but the inputs will simply not receive the custom autofill highlighting. Users will still be able to successfully complete the form. No additional JavaScript fallback should be used.
