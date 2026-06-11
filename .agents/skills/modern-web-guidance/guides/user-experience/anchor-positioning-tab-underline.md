In a tab menu, you should provide visual hints to users about what page they are on. One option is by underlining the tab. With anchor positioning, you can create a smooth animation between the positions of the underline. This does not work when changing the active tab loads a new web page.

You can also use this effect to add an animated dot to indicate the active tab in a vertical tab bar.

Create the underline using a `::before` pseudo-element on the `<ul>` that contains the `<li>` elements. **Using a pseudo-element is the preferred approach as it keeps the DOM clean and avoids adding extra elements for purely decorative effects.**

```css
ul::before {
  /* Use a pseudo-element on the container to represent the animated indicator */
  content: '';
}
```

Make the active list item an anchor by adding the `anchor-name` property, which has a value that starts with `--`.

```css
li.active {
  /* Make a unique anchor-name for the active element. */
  anchor-name: --active;
}
```

Tether the underline to the active item anchor with a `position-anchor` that matches the `anchor-name` on the anchor, and making it `position: absolute`.

```css
ul::before {
  /* Tether the underline to the active element. */
  position: absolute;
  position-anchor: --active;
}
```

Position the underline relative to the anchor using the inset properties and `anchor()` functions.

```css
ul::before {
  /* DO NOT use position-area, which can not be transitioned. */
  /* Use calc() to offset the top slightly */
  inset-block-start: calc(anchor(bottom) + .1lh);
  inset-inline-start: anchor(left);
  inset-inline-end: anchor(right);
}
```

Add a height and other visual styles.

```css
ul::before {
  /* Apply your project's styles for the indicator */
  block-size: .25lh;
  background: red;
}
```

Finally, add a transition on the `inset` properties.

```css
ul::before {
  @media (prefers-reduced-motion: no-preference) {
    /* MANDATORY: The transition must be wrapped in a prefers-reduced-motion media query to respect user preferences. */
    transition: inset .2s;
  }
}
```

This is only a visual indicator, and must not be a replacement for setting the appropriate `aria-current="page"` or `aria-selected` aria values.

```html
<!-- MANDATORY: Provide explicit assistive technology state alongside the visual tab underline -->
<nav aria-label="Primary">
  <ul>
    <li class="active">
      <a href="/home" aria-current="page">Home</a>
    </li>
    <li>
      <a href="/about">About</a>
    </li>
  </ul>
</nav>
```

## Fallback strategies

Anchor positioning is not natively supported by any major browser yet.

If anchor positioning is not supported in the browser, use a `border-bottom` to add an underline. It will not be animated.

```css
ul li.active {
  @supports not (position-anchor: auto) {
    /* Choose a color appropriate to the app theme. */
    border-bottom: .25lh var(--primary) solid;
  }
}
```