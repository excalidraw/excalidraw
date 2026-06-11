# Efficient Background Processing

Pause heavy background tasks when a component is not being rendered by the browser to conserve system resources and battery life.

## Overview

The `content-visibility: auto` property allows the browser to skip rendering calculations for elements that are far outside the viewport. When the browser decides to skip or resume rendering for an element, it fires the `contentvisibilityautostatechange` event on that element.

By listening to this event, you can pause expensive operations like `<canvas>` animations, WebGL rendering, or high-frequency WebSocket data polling when they are not needed, and resume them just-in-time when the browser prepares to display the content.

### `contentvisibilityautostatechange` vs. `IntersectionObserver`

It is important to understand when to use which API:

*   **Use `IntersectionObserver` for application logic** tied to the exact visual visibility of an element in the viewport (e.g., lazy-loading data, infinite scroll triggers).
*   **Use `contentvisibilityautostatechange` for rendering-heavy work** (like complex canvas updates or heavy DOM mutations). This event ties directly to the browser's internal rendering lifecycle. The browser often starts rendering an element before it actually appears on screen (the pre-render margin). This event tells you when that happens, ensuring your content is ready to be seen.

## Implementation

### 1. Apply CSS Content Visibility

Set `content-visibility: auto` on the heavy container and provide a placeholder size to prevent scrollbar jumping.

```css
.heavy-component {
  /* Defer rendering work when off-screen */
  content-visibility: auto;
  
  /* Mandatory: Provide a placeholder size to prevent layouts shifts.
    - 'auto' is optional and enables the browser to remember the actual size
      once rendered. It must be paired with a <length> value to be used for
      the first render.
    - 'none' tells the browser not to apply any intrinsic width to this element.
      It can be used for either the height or the width value.
    - '500px' is the estimated height of this element. This can be any valid
      CSS <length> value. Replace it with the expected height of your
      component.
   */
  contain-intrinsic-size: auto none auto 500px;
}
```

### 2. Listen for State Changes

Add an event listener for `contentvisibilityautostatechange` to pause or resume background tasks.

> **Important:** The `contentvisibilityautostatechange` event does not bubble in some browser implementations. To handle this event reliably, you must either:
> - Attach the event listener directly to the element that has `content-visibility: auto` applied.
> - Use a capturing event listener (`{ capture: true }`) if you are delegating events to a parent container.

```javascript
const component = document.querySelector('.heavy-component');

// Option 1: Direct listener (recommended)
component.addEventListener('contentvisibilityautostatechange', (event) => {
  if (event.skipped) {
    // The browser skipped rendering this content.
    // DO NOT perform heavy mutations or animation loops here.
    stopSimulation();
    pauseWebSocketPolling();
  } else {
    // The browser is about to render the content.
    // Resume your work so it is ready when visible.
    startSimulation();
    resumeWebSocketPolling();
  }
});

// Option 2: Capturing listener for event delegation
document.addEventListener('contentvisibilityautostatechange', (event) => {
  if (event.target.matches('.heavy-component')) {
    if (event.skipped) {
      stopSimulation();
    } else {
      startSimulation();
    }
  }
}, { capture: true });
```

### Fallback strategies

Baseline status for content-visibility: Newly available. It's been Baseline since 2025-09-15.
Supported by: Chrome 108 (Nov 2022), Edge 108 (Dec 2022), Firefox 130 (Sep 2024), and Safari 26 (Sep 2025).

The `content-visibility` property and the associated `contentvisibilityautostatechange` event are progressive enhancements. In browsers that do not support them:
*   The CSS property is ignored, and the content is rendered normally.
*   The event never fires, so background tasks will continue to run as they normally would without optimization.

If you must support pausing tasks on older browsers, you can fallback to using `IntersectionObserver` as a rough approximation. This helps save battery and CPU on older devices too.

```javascript
// Fallback using IntersectionObserver for older browsers
const target = document.getElementById('target-container');

// Check if content-visibility is supported
const isSupported = 'contentVisibility' in document.documentElement.style;

if (!isSupported) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // The element is close to the screen. Start work!
        startSimulation();
      } else {
        // The element is far away. Pause work!
        stopSimulation();
      }
    });
  }, {
    // Use rootMargin to start rendering before it hits the screen
    rootMargin: '200px'
  });

  observer.observe(target);
}
```
