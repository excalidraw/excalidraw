Synchronizing UI state with a scrollable container's snap position traditionally required complex scroll event listeners, manual calculations of scroll offsets, and intersection observers. The `scrollsnapchange` event provides a native, efficient way to detect when a scroller has settled on a new snap target, making it useful for synchronizing sidebars or highlighting the active section in a table of contents.

## Implementation

### 1. Configure Scroll Snap in CSS
The container must have `scroll-snap-type` defined, and have children with `scroll-snap-align` for the browser to track snap targets. In a long article with a table of contents, you can use this to snap section headers to the top of the viewport.

```css
main {
    /* Enable scroll snapping on the container */  
  scroll-snap-type: y proximity;
  overflow-y: auto;
}

h2 {
  /* Define how headers align when snapped */
  scroll-snap-align: start;
}
```

### 2. Listen for Snap Changes
Use the `scrollsnapchange` event on the scroll container to react when the user finishes scrolling and the browser snaps to a new element. In our TOC demo, we use this to highlight the active link in the sidebar.

```html
<!-- MANDATORY: Wrap table of contents links inside a proper navigation landmark -->
<nav aria-label="Table of contents">
  <ul>
    <li><a href="#section-1" aria-current="location">Section 1</a></li>
    <li><a href="#section-2">Section 2</a></li>
  </ul>
</nav>
```

```javascript
const main = document.getElementById('main');
const links = document.querySelectorAll('nav a');

// The event fires when the scroller settles on a new snap target
main.addEventListener('scrollsnapchange', (event) => {
  // Use snapTargetBlock for vertical or snapTargetInline for horizontal
  const snappedHeader = event.snapTargetBlock;
  
  if (snappedHeader) {
    setSelectedParagraph(snappedHeader.id);
  }
});
```


## Accessibility

Caution: While Scroll Snap Events make it possible to visually synchronize other content to the state of the scroller, it does not automatically expose that information programmatically. Relationships between elements, active states, and live content must be reflected in the Accessibility Tree.

For a table of contents, ensure the sidebar links use `aria-current="true"` or `aria-current="location"` when they are active.

In addition, be careful when using the `mandatory` value for `scroll-snap-type`, as it can cause content in-between snap-points to become inaccessible when longer than the screen.


## Fallback strategies

Scroll snap events has limited availability.
Supported by: Chrome 129 (Sep 2024) and Edge 129 (Sep 2024).
Unsupported in: Firefox and Safari.

If `scrollsnapchange` is not supported, use `IntersectionObserver` to detect which element is currently at the top of the scroller. Note this is different behavior than `scrollsnapchange`, as this will trigger while the scroll happens, rather than only when the scroll has settled.

```javascript
// Feature detect support for scroll snap events
if (!('onscrollsnapchange' in HTMLElement.prototype)) {
  const observer = new IntersectionObserver(
    () => {
      // Each time the set of intersecting headers changes, find the top
      // header that is visible.
      const topEntry = [...headers].reduce((currentTop, header) => {
        // Use the bottom to handle scrolling up, when the top is still offscreen
        const {bottom} = header.getBoundingClientRect();
        // Don't match if the header's bottom is aboce the scrollport
        if (bottom < 0) return;
        if (!currentTop) return header;
        return bottom <
          currentTop.getBoundingClientRect().bottom
          ? header
          : currentTop;
      }, undefined);
      if (topEntry) setSelectedParagraph(topEntry.id);
    },
    { root: main, threshold: 0.9 // Adjust based on your use case },
  );

  // Observe all snap targets (e.g., section headers)
  document.querySelectorAll('h2').forEach(header => observer.observe(header));
}
```
