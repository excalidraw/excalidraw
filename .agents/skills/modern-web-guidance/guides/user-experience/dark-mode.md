# Dark mode

The `color-scheme` property indicates which color schemes (such as light or dark) your page supports. This informs the browser that it can automatically theme native UI elements—like scrollbars, form controls, and the default canvas background—to match your site's design and help minimize white flashes during initial loading.

## Implementation

### 1. Declare supported schemes in HTML

MANDATORY: To help prevent a "flash of un-themed content" (FOUC), place a `<meta>` tag in your `<head>` to ensure the browser knows which themes you support before it even starts rendering. While this `<meta>` tag helps to avoid FOUC by setting the initial canvas color early, it may not completely eliminate flashes in all browsers or loading conditions.

```html
<!-- MANDATORY: Declare support for both light and dark themes -->
<meta name="color-scheme" content="light dark">
```

### 2. Apply page-wide color scheme to CSS :root or html

MANDATORY: Apply the `color-scheme` property to the `html` element or the `:root` pseudo-class. Browsers specifically look to the root element to determine the theme for the entire viewport—including the root scrollbars and the initial "canvas" background. If applied only to the `body`, these global UI surfaces may remain in light mode because the `body` does not control the window's rendering context.

```css
/* MANDATORY: Apply color-scheme to :root or html for viewport-wide theming */
:root {
  /* MANDATORY: Automatically adapt native UI to user system preferences */
  color-scheme: light dark;
}
```

### 3. Define light and dark color tokens

You can use the `light-dark()` function to define color tokens that automatically adapt to different `color-scheme` values.

It is recommended that you also keep the raw color values in separate custom properties, which makes it easier to combine them in different ways (and makes fallback behavior easier, if needed).

For more control over the colors of built-in UI such as `accent-color` or `scrollbar-color`, authors **can optionally** add their own dynamic colors with use of custom properties and/or the `light-dark()` function. This function automatically picks the correct color based on the computed `color-scheme` of the element and eliminates the need for redundant media queries, but is not required for a basic implementation.

```css
:root {
  --color-brand-light: oklch(45% 0.23 270);
  --color-brand-dark: oklch(85% 0.15 210);
  --color-brand-text-light: white;
  --color-brand-text-dark: oklch(40% 0.23 270);

  --color-brand: light-dark(var(--color-brand-light), var(--color-brand-dark));
  --color-brand-text: light-dark(var(--color-brand-text-light), var(--color-brand-text-dark));

  /* MANDATORY: Automatically adapt native UI to user system preferences */
  color-scheme: light dark;
}

button.primary {
  /* These automatically adapt to color scheme */
  background-color: var(--color-brand);
  color: var(--color-brand-text);
}
```

OPTIONAL: A number of system colors are available, which also automatically adapt to the used color scheme (and other color modes, e.g. forced colors), such as `canvas`, `canvastext`, `accentcolor` (check support) , `buttonborder` etc. These are typically too limited to be useful, beyond very specific cases where you need to exactly match certain default browser UI or as fallbacks/defaults.

#### OPTIONAL: Tailor color pairs to context

Even when overriding the system default, it can be useful to use the `prefers-color-scheme` media query to define **different** color pairs that take into account the colors of the browser and OS chrome around the page (or of the surrounding page, when the page is used as an iframe).

For example, use a slightly dimmer light theme when the system setting is `dark`, or a more contrasting dark theme when the system setting is `light`, so the page is not visually overpowered by the surrounding UI.


## Fine-grained browser UI customization

Setting `color-scheme` already adapts browser UI to the used color scheme, but this will use OS defaults and/or system colors that may not perfectly align with the website design.
Modern browsers expose several fine-grained customization hooks for these.
Do not reimplement native controls simply to customize their appearance without exhausting the customization hooks modern browsers provide.

### Setting the accent color

Some browser UI (e.g. checked checkboxes or sliders) uses an accent color.
This resolves to the OS setting by default, but you can use the `accent-color` property to set it to a color that better aligns with the page, such as the page's brand color.

```css
html {
  accent-color: light-dark(var(--color-accent-light), var(--color-accent-dark));
}
```

### Issues to be aware of when using accent-color

- When placing visual elements over the accent color (e.g. a checkbox checkmark), Chrome and Safari will automatically select a contrasting color, whereas Safari will modify the accent color, and may not maintain adequate contrast.

### Scrollbar colors

You can use `scrollbar-color` together with `light-dark()` to set custom scrollbar colors that adapt to the color scheme used.

```css
:root {
  --color-scrollbar-track: light-dark(#eee, #222);
  --color-scrollbar-thumb: light-dark(#999, #666);
  scrollbar-color: var(--color-scrollbar-thumb) var(--color-scrollbar-track);
}
```

### Issues to be aware of when using scrollbar-color

- Do NOT animate or transition `scrollbar-color`. A [WebKit bug](https://bugs.webkit.org/show_bug.cgi?id=311752) causes the scrollbar to flicker every time `scrollbar-color` changes.
- On macOS, `scrollbar-color` (standard) and `::-webkit-scrollbar` (legacy) properties are ignored by default because macOS uses native "overlay" scrollbars. You MUST pair custom colors with `scrollbar-width` (e.g., `thin` or `auto`) to force macOS to render them.
- Even with `scrollbar-width` applied, macOS overlay scrollbars render the track (gutter) as transparent by default. If the design requires a visible track background color on MacOS, you MUST apply `scrollbar-gutter: stable;` to the scrollable container, but note that it only appears after the user hovers over the scrollbar.
- Even with `scrollbar-gutter: stable` the track may be transparent on MacOS. The thumb should not depend on the track color to be visible.

### Further customization

Most browser UI exposes pseudo-elements to fully customize its appearance, such as:
- `::placeholder`
- `::spelling-error`
- `::grammar-error`
- `::selection`
- `::search-text`
- `::target-text`
- `::file-selector-button`

You can use `light-dark()` colors on any of these to apply colors that adapt to the used color scheme.

## OPTIONAL: Implementing a color-scheme toggle

**DO NOT** set `color-scheme: light` or `color-scheme: dark` on the root element by default.
The default color-scheme MUST be the user's system preference, which happens automatically when setting `color-scheme` to `light dark`.

For website-specific customization, a manual toggle could be provided to allow users to choose between light, dark, or system-default modes.

If a user-facing toggle to override it is desired, it should:
- Update the `<meta name="color-scheme">` element to reflect the chosen theme (`light dark` for system default, `light` for light, and `dark` for dark).
- If branching is desired for non-color values, set a class on `<html>` to match the theme preference and use descendant selectors. While `:root:has(> head > meta[name="color-scheme"][content="dark"])` would technically work, it is slower and confers no benefit, since we are already using JS to update the `<meta>` element.
- Persist user choice in `localStorage`.
- **IMPORTANT**: The CSS should be written to default to the system preference, with overrides for user-specified color-schemes. That way, if JS fails to execute, the site still defaults to the system color-scheme.
- The system-level OS theme can change at any time. If you are using JS to read `matchMedia("(prefers-color-scheme: dark)").matches`, you MUST also use `addEventListener("change", fn)` to react to changes. CSS automatically adapts to changes.
- **IMPORTANT**: To avoid a Flash of Unstyled Content (FOUC) for users who have pinned a different color scheme than their system default, use an inline script (NOT `type=module`, NOT `defer`) to set it when the page loads:

```html
<meta name="color-scheme" content="light dark">
<script>
{
  const colorScheme = localStorage.getItem("color-scheme");
  if (colorScheme) {
    document.querySelector('meta[name="color-scheme"]').content = colorScheme;
  }
}
</script>
```

### UX considerations

Use a two-state control:
1. System setting.
2. The opposite (e.g. light when the system setting is dark, and dark when the system setting is light). Selecting this setting must pin that exact color scheme, not a dynamically computed "opposite of system setting" value. Example scenario:
    1. The OS is set to light mode.
    2. The user selects the opposite setting for this website (dark).
    3. The user changes their system setting to dark.
    4. The website should remain dark.

**DON'T** expose all three states (system, light, dark). While the rationale is plausible — "Follow system (currently dark)" is a distinct user intent from "Always dark" — it provides suboptimal UX:
- Users cannot meaningfully express intent for problems they don't currently have. A manual toggle is a temporary comfort adjustment ("it's too bright right now"), not a long-term preference ("make sure this never changes").
- Two of the three options always produce the same visual result, violating the principle of feedback.

## Component-specific overrides

You can override the global theme for specific elements by setting `color-scheme` on them.
This is useful for "dark mode" sections within a light-themed site, such as code blocks or media players.

```css
pre, code {
  /* Forces element and its children to use dark themed UI */
  color-scheme: dark;
}
```

For more information about component-specific overrides and their gotchas, see `component-specific-light-dark-theme` (via `npx -y modern-web-guidance@latest retrieve "component-specific-light-dark-theme"`).

## Known issues to be aware of

### Issues to be aware of when using color-scheme

- Chrome and Firefox respect `color-scheme` for iframes: they render embedded pages in the correct color scheme and adjust the embedded page's `prefers-color-scheme` media query to reflect the embedding context's `color-scheme`. Safari does not, and resolves `prefers-color-scheme` to the system setting even inside iframes.
  - **If you control both parent and iframe:** pass the parent's color scheme to the iframe explicitly — via a URL parameter (`?theme=dark`) at iframe construction time, or via `postMessage()` (which also lets you react to runtime changes). In the iframe, set a class on `<html>` (and/or `color-scheme` on `:root`) from that signal instead of relying on `prefers-color-scheme`.
  - **If you only control the embedded page:** there is no reliable way to detect the embedding context's `color-scheme` from inside the iframe in Safari. Expose an explicit theme parameter on your embed API (e.g. a query string or `postMessage` protocol) and document it for embedders.

## Fallback strategies

### Fallbacks & browser support for color-scheme

Baseline status for color-scheme: Widely available. It's been Baseline since 2022-02-03.
Supported by: Chrome 98 (Feb 2022), Edge 98 (Feb 2022), Firefox 96 (Jan 2022), and Safari 13 (Sep 2019).

The `color-scheme` property is **progressive enhancement**.
Browsers that do not support it will ignore this property and use their default light-mode UI.

To adapt to the user's preferences in older browsers, use `prefers-color-scheme` media queries to provide different colors when dark mode is preferred.

- DO use the media query to switch custom properties on `:root` or `html`
- Avoid using the media query on individual components unless the component requires a very specific type of dark mode customization beyond colors.

```css
:root {
  /* Define brand colors for each mode */
  --color-brand-light: #0056b3;
  --color-brand-dark: #00e5ff;
  --color-brand: var(--color-brand-light);

  /* MANDATORY: Fallback for browsers without light-dark support */
  @media (prefers-color-scheme: dark) {
    --color-brand: var(--color-brand-dark);
  }

  /* Ignored in older browsers */
  color-scheme: light dark;
}

button.primary {
	background-color: var(--color-brand);
}
```

### Fallbacks & browser support for light-dark()

Baseline status for light-dark(): Newly available. It's been Baseline since 2024-05-13.
Supported by: Chrome 123 (Mar 2024), Edge 123 (Mar 2024), Firefox 120 (Nov 2023), and Safari 17.5 (May 2024).

For browsers that support `color-scheme` but not yet `light-dark()`, light and dark versions of colors should first be defined as custom properties, and the `prefers-color-scheme` media query should be used to set colors for the respective mode like in the example below:

```css
:root {
  /* Define browser UI accent color for each mode */
  --brand-accent-light: #0056b3;
  --brand-accent-dark: #00e5ff;
  --accent-color: var(--brand-accent-light);

  /* MANDATORY: Fallback for browsers without light-dark support */
  @media (prefers-color-scheme: dark) {
    --accent-color: var(--brand-accent-dark);
  }

  /* OPTIONAL: use light-dark() for more control of built-in UI colors */
  @supports (color: light-dark(white, black)) {
    --accent-color: light-dark(var(--brand-accent-light), var(--brand-accent-dark));
  }

  /* MANDATORY: Automatically adapt native UI to user system preferences */
  color-scheme: light dark;

  /* Example inherited color property */
  accent-color: var(--accent-color);
}

pre, code {
  color-scheme: dark;

  /* **Mandatory**: any inherited color properties must be set again, even if to the same design tokens */
  accent-color: var(--accent-color);
}
```

### Fallbacks & browser support for scrollbar-color

Baseline status for scrollbar-color: Newly available. It's been Baseline since 2025-12-12.
Supported by: Chrome 121 (Jan 2024), Edge 121 (Jan 2024), Firefox 64 (Dec 2018), and Safari 26.2 (Dec 2025).

This feature is progressive enhancement and does not always require fallbacks.

If the styling is important and the user's Baseline target is "Baseline Widely Available" or earlier, you SHOULD include the non-standard `::-webkit-scrollbar` pseudo-elements as fallbacks.

Wrap legacy fallbacks in an `@supports not (scrollbar-color: auto)` block to prevent conflicts between standard properties and legacy WebKit selectors in browsers that support both natively.

If you are using custom properties to define colors, these will cascade to the legacy WebKit selectors automatically. You do NOT need to duplicate them.

```css
/* Legacy fallback for WebKit/Blink browsers */
@supports not (scrollbar-color: auto) {
  .scroller::-webkit-scrollbar {
    /* Must define base size in WebKit for custom colors to be visual */
    width: 12px;
    height: 12px;
  }

  .scroller::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb);
  }

  .scroller::-webkit-scrollbar-track {
    background: var(--scrollbar-track);
  }
}
```

### Fallbacks & browser support for accent-color

accent-color has limited availability.
Supported by: Chrome 93 (Aug 2021), Edge 93 (Sep 2021), and Firefox 92 (Sep 2021).
Unsupported in: Safari.

The `accent-color` property is progressive enhancement.
Browsers that do not support this property will ignore it and use their default UI colors.
