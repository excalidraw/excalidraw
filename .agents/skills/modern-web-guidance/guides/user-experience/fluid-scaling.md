## Overview

Fluid scaling allows components to adjust their internal proportions (like font sizes and spacing) based on their current dimensions. This creates a more cohesive design than jumping between fixed breakpoints.

While fluid scaling was historically achieved using viewport units (scaling based on the screen size), modern container query units allow components to scale relative to their parent container instead. This ensures components look good regardless of where they are placed in a layout, promoting better component isolation and reusability.

## Implementation

### 1. Define a container

To use container query units, you must first define a containment context on a parent element.

```css
.component-wrapper {
  /* Define the container type. Use 'inline-size' for width-based scaling. */
  /* You can also use 'size' for both width and height, but it requires explicit sizing. */
  container-type: inline-size;
  
  /* Optional: Name the container for specific targeting */
  container-name: fluid-card;
}
```

### 2. Use container query units

Use container query units (`cqi`, `cqb`, etc.) to set sizes relative to the container's dimensions.

*   `cqi`: 1% of the container's inline size (width in horizontal writing modes).
*   `cqb`: 1% of the container's block size (height in horizontal writing modes).

**Note**: Container units can be used directly on any property without needing an `@container` query rule. They automatically resolve based on the nearest ancestor with a defined `container-type`.

```css
.component-title {
  /* Scale font size based on container width */
  /* 10cqi means 10% of the container's width */
  font-size: 10cqi;
}

.component-body {
  /* Scale padding based on container width */
  padding: 5cqi;
}
```

### 3. Constrain values with `clamp()`

To prevent sizes from becoming too small or too large, use the CSS `clamp()` function. This impacts the user's ability to zoom or adjust their base font size. To ensure text meets accessibility guidelines, the maximum size must not be more than 2.5 times the minimum size.

```css
.component-title {
  /* Clamp font size between 1rem and 2.5rem, scaling with 5% of container width */
  font-size: clamp(1rem, 5cqi, 2.5rem);
}
```

### Fallback strategies

Baseline status for Container queries: Widely available. It's been Baseline since 2023-02-14.
Supported by: Chrome 105 (Sep 2022), Edge 105 (Sep 2022), Firefox 110 (Feb 2023), and Safari 16 (Sep 2022).

If container queries are not supported by the browser, you should provide a fallback using viewport units or standard media queries.

```css
.component-title {
  /* Fallback for browsers that do not support container units */
  font-size: clamp(1rem, 5vw, 2.5rem);
}

@supports (font-size: 1cqi) {
  .component-title {
    /* Use container units where supported */
    font-size: clamp(1rem, 5cqi, 2.5rem);
  }
}
```

This fallback ensures that the text still scales, but it will be based on the screen width rather than the component's width. This should be tested to verify it works in your use case.
