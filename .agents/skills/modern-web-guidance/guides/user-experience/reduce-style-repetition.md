# Reduce Style Repetition with CSS Functions

Maintaining large stylesheets often leads to repetitive logic, especially when dealing with design system tokens like gradients or responsive layout patterns.

The CSS `@function` at-rule allows you to encapsulate this logic into reusable, parameterized functions, making your CSS more maintainable, consistent and DRY (Don't Repeat Yourself).

## The `@function` Syntax

A custom function is defined using the `@function` rule followed by a dashed name and a list of parameters. The function returns a value using the `result` property. 

```css
@function --my-function(--input1 <length>, --input2: default-value) returns <length> {
  /* Logic goes here */
  result: var(--input1);
}
```

### Key Concepts
- **Parameters:** Must start with a double dash (`--`).
- **Defaults:** You can provide default values using a colon (`:`).
- **Result:** The `result` property determines the value the function returns. The last `result` declared in the function body wins.
- **Scoping:** Parameters and variables defined inside the function are locally scoped.
- **Types:** You can require parameters and the returned value to match a CSS type with bracket notation (e.g., `<color>`) and allow multiple types with the `type` function (e.g., `type(<number> | <percentage>)`).

## Practical Examples

### 1. Design System Tokens (Gradients)
Ensure consistent color gradients across your app by encapsulating gradient logic. The `--angle` provides a default value to provide consistency that can be overridden.

```css
@function --fancy-gradient(--start-color <color>, --end-color <color>, --angle: 98deg) returns <image>{
  result: linear-gradient(in oklab var(--angle), var(--start-color), var(--end-color) );
}

.card {
  background: --fancy-gradient(#ed73d7, #5d87e9);
}
```

### 2. Conditional Layout Logic
You can use `@media` or other queries directly inside a function to return different values based on the environment. When using conditional logic in a function, note that the `@function` does not "return" at the first value of `result`, but rather follows the CSS cascade, and resolves to the last value that matches based on the screen size, container size, or other query.

```css
@function --grid-template(--count <number>){
  /* MANDATORY: Put default value first. */
  result: 1fr; /* Default: stack */
  @media (min-width: 800px) {
    result: repeat(var(--count), 1fr); /* Grid on larger screens */
  }
}

main {
  display: grid;
  grid-template-columns: --grid-template(2);
}
```

## Best Practices
- **Use Dashed Names:** Always prefix your function names and parameters with `--`.
- **Provide Defaults:** Make your functions more robust by providing sensible default values.
- **Keep it Simple:** Use functions for logic that is actually repeated or complex. Don't over-engineer simple property-value pairs.
- **Use Types:** Ensure your parameters and return values are the expected types.
- **Consider Precompiled Alternatives:** For functions that do not depend on user input, media queries or other client-side variation, consider using a CSS precompiler to avoid doing unnecessary work on the client. 

### Fallback strategies

@function has limited availability.
Supported by: Chrome 139 (Aug 2025) and Edge 139 (Aug 2025).
Unsupported in: Firefox and Safari.

In browsers that do not support CSS Functions, values set using CSS functions will be invalid. To support other browsers, provide a fallback value for the property first. This will be overridden in browsers with CSS function support.

```css
.card {
  /* Provide fallback, in this case a solid color. */
  background: #5d87e9;
  background: --fancy-gradient(#ed73d7, #5d87e9);
}

main {
  /* Provide fallback, in this case a simple stacked default. */
  grid-template-columns: 1fr;
  grid-template-columns: --grid-template(2);
}
```

If it is a requirement to reduce style repetition while supporting other browsers, consider a CSS precompiler with functions, like Sass.
