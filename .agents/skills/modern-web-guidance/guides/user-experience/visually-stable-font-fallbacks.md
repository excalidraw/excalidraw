When web fonts load, they often replace a fallback font that has different dimensions, even if both are set to the same `font-size`. This causes "layout shift" (Cumulative Layout Shift) and can make text illegible if the fallback's lowercase letters (x-height) are significantly different than the preferred font.

The `font-size-adjust` property solves this by normalizing the size of the font based on a specific metric (usually the x-height), ensuring that text occupies the same visual space regardless of which font is currently active.

## Implementation steps

### 1. Identify the aspect ratio of your preferred font
To normalize fallbacks, you need the "aspect value" (the ratio of lowercase letters to the font size) of your primary font.

*   **Automatic discovery (Recommended):** Use the `from-font` keyword to let the browser extract the ratio from your primary web font.
*   **Manual calculation:** If you know the specific value (e.g., 0.545 for Verdana), you can provide it directly for more precise control.

### 2. Apply font-size-adjust to the text container
Apply the property to the element or a parent container. This ensures that if the primary font fails to load or is in the process of loading, the fallback font is scaled to match the visual size of the primary font.

```css
.text-content {
  /* Define your font stack as usual */
  font-family: "MyWebFont", "Arial", sans-serif;
  font-size: 1rem;

  /* MANDATORY: Normalize the font size based on the primary font's x-height.
     This ensures that if 'Arial' is used as a fallback, it is scaled 
     to match the x-height of 'MyWebFont'. */
  font-size-adjust: from-font;
}
```

### 3. (Optional) Adjust for specific metrics
While x-height is the default and most common, you can normalize by other metrics like `cap-height` (useful for all-caps headers) or `ch-width` (useful for monospaced fonts).

```css
h1 {
  /* Normalize based on the height of capital letters */
  font-size-adjust: cap-height from-font;
}
```

### 4. Verify visual stability
Ensure that the `font-size-adjust` value correctly aligns the fallback. You can test this by temporarily blocking the web font or adjusting the `font-family` declaration in your browser's DevTools and verifying that the text layout remains stable.

## Fallback strategies

Baseline status for font-size-adjust: Newly available. It's been Baseline since 2024-07-25.
Supported by: Chrome 127 (Jul 2024), Edge 127 (Jul 2024), Firefox 118 (Sep 2023), and Safari 17 (Sep 2023).

In browsers that do not support `font-size-adjust`, the font will be rendered at its default scale. This may result in layout shifts or changes in readability during font swaps. 

To mitigate this without `font-size-adjust`, you can use the `@font-face` descriptors `size-adjust`, `ascent-override`, and `descent-override` to manually tune fallback fonts, though these are more complex to calculate than a single `font-size-adjust` value.
