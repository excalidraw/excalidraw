Using resolution-optimized images in CSS pseudo-elements (like `::before` or `::after`) allows you to add decorative icons or structural graphics without cluttering your HTML with extra DOM nodes. By combining pseudo-elements with the `image-set()` CSS function, you can provide the browser with multiple formats (such as AVIF or WebP) and resolutions (like `1x` and `2x`). The browser will automatically choose the most optimal image for the user's device capabilities.

### Implementation

You can use the `image-set()` function directly within the `content` property of a pseudo-element, or within its `background-image` property (while setting `content: ""`). Note that while providing both the image format via `type()` and the resolution (like `1x` or `2x`) yields the best results, both of these arguments are optional.

```css
.icon-button::before {
  /* Using image-set directly in the content property */
  /* MANDATORY: Always order your formats from most optimized (AVIF) to least optimized (JPEG/PNG). 
     The browser will stop at the first supported format. */
  content: image-set(
    url("icon.avif") type("image/avif") 1x,
    url("icon-2x.avif") type("image/avif") 2x,
    url("icon.webp") type("image/webp") 1x,
    url("icon-2x.webp") type("image/webp") 2x,
    url("icon.png") type("image/png") 1x,
    url("icon-2x.png") type("image/png") 2x
  );
  
  display: inline-block;
  margin-right: 8px;
  vertical-align: middle;
}
```

### Fallback strategies

Baseline status for image-set(): Widely available. It's been Baseline since 2023-09-18.
Supported by: Chrome 113 (May 2023), Edge 113 (May 2023), Firefox 89 (Jun 2021), and Safari 17 (Sep 2023).

For older browsers that do not support the `image-set()` function, you **MUST** provide a standard image declaration *before* the `image-set()` rule. This progressive enhancement strategy relies on CSS's cascading nature: unsupported rules are ignored.

```css
.icon-button::before {
  /* MANDATORY: Fallback for browsers that do not support image-set() */
  content: url("icon.png");
  
  /* Modern browsers will apply this and override the fallback */
  content: image-set(
    url("icon.avif") type("image/avif") 1x,
    url("icon-2x.avif") type("image/avif") 2x,
    url("icon.png") type("image/png") 1x,
    url("icon-2x.png") type("image/png") 2x
  );
}
```