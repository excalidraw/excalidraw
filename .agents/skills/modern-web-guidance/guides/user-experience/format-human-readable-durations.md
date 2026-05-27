# Formatting Human-Readable Durations with Temporal

Presenting elapsed time or durations to users in a readable format (e.g., "1 hour and 30 minutes") has historically required manual math or external libraries. The `Temporal` API's `Temporal.Duration` class simplifies this by providing structured duration objects and powerful "balancing" capabilities via the `round()` method.

## How to Implement

To format a duration:

1.  (**MANDATORY**) **Create a Duration**: Use `Temporal.Duration.from()` to create a duration object from a set of units.
2.  (**OPTIONAL**) **Apply Balancing**: Use the `round()` method with the `largestUnit` option to control how units are balanced. For example, to convert 90 minutes into hours and minutes, or to keep it as total minutes.
3.  (**MANDATORY**) **Build the Display String**: Access the specific unit properties (like `.hours`, `.minutes`) to construct the human-readable string manually, or **(Recommended)** use `Intl.DurationFormat` for a localized, automatic approach.

### Example: Balancing and Localized Formatting

```javascript
// 1. Create a duration (e.g., from user input)
const duration = Temporal.Duration.from({ minutes: 90 });

// 2. Balance to hours (converts 90 minutes to 1 hour and 30 minutes)
const balanced = duration.round({ largestUnit: 'hours' });

// 3. Format using Intl.DurationFormat (Handles pluralization automatically)
const formatter = new Intl.DurationFormat('en', { style: 'long' });
console.log(formatter.format(balanced));
// Note: Output may vary by browser (e.g., "1 hour and 30 minutes" or "1 hour, 30 minutes")
```

### Best Practices

*   **DO** use `Temporal.Duration.round()` with `largestUnit` to control the display strategy (detailed breakdown vs total count).
*   **DO** use `Intl.DurationFormat` for localized string formatting and automatic pluralization, or fall back to manual construction if not supported. 
*   **DO NOT** rely on `Temporal.Duration.prototype.toString()` for user-facing text; it returns ISO 8601 strings (e.g., `PT1H30M`).
*   **DO** use feature detection and a polyfill for environments lacking native support.

## Fallback strategies

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

### Intl.DurationFormat

Baseline status for Intl.DurationFormat: Newly available. It's been Baseline since 2025-03-04.
Supported by: Chrome 129 (Sep 2024), Edge 129 (Sep 2024), Firefox 136 (Mar 2025), and Safari 16.4 (Mar 2023).

If `Intl.DurationFormat` is not supported, you should feature-detect it and fall back to manual string construction by extracting the balanced duration properties.

* **Guidance:** Use `typeof Intl.DurationFormat !== 'undefined'` to check for support. If unsupported, extract properties like `.hours` and `.minutes` from the balanced `Temporal.Duration` object and combine them, handling pluralization properly.

```javascript
// 3. Format the display string

if (typeof Intl.DurationFormat !== 'undefined') {
  // Use recommended Intl API if available
  const formatter = new Intl.DurationFormat('en', { style: 'long' });
  console.log(formatter.format(balanced));
} else {
  // Fallback manual formatting (assuming duration is already balanced)
  const h = balanced.hours;
  const m = balanced.minutes;

  const hoursStr = `${h} hour${h === 1 ? '' : 's'}`;
  const minutesStr = `${m} minute${m === 1 ? '' : 's'}`;

  console.log(`${hoursStr} and ${minutesStr}`);
}
```