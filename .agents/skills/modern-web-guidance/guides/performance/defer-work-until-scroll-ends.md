# Defer Work Until Scroll Ends

Scrolling on the web should be smooth and responsive. Executing heavy tasks—such as layout recalculations, analytics data beacons tracking, or dynamic DOM updates—during scrolling can saturate the main thread, resulting in dropped frames and layout thrashing.

Historically, developers have relied on debouncing the `scroll` event using `setTimeout()` to guess when a scroll is finished. However, these debounced functions are notoriously unreliable. They may trigger while the user’s is still scrolling.

The `scrollend` event offers a highly reliable, performance-driven solution. The browser fires a `scrollend` event exactly when a scroll has rested, all transitions are finished, and a touch gesture has been released.

## How to Implement

To implement a defer-work pattern:

1. **Set Up a Scrollable Container**: Create a container with `overflow: auto` or `overflow: scroll`.
2. **Listen for `scroll` events**: Only use this listener for basic dynamic metrics or informative layout styling. Do not execute heavy work here.
3. **Listen for `scrollend` events**: Register a `scrollend` callback on the scroll container or the document itself.
4. **Execute Expensive work in the callback**: This is where it's safe to fetch dynamic content or trigger comprehensive DOM layouts.

## Example Code

```css
.scroll-container {
  height: 300px;
  overflow-y: auto;
}
```

```javascript
const scroller = document.querySelector('.scroll-container');

// 1. Informative feedback during scroll
scroller.addEventListener('scroll', () => {
  // Avoid dynamic heavier data updates here
  console.log('Scrolling dynamically... updates deferred');
});

// 2. Safe callback when scrolling rests
scroller.addEventListener('scrollend', () => {
  // Run layout recalculations or analytical beacons updates here
  const currentVisibleSection = findMostVisibleSection(scroller);
  fetchAdditionalData(currentVisibleSection);
});
```

## Strategic Implementation & Best Practices

- **DO** use `scrollend` instead of debounced `scroll` events when firing layout data beacons or fetching new content content layout dynamically. 
- **DO** consider pairing this with `scrollSnapChange` or `scrollSnapChanging` snap interactions if you're building carousels or testimonial galleries slides.
- **DO NOT** bundle layout-dependent dynamic updates inside dynamic visual scroll callbacks.
- **DO** consider that visual viewport zooming and scrolling triggers the `scrollend` event correctly.

## Fallback Strategy

Baseline status for scrollend: Newly available. It's been Baseline since 2025-12-12.
Supported by: Chrome 114 (May 2023), Edge 114 (Jun 2023), Firefox 109 (Jan 2023), and Safari 26.2 (Dec 2025).

For unsupported browsers, fall back to a debounced `scroll` event with `setTimeout` to dispatch a custom `scrollend` event.

```javascript
function initializeDemo() {
  const scroller = document.querySelector('#scroller');
  scroller.addEventListener('scrollend', () => {
    // Safe execution
  });
}

if ('onscrollend' in window) {
  initializeDemo();
} else {
  initializeDemo();
  const scroller = document.querySelector('#scroller');
  scroller.addEventListener('scroll', () => {
    clearTimeout(window.scrollendtimer);
    window.scrollendtimer = setTimeout(() => {
      scroller.dispatchEvent(new CustomEvent('scrollend'));
    }, 100);
  });
}
```
