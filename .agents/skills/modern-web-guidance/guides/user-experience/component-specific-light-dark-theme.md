# Component-specific light/dark themes

While more commonly set on the root, the `color-scheme` property can be set on individual elements to force them into a different color scheme from the rest of the page.
This can be useful for components that must always be viewed in a specific color scheme (e.g. always in dark or light mode).

Example use cases include:
- Elements that are often in dark mode even on light mode pages for aesthetic reasons, e.g. code blocks, media players, photo galleries
- Areas that contain media designed for a light background (e.g. images, videos, illustrations, print previews) can be set to light mode even if the rest of the page is in dark mode.
- Elements whose color-scheme is controlled by a user-level setting, such as component previews
- Embeds that don't support both light and dark modes
- Design tools, maps, visualizations, games etc.

## When to change colors vs. when to force `color-scheme`?

Not every element that uses lighter text on darker background in light mode or darker text on lighter background in dark mode needs a different `color-scheme`.
For example, a primary button may be rendered as blue with white text in light mode, but that does not warrant a `color-scheme: dark`.

As a rule of thumb, typically elements using a different `color-scheme` are complex surfaces establishing their own visual context, rather than simple shallow containers.

When considering using a different `color-scheme` on an element, ask yourself:

- Should built-in browser UI that is not otherwise customized (e.g. form controls, scrollbars, etc) use that color-scheme or adapt to the page's color-scheme? -> if the former, don't use `color-scheme`.
- Should any `light-dark()` colors resolve like they do for the rest of the page or based on the override? -> if the former, don't use `color-scheme`.
- Should descendants be in that `color-scheme`? If not, don't use `color-scheme`.

## Basic implementation

Component-specific overrides are typically (though not strictly necessarily) used on pages that also support multiple color schemes via a global `color-scheme`.
For implementing page-wide dark mode well, see `dark-mode` (via `npx -y modern-web-guidance@latest retrieve "dark-mode"`).

Once a page-wide `color-scheme` is in place, and you are using color tokens sensitive to it (e.g. via `light-dark()`), you can simply set `color-scheme` on specific components to override the color mode for that subtree:

```css
pre, code, .dark {
  color-scheme: dark;
}
```

Note that some browsers automatically adapt components to a different color scheme anyway.
To force the specified color scheme in all cases, use `only`, i.e. `color-scheme: only dark;` instead of `color-scheme: dark;`.

### Adapting non-color values

`light-dark()` currently only works for colors.

## Best practices

- **MANDATORY**: Do not set `color-scheme` on elements without a background, as that risks mixing background and text color pairs from different color-schemes, resulting in unreadable text.
- **OPTIONAL**: While it is easier to reuse the same color pairs as the page-wide dark mode, we _can_ define different color pairs for these components. For example, we may want a dark mode component used in a light mode page to be a little less dark than when the same dark mode component is used in a page that is overall in dark mode.

## Known issues to be aware of

### Important gotcha: Inheritance of `light-dark()` colors

**`light-dark()` resolves at computed value time.**
This means that any inherited `<color>` properties set to a `light-dark()` color will only pass down one of the two colors to their descendants, not the `light-dark()` expression itself.

This includes:
- Built-in color properties that inherit, such as `color`, `accent-color`, `fill`, `stroke`, `text-shadow`, `caret-color`
- Any registered inheritable custom properties with `syntax: <color>` and `inherits: true`
- Any other `<color>` property set to `inherit`

This means you should:
- **NOT** register custom properties meant to hold *design tokens* (e.g. `--surface-color`) as `<color>`. Tokens need to keep their `light-dark()` expression live so descendants can re-resolve them under a different `color-scheme`.
- When setting `color-scheme` on an element, re-specify any inherited `<color>` properties that may have been set to `light-dark()` values (directly or via design tokens), even if that's to the same design token.
- **NOT** use `inherit` on `<color>` properties on elements with a `color-scheme` override (fine to use on their descendants).
- **DO** use registered `<color>` properties for the *opposite* use case: when you deliberately want to snapshot the ancestor's resolved color and prevent it from re-resolving under the descendant's `color-scheme`. For example, capturing the page background to use elsewhere.
- If you need to animate a color, use a separate `@property`-registered `<color>` property on the element being animated (registration is required for color interpolation) — this is not a design token, but a per-element animation target, so it does not conflict with the rule above.

Example:

```css
:root {
	--accent-color: light-dark(blue, skyblue);
	--surface-color: light-dark(white, #222);
	--text-color: light-dark(#111, white);

	color-scheme: light dark;
	accent-color: var(--accent-color);
	color: var(--text-color);
}

body {
	/* --surface-color dynamically switches despite being inherited because --surface-color is not registered */
	background: var(--surface-color);
}

pre, code {
	color-scheme: dark;
	background: var(--surface-color);

	/* Without this, accent-color would be blue, not skyblue! */
	accent-color: var(--accent-color);

	/* Without this, text-color would be #111, not white! */
	color: var(--text-color);
}
```

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
