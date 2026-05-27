Scroll-state container queries allow you to style elements based on their current scroll state, such as whether an element is "stuck" (via sticky positioning) or "snapped" (via scroll snapping). This enables carousel or gallery experiences where the active item can be visually distinguished without relying on JavaScript intersection observers or scroll event listeners.

### Core implementation

To highlight snapped items, you must establish a scroll-snap container, define the snap targets as scroll-state containers, and then query that state to style descendants.

#### 1. Establish the scroll snap container
The parent container must have `scroll-snap-type` enabled.

```html
<div class="carousel">
  <div class="carousel-item">
    <div class="card">Product 1 content</div>
  </div>
  <div class="carousel-item">
    <div class="card">Product 2 content</div>
  </div>
</div>
```

```css
.carousel {
  display: flex;
  overflow-x: auto;
  /* MANDATORY: Enable scroll snapping on the container */
  scroll-snap-type: x mandatory;
}
```

#### 2. Define snap targets as scroll-state containers
Each item in the carousel that should be tracked for snapping must be declared as a `scroll-state` container.

```css
.carousel-item {
  /* Define where the item snaps within the container */
  scroll-snap-align: center;
  
  /* MANDATORY: Establish this element as a scroll-state query container */
  container-type: scroll-state;
}
```

#### 3. Query the `snapped` state

Because container queries style **descendants**, you must apply the highlight styles to an element *inside* the snap target.  Because the scroll container is set to overflow on the x axis, use the `scroll-state(snapped: x)` query.

**MANDATORY**: Wrap the styles in ` @media (prefers-reduced-motion: no-preference)` to only show the effect to users who have not requested reduced motion. Depending on your use case, you may retain portions of the effect, but in this case, the cards flash from white to blue in a way that may cause problems for some users, so we disable it completely.

```css
/* Specify transition outside of queries so that it is applied regardless of state.  */
.card {
  transition:
    scale 0.4s cubic-bezier(0.25, 0.8, 0.25, 1),
    background-color 0.4s,
    color 0.4s,
    box-shadow 0.4s;
}
/* 
Only show the effect for users not requesting reduced motion. Disable completely, including the color change, as it causes a flash that may be problematic.
*/
@media (prefers-reduced-motion: no-preference) {
  /* Style the content when its parent .carousel-item is snapped on the x axis */
  @container scroll-state(snapped: x) {
    .card {
      background: #007bff;
      color: white;
      scale: 1.15;
      box-shadow: 0 10px 25px rgba(0, 123, 255, 0.3);
    }
  }
}

/* MANDATORY Copy-Paste Safety: Disable highlight scaling/flashing for motion sensitive users */
@media (prefers-reduced-motion: reduce) {
  .card {
    transition: none !important;
    scale: 1 !important;
  }
}
```

The `snapped` descriptor can query specific axes: `x`, `y`, `inline`, `block`, or `both`.


### Accessibility

**AVOID**: using `scroll-state` with interactive elements.

Visual highlights for snapped items can improve the UX, but the snapped item is not exposed to the accessibility tree. The visual theme applied to a snapped item should not convey that the element is active or focused, and a keyboard focus ring should be highly visible and distinct from the `snapped` highlight. If the snapped item is interactive, you must use other standard accessibility practices to make it accessible.  

Snapping occurs due to scrolling, which does not move keyboard focus. However, keyboard focus may cause the scroll container to move, causing a change in the snapped item, which may or may not be the focused item. This will likely be a source of confusion for users and is discouraged.

> [!NOTE]
> Detailed accessibility requirements for carousels (such as ARIA roles, slide attributes, and complex keyboard patterns) have been intentionally omitted from this guide. Carousel accessibility is highly nuanced and context-dependent; refer to established accessibility standards and perform thorough user testing for production environments.


## Fallback strategies

Container scroll-state queries has limited availability.
Supported by: Chrome 133 (Feb 2025) and Edge 133 (Feb 2025).
Unsupported in: Firefox and Safari.

For browsers that do not support scroll-state queries, you should provide a functional base experience where all items are legible, even without the "active" highlight.

#### Feature detection
You can use `@supports` to provide enhancements only to supported browsers:

```css
@supports (container-type: scroll-state) {
  /* Enhancement styles here */
}
```

#### JavaScript fallback

If the highlight is critical for the user experience, use `IntersectionObserver` to determine the snapped item. Adjust the observed area to a thin slice in the center of the carousel by providing a `rootMargin` with a negative inline value. For example, to consider an element to be intersecting if it is in the center 2% of the carousel, set the `rootMargin` to `"0px -49%"`.  

```javascript
// Optional: detect support and apply a JS-based fallback
if (!CSS.supports('container-type', 'scroll-state')) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      // Toggle a class based on intersection
      entry.target.classList.toggle('is-snapped', entry.isIntersecting);
    });
  }, {
    root: document.querySelector(".carousel"),
    // Carousel item intersects if any part of the carousel item is in the middle 2% of the carousel.
    rootMargin: "0px -49%"
  });

  document.querySelectorAll('.carousel-item').forEach(item => {
    observer.observe(item);
  });
}
```
