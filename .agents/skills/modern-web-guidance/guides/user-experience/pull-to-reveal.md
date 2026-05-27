# Pull to Reveal

"Pull to reveal" is a UI pattern where content (such as a search bar or refresh control) is hidden above the top of a scrollable area on initial load, and the user can pull down (scroll up) to reveal it. This pattern is commonly used in mobile apps and web apps for search bars, filters, and other secondary controls that should be accessible but not immediately visible.

The CSS property `scroll-initial-target` offers a declarative, CSS-only way to implement this pattern. By setting `scroll-initial-target: nearest` on the main content element, the scroll container will render with the hidden content scrolled out of view. Previously, developers relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#content-id`) to achieve this, both of which have limitations and are tricky to implement.

## How to Implement

To implement a pull-to-reveal pattern:

1. **Ensure a scroll container:** The target element must be inside a scroll container (an element with overflow that allows scrolling, such as `overflow: auto`). This can be any ancestor element, including the root `<html>` element.
2. **Define the hidden element:** Place the content you want to hide (e.g., a search bar) as the first descendant inside the scroll container. This element will be scrolled out of view on initial load.
3. **Define the main content:** Place the main content element immediately after the hidden element. This is the element the user should see first.
4. **Target the main content:** Apply `scroll-initial-target: nearest` to the main content element so the scroll container renders with it scrolled into view, hiding the element above it.
5. **Add scroll snapping:** To ensure the hidden element is always either fully visible or fully hidden (and doesn't rest in a partially-scrolled state), add `scroll-snap-type: y mandatory` to the scroll container and `scroll-snap-align: start` to both the hidden element and the main content element.

## Example Code: Pull to Reveal Search

```css
/**
 * ANCESTOR: Define the scroll container.
 * Scroll snapping ensures the search bar is always
 * either fully visible or fully hidden.
 */
.scroll-container {
  height: 100vh;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
}

/**
 * HIDDEN ELEMENT: The search bar hidden above the fold on load.
 * It has scroll-snap-align so it snaps into place when pulled down.
 */
.search-bar {
  height: 60px;
  scroll-snap-align: start;
}

/**
 * MAIN CONTENT + TARGET: The element the user sees first.
 * scroll-snap-align makes it a valid snap point.
 * scroll-initial-target tells the browser to scroll here on
 * initial render, hiding the search bar above it.
 */
.main-content {
  scroll-snap-align: start;
  scroll-initial-target: nearest;
}
```

## Strategic Implementation & Best Practices

- **DO** use `scroll-initial-target: nearest` when you want to draw the user's attention to a specific part of a scrollable area upon load and intentionally hide peripheral UI units like a search bar at the very top.
- **DO NOT** confuse this with accessibility focus. This property only moves the **visual** viewport; it does not move the keyboard focus. You must manually manage `element.focus()` if the target is intended to be the starting point for keyboard users.
- **DO NOT** use this if you need a smooth "scrolling" animation on load; this property is discrete and sets the position instantly during the layout phase.
- **DO NOT** set `scroll-initial-target` on multiple elements within the same scrollable container. If multiple elements specify `scroll-initial-target: nearest`, the browser selects the one that appears first in the DOM tree order.
- **DO** account for the **Precedence Hierarchy**: A URL fragment (e.g., `example.com/#top`) and the container-level `scroll-start` property both take precedence over `scroll-initial-target`.

## Fallback Strategy

scroll-initial-target has limited availability.
Supported by: Chrome 133 (Feb 2025) and Edge 133 (Feb 2025).
Unsupported in: Firefox and Safari.

For browsers that do not yet support the API, use a JavaScript fallback. Note that for pulling content to reveal, you want the main content to be bound to the `start` (top) of the container.

```javascript
/**
 * Progressive Enhancement Fallback
 */
document.addEventListener("DOMContentLoaded", () => {
  // Check for native CSS support
  if (!CSS.supports("scroll-initial-target", "nearest")) {
    const targetContent = document.querySelector('.main-content.target');
    if (targetContent) {
      // Use behavior: "instant" to mimic the native CSS behavior
      // 'block: start' should match your CSS 'scroll-snap-align' (or expected top position)
      targetContent.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
  }
});
```
