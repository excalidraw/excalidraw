# Calculating Event Differentials with Temporal

Calculating the time elapsed between events (such as trial expirations, subscription durations, or prorated costs) has historically been difficult with the legacy `Date` object due to complexities with time zones, daylight saving time (DST), and inconsistent parsing.

The `Temporal` API provides a modern, robust solution for date and time arithmetic. Specifically, `Temporal.ZonedDateTime` and `Temporal.Duration` enable exact, DST-safe calculations of time differences.

## How to Implement

To calculate differentials between two events:

1.  **Obtain ZonedDateTime objects**: Convert your inputs (dates and times) into `Temporal.ZonedDateTime` objects. This ensures calculations are time-zone aware.
2.  **Calculate active time with `.since()`**: Use `currentZonedDateTime.since(startZonedDateTime)` to find the time elapsed since a start event.
3.  **Calculate remaining time with `.until()`**: Use `currentZonedDateTime.until(endZonedDateTime)` to find the time remaining until a future event.
4.  **Control precision with options**: Use `largestUnit`, `smallestUnit`, and `roundingMode` to control how the resulting duration is balanced and rounded.

### Example: Trial Expiration Calculation

```javascript
// 1. Get current time point in the system time zone
const now = Temporal.Now.zonedDateTimeISO();
const tz = now.timeZoneId;

// 2. Parse inputs (assuming ISO strings from form inputs)
const startDateStr = "2025-01-01";
const startTimeStr = "12:00:00";
const endDateStr = "2025-01-31";
const endTimeStr = "12:00:00";

const startDate = Temporal.PlainDate.from(startDateStr);
const startTime = Temporal.PlainTime.from(startTimeStr);
const start = startDate.toPlainDateTime(startTime).toZonedDateTime(tz);

const endDate = Temporal.PlainDate.from(endDateStr);
const endTime = Temporal.PlainTime.from(endTimeStr);
const end = endDate.toPlainDateTime(endTime).toZonedDateTime(tz);

// 3. Calculate difference using .since() and .until()
// By default, units larger than hours might not wrap automatically.
// Use largestUnit to ensure differences are expressed in larger units if applicable.
const timeActive = now.since(start, { largestUnit: 'year' });
const timeRemaining = now.until(end, { largestUnit: 'year' });

console.log(`Active: ${timeActive.days} days, ${timeActive.hours} hours`);
console.log(`Remaining: ${timeRemaining.days} days, ${timeRemaining.hours} hours`);

// 4. Compare dates
const isExpired = Temporal.ZonedDateTime.compare(now, end) > 0;
if (isExpired) {
  console.log("Subscription is expired.");
}
```

## Strategic Implementation & Best Practices

-   **DO** use `Temporal.ZonedDateTime` for calculations involving real-world events that occur in specific time zones (like subscription renewals or event scheduling).
-   **DO** use `largestUnit` to specify the largest unit you want in the result (e.g., `'year'` or `'month'`). If you omit it, it defaults to `'auto'` which might not always sum up to years/months as expected for human-readable durations.
-   **DO** use `.since()` when calculating time elapsed *since* a past event (e.g., `now.since(start)`), and `.until()` for time remaining *until* a future event (e.g., `now.until(end)`).
-   **DO NOT** modify instances directly; `Temporal` objects are **immutable**. Operations like `add()`, `subtract()`, or `with()` return a *new* instance.
-   **DO** use `Temporal.ZonedDateTime.compare` to check if one time point is after another. It returns `1` if the first is after the second, `-1` if before, and `0` if equal.

## Fallback Strategy

### Fallbacks & browser support for Temporal

Temporal has limited availability.
Supported by: Chrome 144 (Jan 2026), Edge 144 (Jan 2026), and Firefox 139 (May 2025).
Unsupported in: Safari.

For browsers that do not yet support the native `Temporal` API, use feature detection and a polyfill. The standard reference polyfill is `@js-temporal/polyfill`.

Note that the polyfill does not automatically assign the `Temporal` object to the global scope to avoid conflicts. You must manually assign it if your code relies on the global `Temporal` object.

```javascript
// Check if Temporal is supported natively
(async () => {
  if (typeof Temporal === 'undefined') {
    // Load the polyfill conditionally
    const module = await import("https://esm.sh/@js-temporal/polyfill");
    globalThis.Temporal = module.Temporal;
    // Extend Date.prototype if needed
    Date.prototype.toTemporalInstant = module.toTemporalInstant;
    initializeApp();
  }
})();
```