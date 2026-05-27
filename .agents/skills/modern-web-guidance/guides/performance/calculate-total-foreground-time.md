# Calculate total foreground time

This guide details how to accurately calculate the total time a user spends actively viewing a page. Traditional metrics like time-on-page often incorrectly include time spent with the page in the background. By using the `VisibilityStateEntry` API, you can measure only the "foreground time," providing a better metric of user engagement.

## Implementing foreground time calculation

The `PerformanceTimeline` API exposes visibility state changes as performance entries. Rather than reacting to `visibilitychange` events and manually accumulating time throughout a session, you can query the entire visibility history at any time.

MANDATORY: You must query the `visibility-state` performance entries to calculate the true foreground time.

```javascript
/**
 * Calculates total time the page was in the visible state.
 *
 * @returns {number} Total foreground time in milliseconds.
 */
function getTotalForegroundTime() {
  // MANDATORY: Query the visibility-state entries from the performance timeline.
  const entries = performance.getEntriesByType('visibility-state');

  // Fallback: If the browser does not support VisibilityStateEntry,
  // the API will gracefully return an empty array.
  if (entries.length === 0) {
    // Return total time since navigation start as a fallback.
    return performance.now();
  }

  let totalForegroundTime = 0;

  for (let i = 0; i < entries.length; i++) {
    // Only calculate duration for periods where the state was 'visible'
    if (entries[i].name === 'visible') {
      const start = entries[i].startTime;

      // The end time is the start time of the next state change,
      // or the current time if this is the final entry.
      const end = i + 1 < entries.length
          ? entries[i + 1].startTime
          : performance.now();

      totalForegroundTime += (end - start);
    }
  }

  return totalForegroundTime;
}
```

## Fallbacks & browser support

Page visibility state has limited availability.
Supported by: Chrome 115 (Jul 2023) and Edge 115 (Jul 2023).
Unsupported in: Firefox and Safari.

The `VisibilityStateEntry` API is a modern addition to the Performance Timeline and may not be supported in all browsers.

Because `performance.getEntriesByType('visibility-state')` returns an empty array in unsupported browsers, feature detection is built into the calculation flow. You should always check if entries are returned before proceeding.

If the API is unsupported, the recommended fallback is to return `performance.now()`. This represents the total time since navigation, which serves as a reasonable upper bound for engagement time when visibility state history is unavailable.

```javascript
const entries = performance.getEntriesByType('visibility-state');

// If the array is empty, the API is likely unsupported.
if (entries.length === 0) {
  // Fallback: Return total time since page load.
  return performance.now();
}
```
