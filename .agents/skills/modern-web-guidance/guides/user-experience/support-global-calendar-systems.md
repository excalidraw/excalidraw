# Supporting Global Calendar Systems with Temporal

The traditional JavaScript `Date` object is based on a proleptic Gregorian calendar, making it challenging to build applications for users who rely on other calendar systems, such as the Islamic (lunar), Hebrew (lunisolar), or Chinese (lunisolar) calendars. Developers previously had to rely on complex third-party libraries or manual calculations to support these systems.

The `Temporal` API provides first-class support for multiple calendar systems. By associating a calendar identifier with date objects, Temporal handles the complex arithmetic and formatting required for different cultural contexts natively.

## How to Implement

To support global calendar systems using Temporal:

1. **Associate a Calendar (Mandatory):** When creating or converting a Temporal object (like `Temporal.PlainDate`), you must specify the desired calendar system using `withCalendar()` to perform calendar-sensitive operations.
2. **Use Stable Identifiers (Mandatory for Lunisolar Calendars):** You must use `monthCode` rather than the numeric `month` index to identify specific months across years in lunisolar calendars. Only use this for calendars that use leap months, such as the Hebrew and Chinese calendars.
3. **Respect Calendar Invariants (Mandatory):** When iterating through months or days, you must not assume fixed values (like 12 months in a year or 31 days in a month). Use properties like `monthsInYear` and `daysInMonth` to ensure your code works across all calendars.
4. **Use Calendar-Aware Comparisons (Mandatory):** When comparing dates within a specific calendar system, you must use `Temporal.PlainDate.compare()` instead of comparing year/month/day properties manually. This correctly handles chronological ordering within the calendar rules.

## Example Code: Converting and Iterating Calendars

```javascript
// 1. Helper to check calendar support
function isCalendarSupported(calendarId) {
  try {
    return Intl.supportedValuesOf('calendar').includes(calendarId);
  } catch {
    // Fallback for environments where supportedValuesOf is not available
    return false;
  }
}

// 2. Get current date in default ISO 8601 calendar
const isoDate = Temporal.Now.plainDateISO();

// 3. Convert to Hebrew calendar if supported
const calendarId = 'hebrew';
const targetDate = isCalendarSupported(calendarId) 
  ? isoDate.withCalendar(calendarId)
  : isoDate; // Fallback to ISO if not supported

if (targetDate.calendar.id !== calendarId) {
  console.warn(`Calendar ${calendarId} not supported; falling back to ISO 8601`);
}

// 4. Log properties specific to the calendar
console.log(`Calendar: ${targetDate.calendar.id}`);
console.log(`Year: ${targetDate.year}`);
console.log(`Month Code: ${targetDate.monthCode}`); // Stable across leap years

// 5. Safely iterate through months in the current year
for (let m = 1; m <= targetDate.monthsInYear; m++) {
  console.log(`Month ${m} has ${targetDate.with({ month: m }).daysInMonth} days.`);
}

// 6. Compare dates within the same calendar
const today = Temporal.Now.plainDateISO().withCalendar(calendarId);
const comparison = Temporal.PlainDate.compare(targetDate, today);
const relative = comparison < 0 ? 'Past' : comparison > 0 ? 'Future' : 'Today';
console.log(`Timeline: ${relative}`);

// 7. Format for display using toLocaleString
const localizedDisplay = targetDate.toLocaleString('en-u-ca-hebrew', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});
```

## Strategic Implementation & Best Practices

- **DO** use `monthsInYear` as the upper bound when looping through months, rather than assuming 12.
- **DO** use `monthCode` for identifying specific months in calendars that use leap months (e.g., Hebrew or Chinese), regardless of the year.
- **DO NOT** assume `date.month === 12` is the last month of the year. Use `date.month === date.monthsInYear`.
- **DO NOT** assume `inLeapYear === true` implies the year is only one day longer. In lunisolar calendars, it may add a full leap month.
- **DO** use `Temporal.PlainDate.compare()` when comparing two dates in a specific calendar system instead of comparing Year/Month/Day properties manually.
- **DO** use `toLocaleString()` to format dates for users instead of manual string concatenation.
- **DO** verify that the target calendar system is supported by the environment using `Intl.supportedValuesOf('calendar')` before creating calendar-specific Temporal objects.
- **DO** be aware that some calendars (like variants of the Islamic calendar) may rely on visual observation rather than fixed calculations. The `Temporal` API follows the environment's `Intl` implementation, which usually uses calculated approximations. For critical cultural or religious date calculations, verify with domain experts or use specialized libraries.
- **DO** account for era names when using calendars that use eras (e.g., Japanese, Buddhist), using `toLocaleString()`.

## Fallback Strategy

Temporal has limited availability.
Supported by: Chrome 144 (Jan 2026), Edge 144 (Jan 2026), and Firefox 139 (May 2025).
Unsupported in: Safari.

For production use in browsers that do not support it natively, you must use a polyfill.

The recommended approach is to progressively enhance by checking for native support and dynamically loading a polyfill like `@js-temporal/polyfill` if needed.

```javascript
/**
 * Progressive Enhancement Fallback
 */
async function getTemporal() {
  if (typeof Temporal !== 'undefined') {
    return Temporal;
  }
  
  try {
    // Load polyfill dynamically from CDN
    const module = await import('https://esm.sh/@js-temporal/polyfill');
    globalThis.Temporal = module.Temporal;
    return module.Temporal;
  } catch (e) {
    console.error('Failed to load Temporal polyfill:', e);
    throw e;
  }
}
```
