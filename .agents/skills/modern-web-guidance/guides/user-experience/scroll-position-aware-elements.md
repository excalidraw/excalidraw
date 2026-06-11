## Overview

Improve the user experience of floating buttons, like a "Back to Top" link, by showing them only when they are useful. This guide shows how to build these elements using CSS `container-scroll-state-queries`, which allows styling elements based on the scroll position of their container without relying on JavaScript scroll listeners or observers.

## Implementation

### 1. Establish the Scroll Container

The scroll container must be declared as a scroll-state query container.

```css
.scroller {
  overflow-y: auto;
  /* Establish this element as a scroll-state query container */
  container-type: scroll-state;
}
```

### 2. Style the Floating Element

Place the element inside the container and style it. By default, it should be hidden.

```css
.back-to-top {
  position: sticky;
  bottom: 20px;
  visibility: hidden;
  opacity: 0;
  translate: 0 20px;
  transition:
    visibility 0.3s,
    opacity 0.3s ease,
    translate 0.3s ease;
}
```

> **Important:** Sticky or floating elements hover above the scrollable content. Ensure that the main content has sufficient bottom padding or margin so that the last few elements are not permanently covered by the button when the user scrolls completely to the bottom.

### 3. Respond to the Scroll State

Use the `@container` rule with the `scroll-state` function. To check if the user has scrolled down, check if the container is scrollable to the top.

```css
/* When the container can be scrolled toward the top, it means the user has scrolled down */
@container scroll-state(scrollable: top) {
  .back-to-top {
    visibility: visible;
    opacity: 1;
    translate: 0 0;
  }
}
```

## Fallback strategies

Container scroll-state queries has limited availability.
Supported by: Chrome 133 (Feb 2025) and Edge 133 (Feb 2025).
Unsupported in: Firefox and Safari.

### Basic Fallback
If `container-scroll-state-queries` is not supported, the floating element will remain invisible because of the default `visibility: hidden`. To ensure functionality, you can choose to make the element always visible in unsupported browsers.

```css
/* Fallback for browsers that do not support the feature */
.back-to-top {
  visibility: visible; /* Always visible */
  opacity: 1;
}

/* Override for supported browsers to handle dynamic visibility */
@supports (container-type: scroll-state) {
  .back-to-top {
    visibility: hidden;
    opacity: 0;
  }
  
  @container scroll-state(scrollable: top) {
    .back-to-top {
      visibility: visible;
      opacity: 1;
      translate: 0 0;
    }
  }
}
```

### Advanced Fallback (Intersection Observer)
If dynamic visibility is required, use an `IntersectionObserver` to toggle a class when a sentinel element at the top of the scroller goes out of view.

```html
<!-- Sentinel element placed at the top of the scroller -->
<div class="scroll-sentinel"></div>
```

```css
/* Marker styling to ensure it does not affect layout */
.scroll-sentinel {
  height: 0;
  width: 0;
  visibility: hidden;
}

.scrolled .back-to-top {
  visibility: visible;
  opacity: 1;
  translate: 0 0;
}
```

```javascript
if (!CSS.supports('container-type', 'scroll-state')) {
  const sentinel = document.querySelector('.scroll-sentinel');
  const scroller = document.querySelector('.scroller');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      // If the sentinel is NOT intersecting, it means the user has scrolled down
      if (!entry.isIntersecting) {
        scroller.classList.add('scrolled');
      } else {
        scroller.classList.remove('scrolled');
      }
    });
  }, { root: scroller });

  observer.observe(sentinel);
}
```
