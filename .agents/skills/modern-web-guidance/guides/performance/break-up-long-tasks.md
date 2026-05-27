Heavy computations or long loops can block the main thread, causing the page to become unresponsive. To prevent this, you should yield control back to the browser periodically. The `scheduler.yield()` API allows you to pause a long task and let the browser handle user input or rendering before continuing.

### Breaking up long tasks

Use `scheduler.yield()` inside async functions to break up work.

```javascript
async function processLargeArray(items) {
  // DO: Set a time-based deadline 50 milliseconds into the future. 50
  // milliseconds is the boundary for when a task becomes a long task.
  let deadline = performance.now() + 50; // 50ms budget

  for (const item of items) {
    // Process the item
    processItem(item);
    
    // MANDATORY: Yield to the main thread periodically to keep the UI
    // responsive. This can be done by checking if the deadline set earlier
    // has been exceeded. When it has been, yield, then reset the deadline
    // another 50 milliseconds into the future.
    if (performance.now() >= deadline) {
      await scheduler.yield();
      deadline = performance.now() + 50;
    }
  }
}
```

### Fallback strategies

Scheduler API has limited availability.
Supported by: Chrome 129 (Sep 2024), Edge 129 (Sep 2024), and Firefox 142 (Aug 2025).
Unsupported in: Safari.

Some browsers may not support the `scheduler` API. You MUST implement a fallback using `setTimeout` to ensure code executes without breaking.

#### Fallback for `scheduler.yield()`

```javascript
async function processLargeArrayWithFallback(items) {
  // DO: Set a time-based deadline 50 milliseconds into the future.
  let deadline = performance.now() + 50;

  for (const item of items) {
    processItem(item);
    
    // MANDATORY: Yield to the main thread periodically to keep the UI responsive.
    if (performance.now() >= deadline) {
      // DO: Feature detect scheduler.yield
      if ('scheduler' in window && 'yield' in window.scheduler) {
        await scheduler.yield();
      } else {
        // DO: Fallback to setTimeout for older browsers
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      deadline = performance.now() + 50;
    }
  }
}
```
