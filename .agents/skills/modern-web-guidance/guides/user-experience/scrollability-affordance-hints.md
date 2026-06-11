## Overview

Visual hints, like shadows or gradients, help users understand that they can scroll to see more content. This guide shows how to build these hints using CSS `container-scroll-state-queries`, which allows styling elements based on the scrollable state of their container without relying on JavaScript scroll listeners or observers.

## Implementation

### 1. Establish the Scroll Container

The scroll container must be declared as a scroll-state query container.

```css
.scroller {
  overflow-y: auto;
  /* Establish this element as a scroll-state query container */
  container-type: scroll-state;
  position: relative;
}
```

### 2. Style the Indicators

Place the indicator elements (like shadows, gradients, or arrows) inside the container and style them. By default, they should not be visible. When they are shown, they should not be interactive, by setting `pointer-events: none`.

```css
.indicator-top, .indicator-bottom {
  position: sticky;
  left: 0;
  right: 0;
  height: 20px;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none; /* Let clicks pass through */
}

.indicator-top {
  top: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.2), transparent); /* Example: Shadow */
}

.indicator-bottom {
  bottom: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.2), transparent); /* Example: Shadow */
}
```

### 3. Query the Scroll State

Use the `@container` rule with the `scroll-state` function. Check if the container is scrollable up or down to show the respective indicator.

```css
/* Show top indicator when the user can scroll up */
@container scroll-state(scrollable: top) {
  .indicator-top {
    opacity: 1;
  }
}

/* Show bottom indicator when the user can scroll down */
@container scroll-state(scrollable: bottom) {
  .indicator-bottom {
    opacity: 1;
  }
}
```

## Fallback strategies

Container scroll-state queries has limited availability.
Supported by: Chrome 133 (Feb 2025) and Edge 133 (Feb 2025).
Unsupported in: Firefox and Safari.

### Basic Fallback
If the feature is not supported, the indicators will remain invisible. Since these are hints and not critical for functionality, it is acceptable to omit them in unsupported browsers.

### Advanced Fallback (Intersection Observer)
If the hints are required, use an `IntersectionObserver` to toggle classes when sentinel elements at the top and bottom of the scroller move in and out of the scrollport.

```html
<!-- Sentinel elements placed at the ends of the scroller -->
<div class="sentinel-top"></div>
<!-- Content goes here -->
<div class="sentinel-bottom"></div>
```

```css
/* Marker styling to ensure it does not affect layout */
.sentinel-top, .sentinel-bottom {
  height: 0;
  width: 0;
  visibility: hidden;
}

.scroller.scrolled-down .indicator-top {
  opacity: 1;
}

.scroller.can-scroll-down .indicator-bottom {
  opacity: 1;
}
```

```javascript
if (!CSS.supports('container-type', 'scroll-state')) {
  const topSentinel = document.querySelector('.sentinel-top');
  const bottomSentinel = document.querySelector('.sentinel-bottom');
  const scroller = document.querySelector('.scroller');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.target === topSentinel) {
        // If top sentinel is not intersecting, we have scrolled down
        scroller.classList.toggle('scrolled-down', !entry.isIntersecting);
      }
      if (entry.target === bottomSentinel) {
        // If bottom sentinel is intersecting, we reached the bottom
        scroller.classList.toggle('can-scroll-down', !entry.isIntersecting);
      }
    });
  }, { root: scroller });

  observer.observe(topSentinel);
  observer.observe(bottomSentinel);
}
```
