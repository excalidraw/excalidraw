# CSS Layouts and Responsive Design

1. [1 Fundamentals](#1-fundamentals)
   1. [Which layout mode to use?](#11-which-layout-mode-to-use)
   2. [Working principles](#12-working-principles)
2. [2 Flexbox](#2-flexbox)
3. [3 Grid and subgrid](#3-grid-and-subgrid)
   1. [Code example: grid and subgrid](#31-code-example-grid-and-subgrid)
4. [4 Container queries](#4-container-queries)
   1. [Code example: fluid typography using container query units](#41-code-example-fluid-typography-using-container-query-units)
5. [5 Native overlays, anchor positioning, and stacking contexts](#5-native-overlays-anchor-positioning-and-stacking-contexts)
6. [6 Overflow tracking and layout stability](#6-overflow-tracking-and-layout-stability)
7. [7 Viewport mechanics and track distribution](#7-viewport-mechanics-and-track-distribution)
8. [8 Grid lanes (aka masonry)](#8-grid-lanes-aka-masonry)

## 1 Fundamentals

Lean on the browser's layout engine when possible for better performance. Reach for intrinsic sizing, logical properties, and `aspect-ratio` before resorting to hardcoded dimensions or complicated media-queries.

### 1.1 Which layout mode to use?

Walk the decision tree top-to-bottom and stop at the first match. Note that layouts can be nested within each-other and each decision is based on the use-case for that container.

1. **Is it a simple row OR column of items?** Use **flexbox** — 1D, content-first, content distributes along a single axis.
2. **Does a nested element need to line up with its grandparent grid's tracks?** Use **subgrid** — 2D, relationship-first, inherits parent tracks so grandchildren can align across siblings.
3. **Is it a complex page or component structure with rows AND columns?** Use **grid** — 2D, layout-first, you define the skeleton and content fills it.
4. **Is the content a long flow of prose that should split into balanced columns?** Use **multi-column** — 1D flow, newspaper-style.
5. **Are items of varied heights that need to be packed tightly?** Use **grid** with `grid-auto-flow: dense` today; reach for native masonry (aka "grid lanes") only when it ships in your Baseline target (see [§8](#8-grid-lanes-aka-masonry)).
6. **Does an element need to float above the page and stay spatially tethered to a trigger, even across DOM boundaries or stacking contexts?** Use **anchor positioning** — `anchor-name` on the trigger, `position-anchor` on the overlay (see [§5](#5-native-overlays-anchor-positioning-and-stacking-contexts)).

### 1.2 Working principles

**Do:**

- Use logical properties (`inline-size`, `block-size`, `margin-inline`, `padding-block`, `inset-inline-start`) for layout dimensions and spacing — see `css` (via `npx -y modern-web-guidance@latest retrieve "css"`) for full coverage.
- Apply the content-first vs layout-first mental model: flexbox when items dictate flow, grid when you define the skeleton first.
- Use the `place-*` shorthands (`place-content`, `place-items`, `place-self`) to align across both axes in one declaration.
- Reach for intrinsic sizing (`min-content`, `max-content`, `fit-content()`) and flexible tracks (`fr`, `minmax()`) before fixed `width`/`height` — fewer media queries, more resilient layouts.
- Use `aspect-ratio` to reserve space for media and prevent layout shift before assets load.

```css
.sidebar       { inline-size: max-content; }    /* Size to longest unbreakable token. */
.main-content  { inline-size: fit-content; }    /* Grow to available space, no further. */
.media         { aspect-ratio: 16 / 9; inline-size: 100%; block-size: auto; }
body.centered  { display: grid; place-content: center; min-block-size: 100dvb; }
```

> For `calc-size()` and constraint-aware intrinsic sizing, see `calculate-with-intrinsic-sizes` (via `npx -y modern-web-guidance@latest retrieve "calculate-with-intrinsic-sizes"`).

## 2 Flexbox

One-dimensional layout — items flow along a single **main** axis with alignment on the **cross** axis. Reach for it for navbars, toolbars, item rows, and any single-row-or-column distribution.

**Do:**

- Establish a context with `display: flex` and set the main axis with `flex-direction` (`row` default).
- Use `flex-wrap: wrap` whenever overflow is a possibility — `nowrap` without `overflow: auto/hidden` will spill on narrow viewports.
- Use the `flex` shorthand `<grow> <shrink> <basis>` (e.g., `flex: 1 1 250px`) on items rather than setting `flex-grow`/`flex-shrink`/`flex-basis` individually.
- Use `gap` (or the `row-gap`/`column-gap` longhand) for spacing between items instead of child margins.
- Prefix positional alignment with `safe` (e.g., `align-items: safe center`) so focusable content isn't clipped when the container is narrower than its content.
- Push a single item to the far end of the main axis with `margin-inline-start: auto` (or `margin-block-start: auto`) — that's the standard escape hatch.
- Override cross-axis alignment per item with `align-self`.
- Use `align-items` to center all items on the cross axis; use `margin: auto` on a single item to center it on both axes independently; use `align-content` only when the container wraps and has extra space across rows.
- Set `min-inline-size: 0` (or `min-width: 0`) on flex items that contain long unbreakable content (URLs, code, long strings) — flex items won't shrink below their content size by default, causing overflow.

**Do not:**

- Don't reach for `justify-self` on flex items — it only works on grid, block, and absolutely-positioned layouts. Use auto margins instead.
- Don't use `order` or `flex-direction: *-reverse` to reorder interactive content. They change visual order only; the DOM order still drives sequential focus, so keyboard tab flow won't match what the user sees.
- Don't confuse `space-around` (half-gap at the ends) with `space-evenly` (equal gaps before, between, and after).
- Don't forget the axis flip: when `flex-direction: column`, `justify-content` aligns on the block axis and `align-items` aligns on the inline axis — the opposite of the default.
- Don't size both the container and its children to fill each other — that's a common source of overflow and surprising results. Give one side a definite size.
- Don't set both `flex-basis` and `width`/`inline-size` on the same item — `flex-basis` takes precedence in a flex context and `width` is ignored. Use `flex-basis` (or the `flex` shorthand) as the single source of truth for sizing flex items.

```css
.card-grid        { display: flex; flex-flow: row wrap; gap: 1rem; }
.card-item        { flex: 1 1 250px; }                  /* grow, shrink, basis */
.card-item-action { margin-inline-start: auto; }        /* Push to main-axis end. */
.toolbar          { display: flex; align-items: safe center; }
```

## 3 Grid and subgrid

Baseline status for Subgrid: Widely available. It's been Baseline since 2023-09-15.
Supported by: Chrome 117 (Sep 2023), Edge 117 (Sep 2023), Firefox 71 (Dec 2019), and Safari 16 (Sep 2022).

Two-dimensional layout — define rows AND columns explicitly, or let the engine derive them. Subgrid lets a nested grid inherit its parent's tracks so grandchildren align across siblings.

**Choosing grid features:**

- Do you know exactly how many columns you need?
  - **Yes** — use explicit tracks (`grid-template-columns: 200px 1fr`, `repeat(3, 1fr)`, etc.)
    - Do different columns need different sizes (sidebar + main, header spanning all)? → use `grid-template-areas` for named, readable regions
    - Are all columns uniform or positioned purely by line number? → use `repeat(N, ...)` or named lines
  - **No** (responsive, unknown item count) — use `repeat(auto-fit, minmax(min, 1fr))`
    - Should items on the last row stretch to fill remaining space? → `auto-fit`
    - Should empty last-row tracks hold their min size (preserving column ghost slots)? → `auto-fill`
- Do you need to place an item at a specific location?
  - **Yes** — use `grid-column: <start> / <end>` or `grid-area: <name>`
  - **No** (just spanning multiple tracks, flow position doesn't matter) — use `grid-column: span <n>`
- Do child elements need to inherit the parent grid's track sizes (ragged-edge alignment across siblings)?
  - **Yes** — use subgrid on the affected axis
    - Is the number of children per cell variable? → subgrid **one axis only**; use `grid-auto-rows`/`grid-auto-columns` for the other
    - Is the child count fixed? → subgrid on both axes is fine
  - **No** — standard grid, no subgrid needed

**Do:**

- Establish a context with `display: grid`.
- Use `grid-template-areas` for complex page-level layouts — area names are self-documenting and the declaration can be aligned in rows and columns for at-a-glance readability.
- Use `repeat(auto-fit, minmax(200px, 1fr))` for responsive card grids that stretch filled tracks to fill the row, or `auto-fill` to preserve empty repeated tracks at their min size.
- Use `fr` for proportional track distribution and `minmax(min, max)` for flexible-but-bounded tracks.
- Position items with `grid-column: span <n>` to size across tracks, `grid-column: <start> / <end>` to place at specific lines, or `grid-area: <name>` for named regions.
- Use subgrid (`grid-template-columns: subgrid` or `grid-template-rows: subgrid`) to solve the "ragged edge" problem in card lists — internal elements like titles, metadata, and CTAs line up across siblings.
- Pair a subgrid declaration with a preceding explicit `grid-template-rows`/`-columns` declaration as a same-cascade fallback for older browsers.

**Do not:**

- Don't expect `auto-fit`/`auto-fill` track size to come from item content — it comes from the `repeat()` size argument.
- Don't use `grid-auto-flow: dense` on interactive content. It packs items efficiently but reorders them visually, breaking DOM-order keyboard tab flow.
- Don't apply subgrid to both axes when the child count is variable. Extras land in the last track; use `grid-auto-rows`/`grid-auto-columns` for the implicit axis instead.
- Don't confuse `justify-items`/`align-items` (aligns item content *within its track*) with `justify-content`/`align-content` (aligns the grid tracks *within the container*). Using the wrong one silently has no effect.
- Don't use `repeat(auto-fit/auto-fill, ...)` without a definite `inline-size` on the container — inside `display: inline-grid` or an unsized flex item, the container has no width to divide, making track counts unpredictable.

### 3.1 Code example: grid and subgrid

Page shell: `<main class="page-layout">` contains `<header>`, `<aside>`, a `<section class="card-grid">` with `<div class="card">` children, and `<footer>`.

```css
/* Align grid-template-areas in rows and columns for readability. */
.page-layout {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-areas:
    "header  header  header"
    "sidebar main    main"
    "footer  footer  footer";
  gap: 1.5rem;
}

header  { grid-area: header; }
aside   { grid-area: sidebar; }
footer  { grid-area: footer; }

.card-grid {
  grid-area: main;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  grid-template-rows: auto 1fr; /* title block, body block */
  gap: 1rem;
}

.card {
  grid-row: span 2;
  display: grid;
  /* Same-cascade fallback: ignored when subgrid is supported. */
  grid-template-rows: auto 1fr;
  grid-template-rows: subgrid;
}
```

## 4 Container queries

Baseline status for Container queries: Widely available. It's been Baseline since 2023-02-14.
Supported by: Chrome 105 (Sep 2022), Edge 105 (Sep 2022), Firefox 110 (Feb 2023), and Safari 16 (Sep 2022).

Query the size (or computed style) of an ancestor container rather than the viewport. Mental model: container queries = component context; media queries = global page layout and user preferences (`prefers-color-scheme`, `prefers-reduced-motion`).

**Do:**

- Establish a containment context with `container-type: inline-size` (width-only queries) or `container-type: size` (both axes) on a wrapper before its descendants can be queried.
- Name containers with `container-name` (or the `container` shorthand: `container: inline-size card`) when nested contexts could collide.
- Include container query units in calculating fluid type and spacing: `cqi`/`cqb` (logical inline/block), `cqw`/`cqh` (physical), `cqmin`/`cqmax`.
- Give the container a definite `block-size` whenever `container-type: size` is used — without one, descendants collapse because size containment forces the container to ignore its content.

**Do not:**

- Don't use `block-size` as a `container-type` value — it isn't valid. Use `size` for both axes.
- Don't expect children's intrinsic size to influence the container after declaring `container-type`. The container is computed as if it has no children once containment is active.
- Don't rely on container query units inside descendants of a non-qualifying ancestor; they fall back to the small viewport (`svw`/`svh`).

### 4.1 Code example: fluid typography using container query units

```css
.card-wrapper {
  container: inline-size / card; /* shorthand for container-type + container-name */
}

@container card (inline-size > 400px) {
  .content {
    display: flex;
    gap: 2rem;
  }
}

.title {
  /* Fluid type bound to the container width, not the viewport. */
  font-size: clamp(1rem, 4cqi, 2rem);
}
```

> For component-driven responsive styling patterns, see `size-aware-styling` (via `npx -y modern-web-guidance@latest retrieve "size-aware-styling"`) and `fluid-scaling` (via `npx -y modern-web-guidance@latest retrieve "fluid-scaling"`).

## 5 Native overlays, anchor positioning, and stacking contexts

Baseline status for <dialog>: Widely available. It's been Baseline since 2022-03-14.
Supported by: Chrome 37 (Aug 2014), Edge 79 (Jan 2020), Firefox 98 (Mar 2022), and Safari 15.4 (Mar 2022).
Baseline status for Popover: Newly available. It's been Baseline since 2025-01-27.
Supported by: Chrome 116 (Aug 2023), Edge 116 (Aug 2023), Firefox 125 (Apr 2024), Safari 17 (Sep 2023), and Safari iOS 18.3 (Jan 2025).
Anchor positioning is not natively supported by any major browser yet.

**When to use each overlay primitive:**

- Use `popover` for transient, non-modal UI (flyouts, toasts, tooltips) — lives in the top layer, no `z-index` management needed.
- Use `<dialog>` with `.showModal()` for modal interactions that require focus trapping and an inert backdrop.
- Don't combine `popover` and `.showModal()` on the same element — they're mutually exclusive runtime states.

**Anchor positioning (spatial layout of overlays):**

- Use `position-area` (or `anchor()` on insets) and `anchor-size()` to position and size an overlay relative to its trigger.
- Use `position-try-fallbacks: flip-block` (or `flip-inline`) to let the browser reposition when the overlay overflows the viewport.
- Don't mix physical and logical keywords in a single `position-area` value — pick one coordinate system.
- Feature-detect with `@supports (anchor-name: --x)` and provide an absolute-position fallback.

> For full implementation detail, polyfill strategies, and `popover` value reference, see `declarative-dialog-popover-control` (via `npx -y modern-web-guidance@latest retrieve "declarative-dialog-popover-control"`) and `position-aware-tooltips` (via `npx -y modern-web-guidance@latest retrieve "position-aware-tooltips"`). For anchor positioning applied to menus and tab indicators, see `resilient-context-menus-and-nested-dropdowns` (via `npx -y modern-web-guidance@latest retrieve "resilient-context-menus-and-nested-dropdowns"`) and `anchor-positioning-tab-underline` (via `npx -y modern-web-guidance@latest retrieve "anchor-positioning-tab-underline"`).

## 6 Overflow tracking and layout stability

Baseline status for scrollbar-gutter: Newly available. It's been Baseline since 2024-12-11.
Supported by: Chrome 94 (Sep 2021), Edge 94 (Sep 2021), Firefox 97 (Feb 2022), and Safari 18.2 (Dec 2024).
line-clamp is not natively supported by any major browser yet.

Manage layout shifts, scrollbars, and clipping predictably.

**Do:**

- Use `overflow: auto` so scrollbars appear only when content actually overflows.
- Use `overflow: clip` to clip content **without** establishing a scroll container; opt into spillover with `overflow-clip-margin`.
- Use `scrollbar-gutter: stable` to reserve space for scrollbars and prevent layout shifts when content grows.
- Use `overscroll-behavior: contain` (or `none`) on scrollable containers to stop scroll chains from bubbling into the parent or document.
- Use the `-webkit-line-clamp` + `display: -webkit-box` + `-webkit-box-orient: vertical` triad for multi-line truncation — despite the prefix, this pattern is fully specified and not deprecated. Declare the unprefixed `line-clamp` shorthand alongside it; browsers that don't yet support it ignore the property harmlessly.
**Do not:**

- Don't use `overflow: scroll` when `auto` will do — `scroll` forces scrollbars even when there's nothing to scroll.
- Don't reach for `overflow: hidden` when you only want to clip — `hidden` establishes a scroll container that can be programmatically scrolled.

```css
.scrollable-list {
  max-block-size: 400px;
  overflow-y: auto;
  scrollbar-gutter: stable;       /* Reserve scrollbar space. */
  overscroll-behavior: contain;   /* No scroll chaining into the page. */
}

.snippet {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  line-clamp: 3;                  /* Ignored where unsupported. */
  overflow: clip;
}
```

> For `overflow: clip` and `overflow-clip-margin` in depth, see `overflow-clipping-control` (via `npx -y modern-web-guidance@latest retrieve "overflow-clipping-control"`). For scrollbar color, sizing, and theming, see `customize-scrollbar-color-and-thickness` (via `npx -y modern-web-guidance@latest retrieve "customize-scrollbar-color-and-thickness"`), `dark-mode` (via `npx -y modern-web-guidance@latest retrieve "dark-mode"`), and `adapt-scrollbar-to-contrast-preferences` (via `npx -y modern-web-guidance@latest retrieve "adapt-scrollbar-to-contrast-preferences"`).

## 7 Viewport mechanics and track distribution

Baseline status for Small, large, and dynamic viewport units: Widely available. It's been Baseline since 2022-12-05.
Supported by: Chrome 108 (Nov 2022), Edge 108 (Dec 2022), Firefox 101 (May 2022), and Safari 15.4 (Mar 2022).

- Use `dvh`/`dvw` for mobile layout containers that must account for browser UI shifting (URL bar collapse/expand).
- Don't use `100vw` for full-width layout — it ignores scrollbar width and causes horizontal overflow. Use `100%`, `100dvw`, or `100svw` instead.

> For the full viewport unit reference (`svh`, `lvh`, `dvi`, `dvb`, etc.), see `css` (via `npx -y modern-web-guidance@latest retrieve "css"`).

## 8 Grid lanes (aka masonry)

Masonry is not natively supported by any major browser yet.

The spec is in development. The currently agreed-upon name is "grid lanes" (e.g., `display: grid-lanes`). Firefox ships `grid-template-rows: masonry` behind a flag; no other engines ship it in stable as of this writing.

**Do:**

- Use grid with `grid-auto-flow: dense` for tight packing today, accepting that DOM order may not match visual order.
- Use multi-column (`columns: 3; column-gap: 1rem`) for content-heavy masonry-like flow when items are document fragments rather than equal-weight cards.
- Treat `grid-template-rows: masonry` as a progressive enhancement only — feature-detect with `@supports`.

**Do not:**

- Don't ship `grid-template-rows: masonry` as a hard requirement until your Baseline target catches up.

```css
.gallery       { columns: 3 200px; column-gap: 1rem; }
.gallery > *   { break-inside: avoid; margin-block-end: 1rem; }

@supports (grid-template-rows: masonry) {
  .gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    grid-template-rows: masonry;
    gap: 1rem;
    columns: unset;
  }
}
```
