When mixing different font families, for instance when inserting inline code snippets, or switching out font families for different themes, differences in "x-height" (the height of lowercase letters) can make one font appear much smaller or larger than the other font. This can lead to poor legibility and layout shifts.

The `font-size-adjust` property allows you to normalize the visual size of text by adjusting the font size based on a specific font metric (usually the x-height).

### Implementation Steps

1.  **MANDATORY**: Apply `font-size-adjust` to elements where font consistency is critical, such as containers using web fonts or blocks with mixed font families.
2.  **MANDATORY**: Use the `from-font` keyword on elements to automatically match font size in nested elements to the proportions of the primary font.
3.  **MANDATORY**: Use a specific numeric aspect-ratio override value for `font-size-adjust` (e.g., `font-size-adjust: 0.5`) to normalize proportions independently when the font proportions to base on are from different themes.

### Example: Normalizing x-height automatically

Using `from-font` is the most robust approach. It extracts the aspect ratio of the x-height from the first available font and applies it to fonts in child elements.

```css
.content-area {
  font-family: "MyCustomWebFont";
  /* Automatically extract and apply x-height ratio from MyCustomWebFont */
  font-size-adjust: from-font;
}
.content-area span{
  font-family: "MyOtherCustomWebFont"
}
```

### Example: Specifying a specific x-height

When the font to adjust is not a child of the font to base the size on, specify a value to adjust the x-height by.

```css
.theme{
  font-family: Verdana, sans-serif;
}
.theme.alternate{
  font-family: Times;
  /* Set to the aspect ratio (x-height / font-size) of the primary font */
  font-size-adjust: 0.51;
}
```

### Fallback strategies

Baseline status for font-size-adjust: Newly available. It's been Baseline since 2024-07-25.
Supported by: Chrome 127 (Jul 2024), Edge 127 (Jul 2024), Firefox 118 (Sep 2023), and Safari 17 (Sep 2023).

**MANDATORY**: In browsers that do not support `font-size-adjust`, fonts will render at their natural `font-size` value. You must provide a valid fallback strategy for non-supporting browsers using a `@supports` block to mitigate this:

- Use `@supports not (font-size-adjust: from-font)` to detect `font-size-adjust` support and provide fallback styles (e.g. adjusted line-height or font-size).
- Choose fonts with similar x-heights to your primary font.
- Apply specific `font-size` and `line-height` overrides for alternate and nested font families.

```css
/* Feature detection for font-size-adjust */
@supports not (font-size-adjust: from-font) {
  .content-area {
    /* Manual adjustment for browsers without support (if needed) */
    line-height: 1.6;
    font-size: 1.2rem;
  }
}
```
