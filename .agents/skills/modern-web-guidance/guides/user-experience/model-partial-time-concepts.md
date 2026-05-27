# Modeling Partial Time Concepts with Temporal

Modeling date concepts that lack a full calendar date—such as credit card expirations, annual renewals, or daily alarms—has historically been error-prone with the legacy `Date` object. Developers often resort to using arbitrary days (like the 1st of the month) or parsing strings, leading to "day leakage" or incorrect calculations due to leap years and varying month lengths.

The `Temporal` API provides dedicated types for these partial concepts: `Temporal.PlainYearMonth`, `Temporal.PlainMonthDay`, and `Temporal.PlainTime`. These types ensure precision and avoid leaking irrelevant date components.

## Implementation Examples

### Monthly Expirations (Credit Cards, Billing Cycles)
Use `Temporal.PlainYearMonth` to represent a year and a month.

```javascript
// Create a PlainYearMonth from values
// Use explicit calendar to avoid mismatch issues in polyfill environments
const expiry = Temporal.PlainYearMonth.from({ year: 2027, month: 12, calendar: 'iso8601' });

// Get the current year/month
const currentMonth = Temporal.Now.plainDateISO().toPlainYearMonth();

// Calculate duration until expiry
// largestUnit ensures the difference is expressed in years if applicable
const duration = currentMonth.until(expiry, { largestUnit: 'years' });

if (duration.sign < 0) {
  console.log("Expired");
} else if (duration.sign === 0) {
  console.log("Expires this month");
} else {
  console.log(`Expires in ${duration.years} years and ${duration.months} months`);
}
```

### Annual Recurring Dates (Birthdays, Renewals)
Use `Temporal.PlainMonthDay` to represent a month and a day without a year.

```javascript
// Create a PlainMonthDay for an annual event
// Include explicit calendar for polyfill safety
const birthday = Temporal.PlainMonthDay.from({ month: 10, day: 31, calendar: 'iso8601' });

// Check if it matches today's date components
const today = Temporal.Now.plainDateISO();
const isBirthdayToday = birthday.equals(today.toPlainMonthDay());

// To perform arithmetic (like days until next occurrence), convert to a full PlainDate
// by providing a specific year.
const birthdayThisYear = birthday.toPlainDate({ year: today.year });
```

### Wall-Clock Time (Alarms, Store Hours)
Use `Temporal.PlainTime` to represent a time of day without a date.

```javascript
// Create a PlainTime from a string
const alarmTime = Temporal.PlainTime.from("08:00:00");

// Add a duration to a PlainTime
const snoozedTime = alarmTime.add({ minutes: 10 });

console.log(`Original alarm: ${alarmTime.toString()}`);
console.log(`Snoozed alarm: ${snoozedTime.toString()}`);
```

## Strategic Implementation & Best Practices

- **DO** use `Temporal.PlainYearMonth` for values that only specify a month and year (like credit card expiry) to avoid leaking arbitrary day values.
- **DO** use `Temporal.PlainMonthDay` for annual events that ignore the year (like birthdays or anniversaries).
- **DO** use `Temporal.PlainTime` for daily schedules or alarms that are independent of the date.
- **DO NOT** try to perform arithmetic directly on `PlainMonthDay`. Convert it to a `PlainDate` first by providing a year, as the length of months varies by year.
- **DO** use explicit calendar properties (like `calendar: 'iso8601'`) when creating instances from objects to ensure safety across polyfill implementations.

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
