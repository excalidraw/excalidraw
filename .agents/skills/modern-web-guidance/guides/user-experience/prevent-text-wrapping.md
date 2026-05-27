# Prevent text wrapping

Modern CSS provides the `text-wrap` property to control how text breaks within its container. To ensure text stays on a single line and ignores container boundaries, use `text-wrap: nowrap`. This is the modern, more semantic replacement for `white-space: nowrap`.

Preventing text wrapping is useful for UI elements like navigation tabs, horizontal scrolling chips, or any scenario where a line break would break the layout or visual design.

## How to implement `text-wrap: nowrap`

### Basic Usage

To prevent any automatic line breaks, apply `text-wrap: nowrap` to the element containing the text.

1. **MANDATORY**: Apply `text-wrap: nowrap` to the target element.
2. **OPTIONAL**: Use an `overflow` property (such as `hidden`, `scroll`, or `auto`) to manage the resulting overflow.
3. **OPTIONAL**: Use `text-overflow: ellipsis` to provide a visual cue when text is truncated. Note: This requires `overflow: hidden`.

### Example code

```css
.no-wrap-text {
  /* MANDATORY: Prevents automatic line breaks */
  text-wrap: nowrap;

  /* OPTIONAL: Handles the overflow visually */
  overflow: hidden;
  text-overflow: ellipsis;

  /* OPTIONAL: Constrain width to force and handle overflow within this element */
  max-width: 200px;
}
```

### Specific Control with Longhands

The `text-wrap` property is a shorthand for `text-wrap-mode` (whether text wraps) and `text-wrap-style` (how it wraps). Since `text-wrap-style` is ignored when wrapping is disabled, you should generally stick to the `text-wrap` shorthand.

While the longhand `text-wrap-mode: nowrap` exists, the property name is currently considered a placeholder by the CSS Working Group and may change in the future.

```css
.granular-control {
  /* Modern longhand equivalent to white-space: nowrap */
  /* Preferred: text-wrap: nowrap; */
  text-wrap-mode: nowrap;
}
```

### Fallback strategies

Baseline status for text-wrap: Newly available. It's been Baseline since 2024-10-17.
Supported by: Chrome 130 (Oct 2024), Edge 130 (Oct 2024), Firefox 124 (Mar 2024), and Safari 17.5 (May 2024).

For browsers that do not yet support `text-wrap`, use the legacy `white-space` property. Modern browsers treat `white-space` as a shorthand for setting both the `text-wrap-mode` and `white-space-collapse` properties.

```css
.no-wrap-with-fallback {
  /* Fallback for older browsers */
  white-space: nowrap;

  /* Modern standard */
  text-wrap: nowrap;
}
```
