Historically, applying different layouts to a component based on its content required either JavaScript or conditional logic in your HTML templating language to inject modifier classes (like `.card--has-image` or `.card--text-only`).

The `:has()` pseudo-class eliminates this need by acting as a parent selector. It allows you to conditionally style a container element based on the presence or absence of specific descendant elements.

Using `:has()`, you can easily define distinct layout variations entirely in CSS based on a component's actual DOM content. You can also optionally combine it with `:not()` to explicitly target the *absence* of content to define default layouts.

### Implementing content-based container styling

**MANDATORY**: You must use the `:has()` selector on the container element to detect the presence of specific child content.

To build a component that changes its layout based on its content:

1. **Define the default styling**: Apply the base layout styles to the container element (e.g., a simple single-column stack).
2. **Apply content-based overrides**: Target the container with `:has([child-selector])` and apply the new layout styles for when that content is present (e.g., a multi-column grid).

*Example: A card component that switches to a side-by-side layout if an image is present.*

```css
/* 1. Define the default state on the component container */
/* This applies when there is NO image */
.article-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  border: 1px solid #ccc;
  border-radius: 8px;
}

/* 2. Apply styles when a specific child element is present */
/* MANDATORY: Target the container and use :has() to check for the descendant */
.article-card:has(img) {
  /* Change the layout to a row if an image exists */
  flex-direction: row;
  align-items: center;
}

/* Optional: Style the image itself (no :has() needed here) */
.article-card img {
  width: 150px;
  height: auto;
  border-radius: 4px;
}

/* You can also combine :has() and :not() to explicitly target the ABSENCE of content */
/* This selects a card that DOES NOT have an image */
.article-card:not(:has(img)) {
  /* E.g., apply a different background color for text-only cards */
  background-color: #f9f9f9;
}
```

```html
<!-- Assume an <h1> precedes these components in the document layout -->
<!-- A card WITH an image (will use row layout) -->
<article class="article-card">
  <img src="thumbnail.jpg" alt="Article thumbnail" />
  <div class="content">
    <h2>Card With Image</h2>
    <p>This card lays out its content horizontally.</p>
  </div>
</article>

<!-- A card WITHOUT an image (will use default column layout) -->
<article class="article-card">
  <div class="content">
    <h2>Text-Only Card</h2>
    <p>This card lays out its content vertically, and gets its background color from the :not(:has()) rule.</p>
  </div>
</article>
```

**Performance tip**: When using `:has()`, scope the selector to the most specific component container possible (like `.article-card`). Avoid anchoring it to very high-level elements like `body:has(img)` if the styling changes are highly localized, as broad `:has()` queries can trigger more layout recalculations.

### Fallback strategies

Baseline status for :has(): Newly available. It's been Baseline since 2023-12-19.
Supported by: Chrome 105 (Sep 2022), Edge 105 (Sep 2022), Firefox 121 (Dec 2023), and Safari 15.4 (Mar 2022).

If the content-based layout styling is critical to the user experience or page design, you must provide a fallback for browsers that do not support the `:has()` selector. For purely decorative effects, `:has()` can be used as a progressive enhancement without a fallback.

**MANDATORY**: When implementing a fallback for critical layouts, you must use `@supports not selector(:has(*))` in your CSS to define a traditional class-based fallback (e.g., `.has-image`).

Unlike interactive state-based styling, content presence is typically known at render time. The most robust fallback is to have your server-side templating engine (or static site generator) inject a class like `.has-image` onto the container if the child element (like an image) exists in the data.

If server-side rendering is not an option, you must use a small script with `CSS.supports()` to detect the content and append the class on load or after dynamic content injection.

```css
/* Fallback CSS for older browsers */
/* We check if the browser DOES NOT support the :has() selector */
@supports not selector(:has(*)) {
  /* Define a traditional modifier class that applies the exact same layout overrides */
  .article-card.has-image {
    flex-direction: row;
    align-items: center;
  }
  
  .article-card:not(.has-image) {
    background-color: #f9f9f9;
  }
}
```

```javascript
/* Fallback JavaScript for older browsers (if not using SSR to add the class) */
/* Check for support before running the script to avoid unnecessary work in modern browsers */
if (!CSS.supports('selector(:has(*))')) {
  // Find all components that need checking
  const cards = document.querySelectorAll('.article-card');
  
  cards.forEach(card => {
    // If the critical content exists, manually add the fallback class
    if (card.querySelector('img')) {
      card.classList.add('has-image');
    }
  });
}
```
