# Defer rendering heavy content

Web pages with extensive content—such as infinite scrolls, complex dashboards, or dense articles can suffer from slow initial rendering and sluggish interactions. Modern web technologies allow you to defer the rendering workload for content that is not immediately visible, significantly boosting performance without breaking accessibility or user expectations.

To optimize rendering, you can utilize the CSS `content-visibility` property and the HTML `hidden="until-found"` attribute. While both aid performance, they serve distinct use cases.

## When to use which

| Scenario / Example | Feature Applied | Performance Benefit |
| :--- | :--- | :--- |
| **1. Below the fold** (Delay initial load) | **`content-visibility: auto`** | Browser automatically offloads layout/paint workload until the container scrolls close to view, keeping standard page load speed frictionless. |
| **2. Toggle State** (Fast view switching) | **`content-visibility: hidden`** | Skips layout calculations for hidden divs but preserves style containment state, allowing for instantaneous toggling without structural shifts (superior to `display: none`). |
| **3. Searchable & Deferred** (Collapsible disclosures) | **`hidden="until-found"`** | For detailed instructions on combining rendering performance with find-in-page search accessibility, see `search-hidden-content` (via `npx -y modern-web-guidance@latest retrieve "search-hidden-content"`). |

## How to implement `content-visibility: auto`

### Choosing off-screen content

**MANDATORY**: You MUST carefully identify which elements receive `content-visibility: auto`.
- **DO** target large, self-contained layout blocks that are strictly **below the initial fold** (e.g., card items in an infinite feed, trailing comments, or bottom-heavy layout sections).
- **DO NOT** apply this property to elements within the initial, above-the-fold viewport. Doing so forces the browser to evaluate visibility boundaries before rendering, which paradoxically delays critical page load performance.
- **DO** target elements with deep or complex internal DOM structures to maximize rendering cost savings.

### Implementation steps

1. **MANDATORY**: Identify heavy sections that are confirmed to be off-screen on initial load.
2. **MANDATORY**: Apply `content-visibility: auto` to each of these off-screen elements.
3. **MANDATORY**: Provide an estimated layout structure size using `contain-intrinsic-size` on each element.

### How to use `contain-intrinsic-size`

**MANDATORY**: You MUST pair `content-visibility: auto` with `contain-intrinsic-size`. Failure to do so forces the browser to collapse the element to a 0px height when off-screen, causing severe layout shifting and scrollbar jumping as the user scrolls.

The `contain-intrinsic-size` CSS shorthand property acts as a placeholder dimension. Using the `auto` keyword enables the browser to "remember" the exact size once the element is finally rendered, using that calculated size over the placeholder if the element goes off-screen again.

### Example code

```css
/* DO ONLY apply this class to items OUTSIDE the initial layout viewport */
.heavy-section-deferred {
  /* MANDATORY: Skips rendering calculations when off-screen */
  content-visibility: auto;
  
  /* Mandatory: Provide an estimated size to prevent layouts shifts.
    - 'auto' is optional and enables the browser to remember the actual size
      once rendered. It must be paired with a <length> value to be used for
      the first render.
    - 'none' tells the browser not to apply any intrinsic width to this element.
      It can be used for either the height or the width value.
    - '150px' is the estimated height of this element. This can be any valid
      CSS <length> value.
   */
  contain-intrinsic-size: auto none auto 150px; 
}
```

## How to implement `content-visibility: hidden`

1. **Identify heavy sections:** Locate layout blocks that are initially hidden (e.g., extra rows in a large data table).
2. **Apply CSS:** Add `content-visibility: hidden` to the element.
3. **Reveal the element:** When the element should be revealed, change the `content-visibility` property to `visible` or `auto`.

### Example code

```css
.cached-view {
  /* Hides content but caches rendering state */
  content-visibility: hidden;
}

.cached-view.is-active {
  content-visibility: visible;
}
```

Because `content-visibility: hidden` excludes the element and its children from the accessibility tree and find-in-page search, **DO NOT** use it if the content must remain discoverable while hidden. If you need hidden content to remain searchable via native Find-in-page, use `hidden="until-found"` as described in `search-hidden-content` (via `npx -y modern-web-guidance@latest retrieve "search-hidden-content"`).

## Best Practices

- **DO** use `contain-intrinsic-size` with `content-visibility: auto`. Failure to do so forces height recalculations on scroll, causing viewport layout jumping or visual glitches.
- **DO NOT** apply `content-visibility: auto` to elements inside the initial fold viewport, as this delays critical page rendering.
- **MANDATORY Accessibility Verification**: When applying `content-visibility: auto`, you MUST verify sequential keyboard reachability. In certain assistive technology configurations, off-screen nodes utilizing `content-visibility: auto` may be excluded from the accessibility tree or sequential navigation routes until focus is forcibly moved inside them. Test linear navigation across off-screen boundaries using keyboard alone.

## Fallback strategies

### `content-visibility` fallback

Baseline status for content-visibility: Newly available. It's been Baseline since 2025-09-15.
Supported by: Chrome 108 (Nov 2022), Edge 108 (Dec 2022), Firefox 130 (Sep 2024), and Safari 26 (Sep 2025).

When `content-visibility` is not supported it will be ignored by the browser. In most cases `content-visibility: auto` will not need a fallback, though without it performance gains will be lost. An unsupported browser will leave `content-visibility: hidden` elements completely visible. Use feature detection to implement a fallback.

```css
/* Default for everyone */
.inactive {
  display: none;
}

/* Modern Browsers only */
@supports (content-visibility: hidden) {
 .inactive {
    display: block; /* Turn the layout box back on */
    content-visibility: hidden;
  }
}
```
