# Sequencing Distributed Events

High-frequency tracing and event logging in distributed systems require precise timestamps to ensure correct causal ordering. Standard JavaScript `Date.now()` provides millisecond resolution, which can lead to timestamp collisions when multiple events occur within the same millisecond. 

The `Temporal` API, specifically `Temporal.Instant`, provides nanosecond-resolution timestamps, enabling precise sequencing of events without collisions.

## How to Implement

To sequence high-frequency events using `Temporal`:

1. **Capture exact timestamps**: Use `Temporal.Now.instant()` to get the current exact time with nanosecond precision.
2. **Sort events chronologically**: Use `Temporal.Instant.compare(a, b)` to sort event objects. This method resolves ordering differences up to the nanosecond level.
3. **Calculate delays**: Use `Temporal.Instant.prototype.since(other)` to find the precise duration between events.
4. **Serialize for transmission**: Use `Temporal.Instant.prototype.toString()` to convert the timestamp to a standard ISO-8601 string for logging or network transmission.

## Example Code: High-Frequency Event Sequencing

```javascript
// 1. Capture timestamps for incoming events
function recordEvent(eventType, nodeId) {
  return {
    nodeId,
    eventType,
    timestamp: Temporal.Now.instant() // Nanosecond resolution
  };
}

// 2. Sort events chronologically
function sequenceEvents(events) {
  // Always use Temporal.Instant.compare for sorting instants
  return [...events].sort((a, b) => Temporal.Instant.compare(a.timestamp, b.timestamp));
}

// 3. Calculate delays between events
function analyzeTelemetry(sortedEvents) {
  for (let i = 1; i < sortedEvents.length; i++) {
    const prev = sortedEvents[i - 1];
    const curr = sortedEvents[i];
    
    // Calculate difference in nanoseconds
    const duration = curr.timestamp.since(prev.timestamp);
    const nsDiff = duration.total('nanoseconds');
    
    console.log(`Delay between Event ${prev.eventType} and Event ${curr.eventType}: ${nsDiff}ns`);
  }
}
```

## Strategic Implementation & Best Practices

- **DO** use `Temporal.Now.instant()` for server-side tracing or client-side telemetry where millisecond precision is insufficient (e.g., microsecond profiling).
- **DO NOT** use `Date.now()` if you require stable sorting of events that happen back-to-back.
- **DO NOT** use `Temporal.Instant` for wall-clock time display unless you pair it with a time zone (use `Temporal.ZonedDateTime` for localized display).
- **DO** verify that the environment supports `Temporal` before using it natively or providing a fallback.

## Fallback strategies

Temporal has limited availability.
Supported by: Chrome 144 (Jan 2026), Edge 144 (Jan 2026), and Firefox 139 (May 2025).
Unsupported in: Safari.

For environments without native support, use a standards-compliant polyfill such as `@js-temporal/polyfill`. Load it conditionally to avoid bloating the payload for modern clients. Note that `@js-temporal/polyfill` does not automatically install a global `Temporal` object, so you must explicitly assign it if you need it globally.

```javascript
(async () => {
  // Check for native support
  if (typeof Temporal === 'undefined') {
    // Dynamically load polyfill using an ESM-compatible CDN
    const module = await import('https://esm.sh/@js-temporal/polyfill');
    // The polyfill does not auto-install globally, so we must assign it
    globalThis.Temporal = module.Temporal;
  }
  
  // Proceed with application logic
})();
```
