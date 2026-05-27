# Capturing Location-Agnostic Data with Temporal

Recording chronological data that should remain identical regardless of the viewer's location (such as birthdates, recurring alarms, or national holidays) has historically been error-prone with the legacy `Date` object. Because `Date` objects always represent a specific instant in time and are tied to a time zone, saving a date like "1990-01-01" can result in users in different time zones seeing "1989-12-31" due to offset shifts.

The `Temporal` API introduces "Plain" types—such as `Temporal.PlainDate` and `Temporal.PlainTime`—which have no concept of a time zone. These types represent calendar dates and wall-clock times exactly as you would read them off a calendar or a clock, making them ideal for location-agnostic data.

## How to Implement

To capture and display location-agnostic data:

1.  **Use `Temporal.PlainDate` for dates**: For data like birthdates or holidays, use `Temporal.PlainDate.from()` to create an instance from an ISO 8601 string or an object.
2.  **Use `Temporal.PlainTime` for times**: For data like a daily alarm or a preferred lunch time, use `Temporal.PlainTime.from()`.
3.  **Display without conversion**: Since these objects are time-zone unaware, they will display the same values regardless of the user's local time zone.

### Example: Capturing a Birthdate

```javascript
// 1. Parse a date string from an input (e.g., "1990-01-01")
const birthdateStr = "1990-01-01";
const plainDate = Temporal.PlainDate.from(birthdateStr);

// 2. Display the date
// This will output "01/01/1990" (or equivalent) in any time zone
console.log(plainDate.toLocaleString('en-GB')); 

// 3. Compare with standard Date (which might drift)
const dateObj = new Date("1990-01-01T00:00:00Z");
// In a UTC-5 time zone, this might print "31/12/1989"
console.log(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York' }).format(dateObj));
```

## Strategic Implementation & Best Practices

-   **DO** use `Temporal.PlainDate` for "calendar dates" like birthdates, anniversaries, and holidays where the specific time of day or time zone is irrelevant.
-   **DO** use `Temporal.PlainTime` for "wall-clock times" like a daily reminder at 9:00 AM, where the time should be 9:00 AM in whatever time zone the user happens to be in.
-   **DO NOT** use Plain types if you need to represent a specific moment in physical time (an "instant"). Use `Temporal.Instant` or `Temporal.ZonedDateTime` for logs, event timestamps, or anything requiring time zone awareness.
-   **DO** remember that `Temporal` objects are **immutable**. Methods like `add()` or `with()` return a new instance rather than modifying the original.

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