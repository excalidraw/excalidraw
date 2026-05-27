# Consistent Cross-Document Transitions

## The Problem

Cross-document view transitions animate elements between two pages during a same-origin navigation. The browser captures a snapshot of the old page, navigates, then animates from the snapshot to the new page. If the new page has not finished loading critical resources — stylesheets, layout scripts, or key DOM elements — the transition animates to an incomplete or unstyled state. This causes visual glitches such as elements morphing to wrong positions, content reflowing mid-animation, or fallback fonts flashing to web fonts after the transition completes.

## The Solution

Use `blocking="render"` on critical `<link>` and `<script>` elements in the new page's `<head>`, and use `<link rel="expect">` to block rendering until specific DOM elements have been parsed. This ensures the browser does not begin the view transition animation until the new page's visual state is stable. The browser continues parsing the HTML in the background — only painting is deferred.

### Implementation Strategy

1. **MANDATORY:** Opt in to cross-document view transitions with the `@view-transition` CSS at-rule on both pages.
2. **MANDATORY:** Ensure critical stylesheets are in the `<head>`. Stylesheets in the `<head>` are render-blocking by default. Dynamically injected stylesheets require explicit `blocking="render"`.
3. **DO** use `blocking="render"` on `<script>` elements that must execute before the transition animates (e.g., scripts that apply a theme or affect the layout).
4. **DO** use `<link rel="expect" href="#element-id" blocking="render">` to block rendering until above-the-fold content has been parsed. This applies to all transition types: full-page cross-fades (to avoid animating to a blank page), morph animations (to ensure named elements exist in the DOM), and script-dependent layouts (to ensure styled content is parsed).
5. **DO NOT** block rendering on non-critical content. Only block on resources and elements that affect the initial viewport. Blocking on too much content delays the transition and degrades perceived performance.

## Implementation Guide

### Step 1: Opt in to Cross-Document View Transitions

MANDATORY: Both the source and destination pages must include the `@view-transition` at-rule. Without this, no cross-document transition occurs.

```css
/*
  MANDATORY: Include this rule in every page that participates
  in cross-document view transitions.
  `navigation: auto` enables transitions for standard navigations
  (link clicks, form submissions, back/forward).
*/
@view-transition {
  navigation: auto;
}

/* MANDATORY Copy-Paste Safety: Disable cross-document view transitions for users requesting reduced motion */
@media (prefers-reduced-motion: reduce) {
  @view-transition {
    navigation: none;
  }
}
```

### Step 2: Block Rendering Until Critical Scripts Execute

If a non-blocking script in the `<head>` must run before the transition animates (e.g., to apply a theme class or affect the layout), mark it with `blocking="render"`. Without this, `async`, `defer`, or `type="module"` scripts may execute after the transition has already started.

```html
<head>
  <!--
    DO: Mark layout-critical scripts with blocking="render".
  -->
  <script type=module blocking="render">
    // Example: apply a stored theme before the page renders,
    // so the transition snapshot reflects the correct theme.
    document.documentElement.dataset.theme =
      localStorage.getItem('theme') || 'light';
  </script>
</head>
```

### Step 3: Block Rendering Until Key DOM Elements Are Parsed

Stylesheets and `blocking="render"` scripts in the `<head>` only guarantee that the `<head>` has been fully processed. They do **not** wait for any `<body>` content to be parsed. Without additional blocking, the browser may take the new-page snapshot before above-the-fold elements exist in the DOM — resulting in a transition that animates to a blank or partially rendered page.

`<link rel="expect">` solves this by blocking rendering until a specific element (identified by its `id`) has been parsed. The `href` value must be a fragment identifier (e.g., `#hero`) matching the target element's `id` attribute. Once that element's closing tag is parsed, the render block is released.

**DO** use `<link rel="expect">` in all of the following scenarios:

#### Use Case 1: Full-Page Cross-Fade

Even when no individual elements have a `view-transition-name`, the default `root` transition cross-fades the entire page. If the new page's snapshot is taken before above-the-fold content is parsed, the cross-fade animates from the old page to a blank or incomplete page. Block rendering on an element that marks the end of the visible above-the-fold content.

```html
<head>
  <link rel="stylesheet" href="/css/styles.css">

  <!--
    DO: Block rendering until the main content area is parsed,
    even for a simple cross-fade. Without this, the browser may
    snapshot the page before visible content exists in the DOM,
    causing the cross-fade to reveal a blank or partial page.
  -->
  <link rel="expect" href="#main-content" blocking="render">
</head>
<body>
  <header>...</header>
  <main id="main-content">
    <h1>Page Title</h1>
    <p>Above-the-fold content the user should see immediately.</p>
  </main>
  <!-- Content below the fold does NOT need to be blocked on -->
  <section>...</section>
</body>
```

#### Use Case 2: Morph Animations Between Specific Elements

When elements on both pages share a `view-transition-name`, the browser morphs them smoothly across the navigation. If the target element has not been parsed when the transition starts, the browser cannot find it — the morph degrades to separate exit and entry animations. Block rendering until the element with the `view-transition-name` has been parsed.

```html
<head>
  <link rel="stylesheet" href="/css/styles.css">

  <!--
    DO: Block rendering until the element participating in the
    morph animation has been parsed. Without this, the browser
    may start the transition before #hero exists, causing the
    morph to degrade to a fade-out/fade-in.
  -->
  <link rel="expect" href="#hero" blocking="render">

  <!--
    When multiple blocking="render" resources are present,
    rendering is blocked until ALL of them are satisfied.
    Here, the browser waits for both the script to execute
    AND the #hero element to be parsed — whichever comes last.
  -->
  <script async blocking="render" src="/js/transition-setup.js"></script>
</head>
<body>
  <header>...</header>
  <section id="hero">
    <h1 style="view-transition-name: page-title">Product Name</h1>
    <img style="view-transition-name: hero-image" src="/img/product.webp" alt="Product">
  </section>
</body>
```

### Step 4: Use Media Queries for Responsive Render Blocking

Different viewport sizes may show different amounts of content above the fold. Use the `media` attribute on `<link rel="expect">` to block rendering only for the content visible at a given viewport width.

```html
<head>
  <!--
    DO: Use media queries to conditionally block rendering.
    On wide screens, both the hero and the sidebar are visible,
    so block until both are parsed. On narrow screens, only the
    hero is visible initially.
  -->
  <link
    rel="expect"
    href="#hero"
    blocking="render"
    media="screen and (width <= 768px)"
  >
  <link
    rel="expect"
    href="#sidebar"
    blocking="render"
    media="screen and (width > 768px)"
  >
</head>
```

### Step 5: Use pagereveal for Context-Dependent Transitions (Optional)

The `pagereveal` event is **not required** for the core render-blocking strategy. It is only needed when `view-transition-name` values must be assigned dynamically based on where the user navigated from — for example, morphing a specific list item to a detail page heading.

If `view-transition-name` values are assigned statically in CSS, or if you are only using the default full-page cross-fade, skip this step entirely.

```html
<head>
  <!--
    MANDATORY: The pagereveal listener must be registered before
    the page renders. Use an async script with blocking="render"
    so the listener is registered early without blocking parsing.
    If the listener is registered too late (e.g., in a deferred
    script), the event may have already fired.
  -->
  <script async blocking="render" src="/js/transition-setup.js"></script>
</head>
```

```javascript
// transition-setup.js
window.addEventListener('pagereveal', async (event) => {
  if (!event.viewTransition) return;

  const from = navigation.activation?.from;
  if (!from) return;

  const fromUrl = new URL(from.url);

  // DO: Assign view-transition-name based on navigation context.
  // This enables a morph animation from the product card on the
  // list page to the heading on the detail page.
  if (fromUrl.pathname === '/products/') {
    const heading = document.querySelector('main h1');
    if (heading) {
      heading.style.viewTransitionName = 'product-title';
    }

    // MANDATORY: Remove the temporary name after the transition
    // finishes. Stale names interfere with subsequent navigations
    // and prevent the page from entering the bfcache.
    await event.viewTransition.finished;
    heading.style.viewTransitionName = '';
  }
});
```

## Best Practices

- **DO** assign `view-transition-name` via CSS whenever possible. Reserve JavaScript assignment (via `pagereveal`) for cases where the name depends on navigation context.
- **DO** keep render-blocking scripts small and fast. The browser has a built-in timeout (around 4 seconds), after which the transition is skipped entirely with a `TimeoutError`.
- **DO NOT** use `<link rel="expect">` to block on elements deep in the page that are not visible in the initial viewport. This delays the transition without visual benefit.
- **DO NOT** assign the same `view-transition-name` to multiple elements on the same page. Duplicate names cause the entire transition to be skipped.
- **Assistive Technology Timing Impact**: Using `blocking="render"` delays visual updates and initial paint. While this prevents visual glitches for sighted users, it can cause processing latency or deferred initialization for screen readers and other assistive technologies that depend on rendered accessibility trees. Weigh the visual continuity benefits against the initial read latency for non-visual users, and ensure render-blocking scripts are minimal and extremely optimized.

## Fallback Strategies

Cross-document view transitions has limited availability.
Supported by: Chrome 126 (Jun 2024), Edge 126 (Jun 2024), and Safari 18.2 (Dec 2024).
Unsupported in: Firefox.

Cross-document view transitions are an excellent candidate for progressive enhancement. In browsers that do not support them, the `@view-transition` rule is ignored and standard same-origin navigations occurs exactly as they would without the feature. Supporting browsers get smooth transitions; all others get standard navigation. Limited browser support is not a reason to avoid adoption.

All browsers that support cross-document view transitions also support `blocking="render"` and `<link rel="expect">`, so no separate fallback is needed for the render-blocking features described in this guide.

## Other Considerations

1. **Performance Impact**: Every render-blocking resource delays the view transition animation start. Minimize the number of render-blocking scripts and use `<link rel="expect">` only for elements that are above the fold. Prerender destination pages using the Speculation Rules API to eliminate loading delays entirely.
2. **Timeout Behavior**: If the combined render-blocking time exceeds approximately 4 seconds, the browser skips the transition with a `TimeoutError`. Ensure critical resources load well within this window.
3. **bfcache Compatibility**: Temporary `view-transition-name` assignments that are not cleaned up after the transition can prevent the page from entering the bfcache. Always remove dynamically assigned names in the `finished` callback.
