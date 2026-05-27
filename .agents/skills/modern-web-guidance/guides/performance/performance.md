## Critical Rendering Path (CRP) Optimization

The Critical Rendering Path dictates how quickly the browser converts HTML, CSS, and JavaScript into painted pixels. 

### DOs
*   **DO inline critical CSS**: Extract styles necessary for above-the-fold content and inject them directly into the HTML `<head>`. Defer the rest of the stylesheet.
*   **DO use `async` or `defer` for all non-critical scripts**: Prevent JavaScript from blocking the DOM parser. Use `defer` for scripts that depend on the DOM or each other, and `async` for independent scripts. `type="module"` is preferred for modern JavaScript and is deferred by default so no need to have an explicit `defer` attribute but you can use `async` on independent module scripts.
*   **DO split CSS by media queries**: Use the `media` attribute on `<link>` tags so the browser downloads unused stylesheets (e.g., print styles or desktop styles on mobile) without blocking the render.
*   **DO utilize resource hints**: Add `preconnect` or `dns-prefetch` for essential third-party domains (e.g., font foundries or API endpoints) to establish early TLS handshakes.

### DON'Ts
*   **DON'T use `@import` in CSS**: This creates sequential request chains that delay the CSS Object Model (CSSOM) construction.
*   **DON'T place large, non-critical JavaScript in the `<head>`**: This halts DOM construction until the script is downloaded, parsed, and executed.
*   **DON'T load invisible or unreachable CSS/JS**: Ensure build tools apply tree-shaking and CSS minification to drop unreachable code before deployment.

### Code Examples

**HTML: Deferring Non-Critical CSS & Scripts**
```html
<!-- Inline critical styles directly in head -->
<style>
  body { margin: 0; font-family: system-ui; }
  .hero { min-height: 100vh; }
</style>

<!-- Defer non-critical CSS -->
<link rel="preload" href="non-critical.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="non-critical.css"></noscript>

<!-- Load CSS conditionally based on viewport -->
<link rel="stylesheet" href="mobile.css" media="(max-width: 768px)">

<!-- Defer JavaScript execution -->
<script defer src="app-bundle.js"></script>
```

### The Resource Hint Navigator

| Hint | Tool Use Case | Example |
| :--- | :--- | :--- |
| `preconnect` | Resolve TLS/DNS for known third-party APIs | API endpoints, font services |
| `dns-prefetch` | Lean fallback for non-critical third-party origins | Ad servers, analytics fallbacks |
| `preload` | Same-origin asset needed *now* for rendering | Hero images, render-blocking fonts |
| `prefetch` | Assets needed for next-page navigation | Next-page bundle, detail views |

**Single-Sentence Mental Model**: "Preconnect for domains, Preload for viewport, Prefetch for futures."

## Largest Contentful Paint (LCP) & Resource Fetching

LCP measures the time required to render the largest visible text or image block within the viewport. Optimize LCP by prioritizing visible elements and prepolishing.

### DOs
*   **DO use `fetchpriority="high"` on the LCP image**: Signal to the browser's heuristic engine to elevate the image's priority above scripts and non-critical assets.
*   **DO declare the LCP image in standard HTML**: Ensure the `<img>` tag is present in the raw HTML response so the preload scanner discovers it immediately. Avoid relying on JavaScript to mount the LCP element.
*   **DO preload background images acting as LCP**: If the LCP element is a CSS `background-image`, force early discovery using `<link rel="preload" as="image">` coupled with `fetchpriority="high"`.
*   **DO use `fetchpriority="low"` to demote competing elements**: Lower the priority of large images or carousels that appear above the fold but are *not* the primary LCP element.

### DON'Ts
*   **DON'T lazy-load the LCP image**: Never apply `loading="lazy"` to above-the-fold images. This purposefully delays the fetch until layout calculation is complete, severely degrading LCP.
*   **DON'T overuse `fetchpriority="high"`**: Prioritization is a zero-sum mechanism. Elevating too many resources creates network contention and negates the benefit.
*   **DON'T implement complex JavaScript loaders for the hero section**: Client-side rendering of the LCP element introduces substantial request chains (HTML -> JS -> Execution -> Image Request).

### Code Examples

**HTML: LCP Image Optimization**
```html
<!-- Standard LCP Image -->
<img 
  src="/images/hero.webp" 
  alt="Hero Product" 
  fetchpriority="high" 
  decoding="sync"
  width="1200" 
  height="600"
>

<!-- Preloading a CSS-based LCP background -->
<link rel="preload" as="image" href="/images/bg-hero.webp" fetchpriority="high" type="image/webp">

<!-- Demoting an above-the-fold non-LCP carousel image -->
<img src="/images/carousel-2.webp" fetchpriority="low" alt="Slide 2">
```

## Interaction to Next Paint (INP) & Main Thread Unblocking

INP measures the latency of all interactive events across the page's lifecycle. Poor INP is caused by long-running JavaScript tasks blocking the main thread. 

### DOs
*   **DO break up long tasks**: Any JavaScript execution exceeding 50ms should be split. Yield to the main thread frequently so the browser can process pending user inputs.
*   **DO use `scheduler.yield()` with a fallback**: Utilize the modern `scheduler.yield()` API to place task continuations at the *front* of the queue, falling back to `setTimeout` wrapped in a Promise for unsupported browsers.
*   **DO debounce or throttle rapid event listeners**: Limit the execution frequency of handlers attached to `scroll`, `resize`, or rapid `input` events.
*   **DO separate UI updates from heavy computations**: Update the UI synchronously to provide immediate visual feedback, then push background processing to a Web Worker or deferred task.

### DON'Ts
*   **DON'T rely solely on `setTimeout(..., 0)` for continuous yielding**: Standard `setTimeout` places continuations at the *back* of the task queue, potentially causing long delays if other tasks are pending.
*   **DON'T cause layout thrashing**: Avoid interleaving DOM reads (`offsetHeight`, `getBoundingClientRect`) and writes (`style.height`) within the same loop. Batch DOM reads, then batch DOM writes.
*   **DON'T block the thread with recurring timers**: Avoid heavy polling with `setInterval` that starves the main thread.

### Code Examples

**JS: `scheduler.yield` Polyfill and Usage**
```javascript
// Polyfill for yielding to main thread
async function yieldToMain() {
  if ('scheduler' in window && 'yield' in scheduler) {
    return await scheduler.yield();
  }
  return new Promise(resolve => setTimeout(resolve, 0));
}

// Processing a large array without blocking user input
async function processLargeList(items) {
  for (let i = 0; i < items.length; i++) {
    processItem(items[i]);
    
    // Yield every 50 iterations to allow rendering/interaction
    if (i % 50 === 0) {
      await yieldToMain();
    }
  }
}
```

### Main Thread Task Slicing Heuristic

**The 50ms Rule for INP**:
- **< 50ms**: Execute synchronously.
- **50ms - 250ms**: Slice tasks and yield with `scheduler.yield()`.
- **> 250ms**: Offload to a Web Worker.

## Third-Party Script Management

Third-party scripts (analytics, ads, chat widgets) are the primary source of main thread congestion.

### DOs
*   **DO avoid third-party scripts blocking main content**: Use `defer` with all third-party scripts unless critical to the page load and load them in the footer of the page, rather than the `<head>`.
*   **DO self-host critical third-party dependencies**: Reduce DNS lookups and enforce custom `Cache-Control` logic by hosting third-party libraries on the origin domain.

### Code Examples

**HTML: Third-Party Script Execution**
```html
<!-- 1. Place third-party scripts near the end of the page with the defer attribute -->
<script defer src="http://www.example.com/third-party.js"></script>
```

## CSS Rendering & Containment Optimization

Rendering involves Layout, Style, Paint, and Compositing calculations. CSS Containment limits the scope of these calculations which is useful on large, complex pages where such calculations can cause performance problems.

### DOs
*   **DO use `content-visibility: auto` on off-screen sections on large, complex pages**: Instruct the browser to skip layout and paint calculations for entire subtrees until they approach the viewport.
*   **DO pair `content-visibility` with `contain-intrinsic-size`**: Prevent layout shifts and scrollbar jumping by providing a placeholder height/width for unrendered containers.
*   **DO apply explicit CSS containment (`contain`)**: For isolated UI components (like modals or widgets), use `contain: layout style paint` to prevent internal changes from triggering page-wide reflows.

### DON'Ts
*   **DON'T apply `content-visibility: auto` on smaller, simpler pages**: The gains will be negligible and there are risks of side effects with content jumping.
*   **DON'T apply `content-visibility: auto` to above-the-fold content**: The browser will still evaluate it, but forcing it through the containment engine unnecessarily adds slight overhead to visible elements.
*   **DON'T overuse `will-change` globally**: Indiscriminately applying `will-change: transform` to multiple elements consumes excessive VRAM, causing GPU crashes or sluggish rendering.
*   **DON'T forget accessibility when hiding elements**: `content-visibility: auto` keeps elements in the DOM for screen readers. If content should be truly hidden from assistive technology when off-screen, manage `aria-hidden` attributes manually.

### Code Examples

**CSS: Content Visibility and Containment**
```css
/* Optimize a long list of articles below the fold */
.article-list-item {
  content-visibility: auto;
  contain-intrinsic-size: auto 600px; /* Provides a 600px placeholder */
}

/* Scope a complex widget to prevent layout thrashing */
.isolated-widget {
  contain: layout style paint;
}

/* Hardware accelerate an animation only on hover */
.interactive-button:hover {
  will-change: transform;
  transform: scale(1.05);
}
```

## Modern Image & Media Optimization

Images typically represent the largest payload on a given web page. Optimization requires format negotiation, responsive sizing, and layout stabilization.

### DOs
*   **DO serve modern formats (AVIF / WebP)**: Use the `<picture>` element to offer AVIF (best compression), falling back to WebP, and finally JPEG/PNG for legacy browsers.
*   **DO apply explicit `width` and `height` attributes**: Setting native attributes allows the browser to compute the aspect ratio immediately, reserving space and eliminating CLS. Image dimensions may be set either as HTML attributes or CSS properties.
*   **DO utilize `loading="lazy"` on all below-the-fold images**: Utilize native browser lazy loading to defer network requests for images outside the initial viewport.
*   **DO implement responsive images with `srcset` and `sizes`**: Serve tailored resolutions based on screen density and viewport width to prevent mobile devices from downloading desktop-sized images.

### DON'Ts
*   **DON'T lazy load above-the-fold images**: This directly harms LCP. Visible images must use `loading="eager"` (the default).
*   **DON'T delete necessary dimensions**: Failing to specify width/height on lazy loaded images causes layout shifts.
*   **DON'T omit the `sizes` attribute when using `srcset`**: Without `sizes`, the browser assumes `100vw` and downloads the largest available image.

### Code Examples

**HTML: Comprehensive Responsive Image Component**
```html
<picture>
  <!-- Modern Formats with Source Negotiation -->
  <source type="image/avif" srcset="hero-400w.avif 400w, hero-800w.avif 800w" sizes="(max-width: 600px) 100vw, 50vw">
  <source type="image/webp" srcset="hero-400w.webp 400w, hero-800w.webp 800w" sizes="(max-width: 600px) 100vw, 50vw">
  
  <!-- Fallback + Dimensions + Priority for Above-The-Fold -->
  <img 
    src="hero-800w.jpg" 
    alt="Descriptive text" 
    width="800" 
    height="600"
    fetchpriority="high"
    loading="eager"
  >
</picture>

<!-- Below-The-Fold Image -->
<img 
    src="footer-icon.png" 
    alt="Footer Logo" 
    width="100" 
    height="100"
    loading="lazy"
>

<!-- DO: Use native lazy loading for below the fold iframes -->
<iframe src="https://example.com/map" width="800" height="600" loading="lazy" title="Example Map"></iframe>
```

## Service Workers & Caching Strategies

Client-side caching via Service Workers allows applications to bypass the network entirely, serving resources from disk/memory.

### DOs
*   **DO use a `CacheFirst` strategy for static, versioned assets**: Immutable files (fonts, JS/CSS bundles with hash strings) should be served directly from the cache to guarantee instant loading.
*   **DO use `StaleWhileRevalidate` for dynamic, non-critical resources**: For API calls where slight staleness is acceptable, serve immediately from cache while silently updating the cache in the background.
*   **DO implement a `NetworkFirst` strategy for HTML documents**: Ensure the user always receives the latest application shell and manifest, falling back to cache only if offline.
*   **DO restrict cache sizes and expiry**: Use expiration plugins to prevent the Service Worker from exhausting the device's storage quota.

### DON'Ts
*   **DON'T cache opaque responses blindly**: Responses from third-party domains lacking CORS headers are "opaque". Caching them heavily consumes quota and fails silently. Only cache them using `NetworkFirst` or `StaleWhileRevalidate`.
*   **DON'T cache POST requests**: Service workers cannot cache non-GET requests natively. Implement background sync queues for offline submissions.
*   **DON'T bypass versioning**: Failing to update asset hashes/versions will trap users in infinite cache loops.

### Code Examples

**JS: Service Worker Caching via Workbox**
```javascript
import { registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// 1. HTML Documents: Network First
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({ cacheName: 'pages-cache' })
);

// 2. Static Assets (JS, CSS, Fonts): Cache First
registerRoute(
  ({ request }) => ['style', 'script', 'font'].includes(request.destination),
  new CacheFirst({
    cacheName: 'static-resources',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 })
    ]
  })
);

// 3. API Responses: Stale While Revalidate
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/v1/content'),
  new StaleWhileRevalidate({
    cacheName: 'api-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] })
    ]
  })
);
```

## Web Fonts Optimization

Web fonts are a common source of render blocking. Optimizing them reduces the Flash of Invisible Text (FOIT) and speeds up initial rendering.

### DOs
*   **DO preload critical fonts**: Use `<link rel="preload" as="font" type="font/woff2" crossorigin>` for fonts seen above the fold.
*   **DO subset fonts**: Trim font weights and glyph variations to include only the characters your application requires.

### DON'Ts
*   **DON'T preload all fonts**: Over-preloading leads to network contention that starves other critical assets.

### Code Examples

**CSS: Font Loading Face**
```css
@font-face {
  font-family: 'Modern Sans';
  src: url('/fonts/modern-sans.woff2') format('woff2');
}
```

**HTML: Critical Font Preload**
```html
<!-- Always use crossorigin for fonts even if on the same origin -->
<link rel="preload" href="/fonts/modern-sans.woff2" as="font" type="font/woff2" crossorigin>
```

## Video Performance & Metrics

Video payloads are among the heaviest assets. Optimization focuses on reducing bandwidth stall and preserving Cumulative Layout Shift (CLS) stability.

### DOs
*   **DO specify explicit `width` and `height` attributes**: Setting native dimensions reserves layout space and prevents CLS.
*   **DO provide a `poster` image fallback**: Display a lightweight image placeholder while the video buffers to improve perceived performance.
*   **DO use `preload="none"` for non-critical videos**: Delay bandwidth consumption for below-the-fold or non-autoplaying videos.
*   **DO serve modern formats via source negotiation**: Offer WebM (better compression ratio) alongside standard MP4 formats.
*   **DO use `loading="lazy"` for offscreen videos**: Lazy-loading videos allow `poster` and `preload` downloads to be deferred until the video is in or near the viewport.

### DON'Ts
*   **DON'T auto-play video files blindly**: Rely on user intent or use progressive enhancement streams.
*   **DON'T auto-play large video files at all**: Rely on user intent before downloading large files.

### Code Examples

**HTML: Accessible and Dynamic Video Loader**
```html
<video 
  controls 
  width="1200" 
  height="675"
  poster="/images/video-poster.webp" 
  preload="none"
>
  <source src="/videos/intro.webm" type="video/webm">
  <source src="/videos/intro.mp4" type="video/mp4">
  <!-- Include accessibility tracks -->
  <track src="/video-caps.vtt" kind="captions" srclang="en" label="English">
</video>
```

## JavaScript Code-Splitting

Heavy monolithic bundles block main thread parse times on low-end devices. Splitting ensures we only download bytes required for the immediate viewport.

### DOs
*   **DO use dynamic imports**: Split routes or heavy UI libraries using standard `import()` specifications.
*   **DO configure bundler asset chunking**: Use Vite or Webpack rollup directives to split third-party vendors from runtime application logic.

### DON'Ts
*   **DON'T ship a single, enormous `app.js` bundle**: It increases parse time and memory consumption for initial views.

### Code Examples

**JS: Route based Dynamic Splitting**
```javascript
// Dynamic import of heavy module only when button is clicked
document.getElementById('heavy-btn').addEventListener('click', async () => {
  const { heavyFunction } = await import('./heavy-module.js');
  heavyFunction();
});
```
