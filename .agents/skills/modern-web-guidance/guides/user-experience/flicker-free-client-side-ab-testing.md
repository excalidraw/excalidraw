# Flicker-Free Client-Side A/B Testing

## The Problem

Client-side A/B testing tools work by loading a script that modifies the DOM after the browser has already begun constructing the page. Without intervention, the user briefly sees the original content before it flickers or flashes to the experiment variant. Testing platforms have historically worked around this with "anti-flicker snippets" that hide the entire page with `opacity: 0` until the experiment script finishes or an arbitrary timeout (typically 4 seconds) elapses. This approach sacrifices progressive rendering, allows accidental clicks on invisible content, and introduces unnecessary paint cycles.

## The Solution

The `blocking=render` attribute allows a `<script>` or `<link>` element placed in the `<head>` to block rendering—but not parsing—until the resource has been fetched and executed. This gives experimentation scripts the same render-blocking behavior that stylesheets have by default, ensuring the browser never paints the page until the experiment variant has been applied. No opacity hacks, no arbitrary timeouts, and no flicker.

### Implementation Strategy

1. **MANDATORY:** Place the experimentation script in the document `<head>` and add `blocking="render"`.
2. **MANDATORY:** Ensure the script either has `type="module"` (preferred for inline scripts) or `async` (preferred for external scripts with a `src` value).
3. **DO** keep the experimentation script small and fast. Because rendering is blocked until the script executes, a large or slow script directly delays first paint.
4. **DO NOT** use `blocking="render"` on scripts that do not need to run before first paint. It is intended only for scripts whose output must be visible in the initial render.
5. **DO NOT** apply `blocking="render"` to scripts outside the `<head>`. Only scripts in the `<head>` can block rendering.

## Implementation Guide

### Basic Setup

MANDATORY: Load the experimentation script with both `async` and `blocking="render"`. The `async` attribute ensures the script does not block HTML parsing (the browser continues building the DOM while fetching the script). The `blocking="render"` attribute ensures the browser does not paint anything until the script has executed.

```html
<head>
  <!--
    MANDATORY: Both `async` and `blocking="render"` are required.
    - `async`: Prevents parser-blocking, so the DOM is built in parallel.
    - `blocking="render"`: Holds rendering until the script executes,
      ensuring experiment changes are applied before the user sees anything.
  -->
  <script
    src="https://cdn.example.com/experiment-sdk.js"
    async
    blocking="render"
  ></script>
</head>
```

### Loading Experiment-Specific Styles

If the experiment requires a variant stylesheet, use `blocking="render"` on the `<link>` element. Stylesheets in the `<head>` already block rendering by default, but dynamically injected stylesheets or those added via script do not. Use `blocking="render"` explicitly when the stylesheet is added dynamically or when you want to be explicit about the intent.

```html
<head>
  <!--
    DO: Use blocking="render" on experiment stylesheets that are
    dynamically inserted or conditionally loaded by the experiment SDK.
    This ensures variant styles are applied before first paint.
  -->
  <link
    rel="stylesheet"
    href="https://cdn.example.com/experiment-variant-b.css"
    blocking="render"
  >
</head>
```

### Inline Experiment Script

If the experiment logic is lightweight enough to inline, use an inline module script with `blocking="render"`. This is useful when the experiment logic fetches a configuration and applies DOM changes directly.

```html
<head>
  <!--
    DO: Use an inline module script when the experiment logic is small.
    Module scripts are deferred by default (non-parser-blocking),
    and blocking="render" ensures rendering waits for execution.
  -->
  <script type="module" blocking="render">
    // Fetch the experiment configuration from your testing platform.
    const config = await fetch('/api/experiment?id=homepage-cta')
      .then(res => res.json());

    // Apply the variant by setting a data attribute on <html>.
    // CSS rules keyed to this attribute will style the variant.
    document.documentElement.dataset.variant = config.variant;
  </script>

  <style>
    /* Default styles (control group) */
    .cta-button {
      background-color: blue;
    }

    /* Variant B styles, activated by the data attribute */
    [data-variant="b"] .cta-button {
      background-color: green;
    }
  </style>
</head>
```

## Best Practices

- **MANDATORY:** The experimentation script MUST execute quickly. A slow script delays all rendering. Set a performance budget (e.g., under 100ms execution time) for the render-blocking script.
- **DO** split heavy experiment logic from the render-blocking script. Load a small, render-blocking stub that applies the variant, then load heavier tracking or analytics scripts separately with `async` or `defer` (without `blocking="render"`).
- **DO** use a data attribute on `<html>` or `<body>` to signal the active variant, and use CSS selectors keyed to that attribute for variant styling. This avoids direct DOM manipulation in the render-blocking script.
- **DO NOT** use `blocking="render"` on analytics, tracking, or other non-visual scripts. Only scripts that must change what the user sees on first paint should block rendering.
- **DO NOT** combine `blocking="render"` with legacy anti-flicker snippets. They solve the same problem; using both creates unnecessary delays.

## Fallback Strategies

blocking="render" has limited availability.
Supported by: Chrome 105 (Sep 2022), Edge 105 (Sep 2022), and Safari 18.2 (Dec 2024).
Unsupported in: Firefox.

The `blocking` attribute is not supported in all browsers. In browsers that do not support it, the attribute is ignored and the script loads with its default behavior (`async` in the examples above), which may result in flicker. A fallback is required to prevent flicker in unsupported browsers.

### Fallback: Anti-Flicker Snippet

DO: Use a lightweight anti-flicker snippet as a fallback only when `blocking="render"` is not supported. Feature-detect support and skip the fallback in browsers that handle it natively.

```html
<head>
  <!--
    DO: Load the experiment script with blocking="render" for
    browsers that support it. This is the preferred approach.
  -->
  <script
    src="https://cdn.example.com/experiment-sdk.js"
    async
    blocking="render"
  ></script>

  <script>
    // DO: Only apply the anti-flicker fallback in browsers
    // that do not support blocking="render".
    if (!Object.hasOwn(HTMLScriptElement.prototype, 'blocking')) {
      // Hide the page until the experiment script runs.
      document.documentElement.classList.add('ab-loading');

      // DO: Set a timeout to reveal the page if the experiment
      // script takes too long. This prevents an indefinitely
      // blank page on slow connections. Adjust the timeout
      // to match your experiment SDK's expected load time.
      setTimeout(() => {
        document.documentElement.classList.remove('ab-loading');
      }, 4000);
    }
  </script>

  <style>
    /*
      DO: Use opacity to hide content during experiment loading.
      This is only applied when blocking="render" is unsupported.
    */
    .ab-loading {
      opacity: 0 !important;
    }
  </style>
</head>
```

```javascript
// DO: In your experiment SDK's initialization callback,
// remove the fallback class to reveal the page.
function onExperimentReady() {
  document.documentElement.classList.remove('ab-loading');
}
```

## Other Considerations

1. **Performance Impact**: `blocking="render"` trades first-paint speed for visual correctness. Monitor Largest Contentful Paint (LCP) and First Contentful Paint (FCP) to ensure the experimentation script is not adding excessive delay.
2. **Third-Party Script Reliability**: If the experiment SDK is hosted on a third-party CDN, a CDN outage could block rendering entirely. The browser applies its own timeout heuristics (which may be longer than 4 seconds), but there is no developer-controlled timeout for `blocking="render"`. Ensure the third-party provider has strong uptime guarantees.
3. **Server-Side Alternatives**: For performance-critical pages, consider server-side A/B testing (where the server renders the correct variant directly) instead of client-side testing. Server-side approaches eliminate flicker entirely without any render-blocking cost. Use client-side `blocking="render"` only when server-side testing is not feasible.
