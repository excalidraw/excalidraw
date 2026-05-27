## Background & Overview

Often an author will need to make contextual changes to the design of a component. Historically authors would need to use selectors to apply such changes. This often meant that while many of their design tokens could exist as custom properties, higher-order design tokens could only be encoded as a selector pattern (i.e. using a class name or attribute convention) or as props/context in a JavaScript framework.

**Container style queries** allow authors to style elements based on the computed custom property value of an ancestor element. This means authors can write meaningful design token values within their stylesheets rather than relying on markup or JavaScript for presentation.

## How to implement

Implementing a reactive design token using a container style query is quite straightforward:

1. Set the higher-order design token as a custom property on a container. This does not need to be a registered custom property.
2. Use the `@container style()` rule to query the value of that custom property.
3. Apply the appropriate styles to a descendant element within the container.

A few things to keep in mind:

- The container being queried with a style query does not need to have a `container-type` or `container-name` set, however, a `container-name` can allow for more specific querying.
- The container itself cannot be styled by the container style query.

The following is a basic example of the above implementation steps.

```html
<div class="features">
  <div class="card"></div>
  <div class="card"></div>
</div>
<div class="bugs">
  <div class="card"></div>
  <div class="card"></div>
  <div class="card"></div>
  <div class="card"></div>
</div>
```

```css
.features {
  --density: spacious;
}

.bugs {
  --density: compact;
}

@container style(--density: compact) {
  .card {
    padding: 8px;
  }
}

@container style(--density: spacious) {
  .card {
    padding: 24px;
  }
}
```

## Fallback strategies

Container style queries has limited availability.
Supported by: Chrome 111 (Mar 2023), Edge 111 (Mar 2023), and Safari 18 (Sep 2024).
Unsupported in: Firefox.

Until there is Baseline support for container style queries it is NOT RECOMMENDED that they be used for core features that must be available across all browsers, since it is not simple to create a fallback for them that does not take away from their benefits or that have their own limitations. For example, if a UI density user preference is not deemed to be a core feature that must be available across all experiences, then container style queries can be use to implement the feature without a fallback.

### Using selectors instead

For core features, an alternate approach using selectors should be used. This example uses a `data-density` attribute to encode the density design token in the markup rather than as a custom property:

```html
<div class="features" data-density="spacious">
  <div class="card"></div>
  <div class="card"></div>
</div>
<div class="bugs" data-density="compact">
  <div class="card"></div>
  <div class="card"></div>
  <div class="card"></div>
  <div class="card"></div>
</div>
```

```css
/* This example uses `:where()` to avoid increasing specificity */
:where([data-density="compact"]) .card {
  padding: var(--card-padding-compact);
}

:where([data-density="spacious"]) .card {
  padding: var(--card-padding-spacious);
}
```

A major limitation of this fallback approach is that it does not support nesting elements with the `data-density` attribute set, since the selector specificity is the same, order of appearance will be used to determine the styles (i.e. `[data-density="spacious"]` will always take precendence over `[data-density="compact"]`).

### Using style queries as a progressive enhancement

While it’s NOT RECOMMENDED, if you want to use style queries as a progressive enhancement for a core feature, then to avoid duplication you can create some custom properties, then include the style queries after. Make sure the fallback approach uses `:where()` when selecting the container elements to avoid increasing the specificity.

```css
.card {
  --card-padding-compact: 8px;
  --card-padding-spacious: 24px;
}

:where([data-density="compact"]) .card {
  padding: var(--card-padding-compact);
}

:where([data-density="spacious"]) .card {
  padding: var(--card-padding-spacious);
}

/* Use style queries as a progressive enhancement: same specificity, so order of appearance is used */

@container style(--density: compact) {
  .card {
    padding: var(--card-padding-compact);
  }
}

@container style(--density: spacious) {
  .card {
    padding: var(--card-padding-spacious);
  }
}
```

### Feature-checking with just CSS

If you need to feature check container style queries to conditionally display some UI that relies on it, you can use a style query to do so:

```css
:root {
  --style-queries-supported: check;
}

.density-toggle {
  display: none;
}

@container style(--style-queries-supported) {
  .density-toggle {
    display: revert;
  }
}
```

### Feature-checking with JavaScript

For feature-checking with JavaScript, it is slightly more complicated as the `CSSContainerRule` interface existed prior to the addition of container style queries, so it is unreliable for this purpose. Instead, you’ll need to check the computed value of a known property that is being set with a style query.

This example uses a custom property as it will have no visual effect:

```css
:root {
  --style-queries-supported: check;
}

@container style(--style-queries-supported: check) {
  body {
    --style-queries-supported: yes;
  }
}
```

Then check the computed value in JavaScript like this:

```js
if (getComputedStyle(document.body).getPropertyValue("--style-queries-supported") === "yes") {
  // Use container style queries
} else {
  // Use fallback strategy
}
```

