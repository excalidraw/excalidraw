# Stabilize Reactive State with Temporal

While some reactive systems (like [React](https://react.dev/)) rely strictly on reference equality to detect state changes, others (like [Vue](https://vuejs.org/) and [Svelte](https://svelte.dev/)) can track mutations to plain objects. However, for built-in objects like the legacy `Date` object, internal mutations (like `setHours()`) do not change the object's reference and are generally not tracked by any framework's default reactivity system. This leads to missed UI updates and hard-to-debug side effects.

The `Temporal` API solves this by providing immutable objects. Any operation that modifies a value (such as adding time or setting a field) returns a new instance with a new memory reference. This guarantees that state updates are always detected by reactive systems, ensuring UI stability.

## How to Implement

To stabilize reactive state using Temporal:

1. **Use Temporal types for state:** Store `Temporal` objects (like `Temporal.PlainDateTime` or `Temporal.PlainDate`) in your reactive state instead of legacy `Date` objects.
2. **Perform immutable updates:** When updating the state, use Temporal methods like `.add()`, `.subtract()`, or `.with()`. These methods return a new object.
3. **Pass the new reference to the state setter:** Use the newly created Temporal object to update your component state, triggering a reliable re-render.

## Example Code: Temporal vs Legacy Date in State

```javascript
// ❌ BAD: Mutating legacy Date breaks reactivity
let dateState = { deadline: new Date() };

function extendDeadlineBad() {
  // Mutates the object in place. Reference remains the same!
  dateState.deadline.setHours(dateState.deadline.getHours() + 1);

  // Frameworks will skip re-rendering because
  // prevState === nextState (same memory reference)
  updateState(dateState);
}

// ✅ GOOD: Temporal ensures immutability and reliable reactivity
let temporalState = { deadline: Temporal.Now.plainDateTimeISO() };

function extendDeadlineGood() {
  // Returns a new object with a new reference.
  const newDeadline = temporalState.deadline.add({ hours: 1 });

  // Create a new state object with the new Temporal reference
  temporalState = { deadline: newDeadline };

  // Frameworks will detect the reference change and re-render the UI
  updateState(temporalState);
}
```

## Strategic Implementation & Best Practices

- **DO** use `Temporal` for any date/time values stored in reactive state to benefit from its immutability.
- **DO** use the most specific Temporal type for your use case (e.g., `Temporal.PlainDate` if you only need the calendar date) to avoid unnecessary complexity.
- **DO NOT** mutate `Date` objects in place when they are part of a component's state.
- **DO** ensure you handle environments without native support by conditionally loading a polyfill.

### Fallback strategies

Temporal has limited availability.
Supported by: Chrome 144 (Jan 2026), Edge 144 (Jan 2026), and Firefox 139 (May 2025).
Unsupported in: Safari.

Since the `Temporal` API is a newer feature and may not be supported in all browsers, you should feature-detect it and conditionally load a polyfill if needed.

```html
<!-- Conditionally load the Temporal polyfill only if not natively supported -->
<script>
  if (typeof Temporal === "undefined") {
    try {
      const module = await import("https://esm.sh/@js-temporal/polyfill");
      globalThis.Temporal = module.Temporal;
    } catch (e) {
      console.error("Failed to load Temporal polyfill:", e);
    }
  }
</script>
```