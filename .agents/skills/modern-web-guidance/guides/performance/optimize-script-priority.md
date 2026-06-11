# Optimize script priority

Browsers assign default priorities to scripts based on where they appear in the document and whether they have attributes like `async` or `defer`. Using `fetchpriority` gives developers explicit control to ensure critical scripts load first, while non-essential scripts stay out of the way.

## How to implement

1. **Identify critical scripts**: Determine which scripts are essential for the page's core functionality or initial user interaction.
2. **Elevate critical async scripts**: For critical scripts loaded with `async` or `defer`, add the `fetchpriority="high"` attribute to ensure they are prioritized during the discovery phase.
3. **Deprioritize non-essential scripts**: For scripts that are not needed immediately (e.g., analytics, ads, or below-the-fold widgets), add `fetchpriority="low"` and ensure they have a `async`, `defer`, or `module` attribute to avoid blocking.
4. **Sequence parser-blocking scripts**: Use `fetchpriority="low"` on parser-blocking scripts at the end of the body to prevent them from contending for bandwidth with more critical resources.

## Example code

```html
<!-- Elevate the priority of the critical app logic -->
<script src="/js/app.js" async fetchpriority="high"></script>

<!-- Deprioritize non-essential tracking scripts -->
<script src="/js/tracker.js" async fetchpriority="low"></script>

<!-- Deprioritize late-body scripts to favor critical images or CSS -->
<script src="/js/legacy-widgets.js" fetchpriority="low"></script>
```

## Best Practices

- **MANDATORY**: Only use `fetchpriority="high"` on at most 1-2 critical scripts to avoid network contention and diluting the priority boost.
- **DO** use `fetchpriority="high"` specifically for `async` scripts that are known to be critical for Interaction to Next Paint (INP).
- **DO** deprioritize scripts that are not required for the initial user experience using `fetchpriority="low"`.
- **DO NOT** use `fetchpriority` on every script tag; it should only be used to change the browser's default heuristic when it is known to be sub-optimal.
- **DO NOT** use the deprecated `importance` attribute. It has been replaced by `fetchpriority`.

## Fallback strategy

Baseline status for Fetch priority: Newly available. It's been Baseline since 2024-10-29.
Supported by: Chrome 103 (Jun 2022), Edge 103 (Jun 2022), Firefox 132 (Oct 2024), and Safari 17.2 (Dec 2023).

The `fetchpriority` attribute is a progressive enhancement. Browsers that do not support it will ignore the attribute and use their internal scheduling logic without error. No explicit feature detection or fallback logic is required for basic usage.
