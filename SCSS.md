# SCSS Reference Guide

A detailed breakdown of SCSS syntax using real examples from the Excalidraw codebase.

---

## Deep Dive: `FilledButton.scss` lines 63–77

```scss
&[disabled] {
  cursor: not-allowed;

  &.ExcButton--variant-filled,
  &:hover {
    --back-color: var(--color-surface-low) !important;
    --text-color: var(--color-on-surface-variant) !important;
  }

  &.ExcButton--variant-outlined,
  &.ExcButton--variant-icon {
    --text-color: var(--color-on-surface-variant);
    --border-color: var(--color-surface-high);
  }
}
```

This block lives inside `.excalidraw { .ExcButton { ... } }`, so every `&` below refers to `.ExcButton`.

---

### Line 63 — `&[disabled]`

```scss
&[disabled] {
```

**`&`** — The SCSS parent selector reference. It is replaced at compile time with whatever selector wraps the current block. Here the parent is `.ExcButton`, so `&[disabled]` compiles to:

```css
.excalidraw .ExcButton[disabled]
```

**`[disabled]`** — A CSS **attribute selector**. It matches any element that has the `disabled` HTML attribute set, regardless of its value. For example:

```html
<button disabled>...</button>          <!-- matched -->
<button disabled="true">...</button>   <!-- matched -->
<button>...</button>                   <!-- NOT matched -->
```

Attribute selectors always use square brackets `[ ]`. Other examples:
```scss
[type="text"]       // input with type="text"
[href]              // any element with an href attribute
[data-active]       // any element with a data-active attribute
```

---

### Line 64 — `cursor: not-allowed`

```scss
cursor: not-allowed;
```

A plain CSS property. Sets the mouse cursor to the "blocked" symbol (⊘) when the user hovers over a disabled button. This gives a visual hint that the element is not interactive.

Other common cursor values: `pointer` (hand), `default` (arrow), `text` (I-beam), `grab`, `crosshair`.

---

### Line 66–70 — `&.ExcButton--variant-filled, &:hover`

```scss
&.ExcButton--variant-filled,
&:hover {
  --back-color: var(--color-surface-low) !important;
  --text-color: var(--color-on-surface-variant) !important;
}
```

**`&.ExcButton--variant-filled`** — `&` is again `.ExcButton[disabled]`, and `.ExcButton--variant-filled` is chained directly (no space). No space means "the same element has both". So this compiles to:

```css
.excalidraw .ExcButton[disabled].ExcButton--variant-filled
```

This targets a button that is simultaneously disabled AND has the variant-filled class.

**The comma `,`** — CSS/SCSS selector grouping. "Apply these styles to selector A **OR** selector B." Both selectors get the same rules. Equivalent to writing the block twice.

**`&:hover`** — A CSS **pseudo-class**. Matches when the user's mouse is over the element. Combined with `&` (which is `.ExcButton[disabled]`) this compiles to:

```css
.excalidraw .ExcButton[disabled]:hover
```

So hovering over any disabled button also gets these styles — preventing hover states from "un-graying" a disabled button.

**`--back-color`** — A **CSS custom property** (also called a CSS variable). The double dash `--` prefix is the required syntax. This is not setting a background directly — it's setting a variable that is consumed elsewhere in the file:

```scss
background-color: var(--back-color);  // defined earlier in .ExcButton
```

So the variable acts as an indirect way to control the background color.

**`var(--color-surface-low)`** — The `var()` function reads the value of another CSS custom property. `--color-surface-low` is defined in the global theme variables (`variables.module.scss`) and resolves to a muted grey. This is how theming works — swap the variable values for dark mode rather than rewriting all the rules.

**`!important`** — Forces this declaration to override any other rule targeting the same property, regardless of specificity. Without `!important`, the primary button color defined earlier would win because it's more specific. With `!important` on both, the more specific selector wins (see priority rules below).

---

### Lines 72–76 — `&.ExcButton--variant-outlined, &.ExcButton--variant-icon`

```scss
&.ExcButton--variant-outlined,
&.ExcButton--variant-icon {
  --text-color: var(--color-on-surface-variant);
  --border-color: var(--color-surface-high);
}
```

Same pattern as above — two selectors grouped with a comma, both get the same rules. These target the other two button visual styles (outlined = border only, icon = no text).

Note there is **no `!important`** here. This works because outlined/icon buttons don't have a competing `!important` rule in their color definitions — the specificity alone is enough to win.

**`--border-color`** — Another internal CSS variable consumed by:
```scss
border-color: var(--border-color);  // defined earlier in .ExcButton
```

---

## Core SCSS Concepts

### Nesting

SCSS lets you nest selectors inside each other. The compiler flattens them into standard CSS.

```scss
// SCSS
.card {
  padding: 1rem;

  .title {
    font-size: 1.5rem;
  }

  &:hover {
    background: #f0f0f0;
  }
}

// Compiled CSS
.card { padding: 1rem; }
.card .title { font-size: 1.5rem; }
.card:hover { background: #f0f0f0; }
```

### The `&` parent selector

`&` is replaced with the full selector of the parent block at compile time.

```scss
.button {
  &--primary { }        // .button--primary
  &:hover { }           // .button:hover
  &[disabled] { }       // .button[disabled]
  &.is-active { }       // .button.is-active  (same element, two classes)
  .icon & { }           // .icon .button      (& can go anywhere)
}
```

### Variables

SCSS has its own variables (compile-time) separate from CSS custom properties (runtime).

```scss
// SCSS variable — resolved at build time, gone in output CSS
$primary-color: #6965db;
.button { background: $primary-color; }

// CSS custom property — survives in output, can change at runtime (e.g. dark mode)
:root { --primary-color: #6965db; }
.button { background: var(--primary-color); }
```

Excalidraw uses CSS custom properties for theming because they can be swapped at runtime for dark mode. SCSS variables are used for things that never change (spacing constants, breakpoints).

### Mixins

Reusable blocks of CSS. Called with `@include`.

```scss
// Definition
@mixin isMobile {
  @media (max-width: 768px) {
    @content;  // @content is replaced with whatever you pass in
  }
}

// Usage
.modal {
  width: 50%;

  @include isMobile {
    width: 100%;
  }
}

// Compiled CSS
.modal { width: 50%; }
@media (max-width: 768px) { .modal { width: 100%; } }
```

### `@use`

Imports another SCSS file's variables, mixins, and functions into the current file.

```scss
@use "../css/variables.module" as *;
// The "as *" means import everything into the global namespace
// so you can write @include isMobile instead of @include variables.isMobile
```

---

## Specificity & `!important` Priority

When two rules target the same property, the winner is determined by:

1. `!important` inline style — `style="color: red !important"`
2. `!important` with higher specificity selector
3. `!important` with lower specificity selector
4. Normal rule with higher specificity
5. Normal rule with lower specificity
6. Source order — later in the file wins if everything else is equal

**Specificity is calculated as a score `(A, B, C)`:**

| Selector type | Score |
|---|---|
| ID selector `#foo` | `(1, 0, 0)` |
| Class `.foo`, attribute `[foo]`, pseudo-class `:hover` | `(0, 1, 0)` |
| Element `div`, pseudo-element `::before` | `(0, 0, 1)` |

Examples:
```
.ExcButton[disabled]                              → (0, 2, 0)
.ExcButton[disabled].ExcButton--variant-filled    → (0, 3, 0)  ← wins
```

This is why the override in `TerraformImportDialog.scss` wins over `FilledButton.scss` — it adds `.TerraformImportModal__settings__buttons` to the chain, increasing the score.

---

## BEM Naming Convention

Excalidraw follows **BEM** (Block, Element, Modifier) for class names:

```
.ExcButton                        ← Block
.ExcButton__contents              ← Element  (double underscore __)
.ExcButton--variant-filled        ← Modifier (double dash --)
.ExcButton--color-primary         ← Modifier
```

In SCSS this maps cleanly to nesting with `&`:

```scss
.ExcButton {
  &__contents { }         // .ExcButton__contents
  &--variant-filled { }   // .ExcButton--variant-filled
  &--color-primary { }    // .ExcButton--color-primary
}
```
