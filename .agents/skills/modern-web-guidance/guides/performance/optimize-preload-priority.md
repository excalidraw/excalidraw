# Optimize preload priority

Preloading resources with `<link rel="preload">` signals to the browser that a resource will be needed soon. However, preloads inherit the default priority for the resource type and for images in particular this is low. Using `fetchpriority` allows you to refine this relative priority, in particular ensuring image preloads are preloaded with a high priority allowing them to start earlier and use get more bandwidth resources.

## How to implement

1. **Identify preload candidates**: Find resources that are not discovered early by the browser (e.g., video poster images or background images in CSS) but are essential for the page's appearance.
2. **Elevate critical image preloads**: For the LCP image or other critical images that are not prioritized by default, use `<link rel="preload" fetchpriority="high">` to ensure they are prioritized above other preloads. Note that fonts are already high priority by default.
3. **Deprioritize non-critical preloads**: For resources that aren't critical for the initial render (e.g., a background video or secondary fonts), use `<link rel="preload" fetchpriority="low">`.
4. **Coordinate with resource types**: Note that different `as` types have different default priorities; use `fetchpriority` to override these defaults when necessary.

## Example code

```html
<!-- Elevate priority for a video poster image that acts as the LCP candidate -->
<link rel="preload" href="/images/video-poster.jpg" as="image" fetchpriority="high">

<!-- Elevate priority for a critical LCP image that is hidden in CSS -->
<link rel="preload" href="/images/hero-background.jpg" as="image" fetchpriority="high">

<!-- Deprioritize a secondary font to avoid network contention -->
<link rel="preload" href="/fonts/secondary-font.woff2" as="font" type="font/woff2" fetchpriority="low" crossorigin>
```

## Best Practices

- **MANDATORY**: Only use `fetchpriority="high"` on at most 1-2 critical image preloads to avoid network contention and diluting the priority boost.
- **MANDATORY**: Use `fetchpriority="high"` on Largest Contentful Paint (LCP) images.
- **DO**: Limit the total number of preloads on a page to at most 2 images and 2-3 essential fonts to prevent bandwidth contention.
- **DO** use `fetchpriority="low"` for preloads that you want the browser to start early but not at the expense of critical resources (especially non-critical fonts).
- **DO** specify the `as` attribute correctly to ensure the preload will be used.
- **DO** prefer making critical resources (like LCP images) statically discoverable in HTML via `<img>` tags rather than relying on preloads for background images.
- **DO** ensure that font preloads always have the `crossorigin` attribute (even if same-origin).
- **DO NOT** use the deprecated `importance` attribute. It has been replaced by `fetchpriority`.

## Fallback strategy

Baseline status for Fetch priority: Newly available. It's been Baseline since 2024-10-29.
Supported by: Chrome 103 (Jun 2022), Edge 103 (Jun 2022), Firefox 132 (Oct 2024), and Safari 17.2 (Dec 2023).

The `fetchpriority` attribute on `<link rel="preload">` is a progressive enhancement. Browsers that do not support it will still preload the resource using their default priority for that resource type. To ensure compatibility, always provide correct `as` and `type` attributes.
