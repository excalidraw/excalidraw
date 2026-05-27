# Animate to Intrinsic Sizes

Animating elements to dynamic sizes like `block-size: auto` or `inline-size: max-content` has historically required JavaScript or fragile "max-height" hacks. The `interpolate-size` property and `calc-size()` function allow the browser to natively interpolate between fixed lengths and intrinsic sizing keywords.

## Implementation steps

1.  **Opt-in to keyword interpolation**: Apply `interpolate-size: allow-keywords` to a parent element (typically `:root`) to enable transitions for properties using intrinsic keywords.
2.  **Define the transition**: Set a `transition` for the sizing property (e.g., `block-size`, `inline-size`) on the target element.
3.  **Use intrinsic keywords**: Change the sizing property to a supported intrinsic keyword—`auto`, `min-content`, `max-content`, `fit-content`, or (for flex-basis) `content`—during an interaction (e.g., `:hover` or a state class).
4.  **Perform calculations (Optional)**: Use `calc-size()` if you need to perform math on an intrinsic size (e.g., `auto + 2rem`). `calc-size()` also supports the `any` keyword for basis-agnostic calculations.

## Example: Generic Expansion Pattern

You can apply this pattern to any container (like a "Show More" section or a navigation menu) to transition between a restricted height and the element's natural size.

```css
/* Opt-in globally for all children */
:root {
  /* MANDATORY: Transitions to intrinsic keywords are disabled by default for compatibility */
  interpolate-size: allow-keywords;
}

.expandable-container {
  /* 1. Define a fixed initial size (or 0) and hide overflow */
  block-size: 100px;
  overflow: hidden;
  
  /* 2. Transition the sizing property */
  transition: block-size 0.4s ease-out;
}

.expandable-container.is-expanded {
  /* 3. Smoothly animate to the intrinsic natural height */
  block-size: auto;
}
```

## Example: Calculated Intrinsic Inline-Size

```css
.badge {
  inline-size: 40px;
  overflow: hidden;
  white-space: nowrap;
  transition: inline-size 0.3s ease;
}

.badge:hover {
  /* calc-size(basis, calculation) */
  /* 'size' refers to the evaluated basis (max-content in this case) */
  inline-size: calc-size(max-content, size + 20px);
}
```

## Example: Transition from Intrinsic to Fixed

You can also animate in the opposite direction—starting from a natural size and collapsing to a specific length. This is useful for "dismissible" components.

```css
.collapsible-alert {
  /* 1. Start with the natural content height */
  block-size: auto;
  overflow: hidden;
  transition: block-size 0.5s ease-in-out, opacity 0.5s ease;
}

.collapsible-alert.is-dismissed {
  /* 2. Smoothly collapse to zero */
  block-size: 0;
  opacity: 0;
  pointer-events: none;
}

/* MANDATORY Copy-Paste Safety: Disable sizing animations for sensitive users */
@media (prefers-reduced-motion: reduce) {
  .expandable-container,
  .badge,
  .collapsible-alert {
    transition: none !important;
  }
}
```

```javascript
// MANDATORY Accessibility Synchronization: Ensure elements collapsed to zero dimensions are removed from the assistive technology tree, and sync aria-expanded states on triggers.
const alertElement = document.querySelector('.collapsible-alert');
alertElement.addEventListener('transitionend', (e) => {
  if (e.propertyName === 'block-size' && alertElement.classList.contains('is-dismissed')) {
    alertElement.hidden = true;
  }
});

// Example trigger syncer
const triggerBtn = document.querySelector('.accordion-trigger');
triggerBtn?.addEventListener('click', () => {
  const isExpanded = triggerBtn.getAttribute('aria-expanded') === 'true';
  triggerBtn.setAttribute('aria-expanded', !isExpanded);
});
```

## Key constraints

*   **Keyword-to-Keyword Restriction**: You cannot animate between two different keywords directly (e.g., from `min-content` to `max-content`). One end of the transition must be a fixed length or percentage (e.g., `0` to `auto`).
*   **Calc-size Syntax**: Inside `calc-size()`, you cannot mix different intrinsic keywords in the same expression. The first argument (the basis) defines what `size` represents.
*   **Opt-in Requirement**: Transitions to intrinsic keywords are disabled by default (`numeric-only`) to maintain backward compatibility. You must apply `interpolate-size: allow-keywords` to the element or an ancestor. `calc-size()` acts as a per-property override, automatically enabling interpolation whenever it is used.

## Fallback strategies

interpolate-size has limited availability.
Supported by: Chrome 129 (Sep 2024) and Edge 129 (Sep 2024).
Unsupported in: Firefox and Safari.
calc-size() has limited availability.
Supported by: Chrome 129 (Sep 2024) and Edge 129 (Sep 2024).
Unsupported in: Firefox and Safari.

`interpolate-size` and `calc-size()` are progressive enhancements. Browsers that do not support them will perform an instant jump to the target size.

*   **Graceful Degradation**: For simple `block-size: auto` transitions, standard browsers will simply toggle the size instantly, which is functional but less polished.
*   **Manual keyword fallbacks**: When using `calc-size()`, always provide a standard keyword fallback for older browsers, as they will discard the entire `calc-size()` declaration.

```css
.card {
  block-size: auto; /* Fallback for older browsers */
  block-size: calc-size(auto, size); /* Modern browsers use this */
  transition: block-size 0.3s ease;
}
```
