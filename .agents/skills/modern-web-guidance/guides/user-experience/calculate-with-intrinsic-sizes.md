`calc-size()` is a CSS function for performing mathematical operations on intrinsic sizing keywords like `auto`, `min-content`, and `fit-content`. **MANDATORY**: Use `calc-size()` only when you need to modify an intrinsic size with a calculation or constraint; for simple keyword-based animations (e.g., `0` to `auto`), you must use `interpolate-size: allow-keywords`.

## Implementation Steps

1. **Identify the Intrinsic Basis**: Determine which intrinsic keyword (`auto`, `min-content`, etc.) should form the base of your calculation.
2. **Define Constraints**: Use CSS math functions like `clamp()`, `min()`, or `max()` within the second argument to enforce design constraints on the intrinsic size.
3. **MANDATORY: Provide a Fallback**: Always declare a standard sizing keyword or length immediately before the property using `calc-size()` to ensure the layout remains functional in unsupported browsers.
4. **Apply Logical Properties**: Default to using logical properties like `inline-size` or `block-size` to ensure the calculations respect the document's writing mode.
5. **Optional: Progressive Enhancement**: Wrap complex layout logic or animations in a `@supports (inline-size: calc-size(auto, size + 0px))` block to deliver advanced features only to capable browsers.

## Basic Syntax

```css
/* calc-size(<calc-size-basis>, <calc-sum>) — mathematical operations on intrinsic sizing keywords */
.element {
  /* MANDATORY: Always provide a fallback for browsers that do not support calc-size() */
  inline-size: min-content;
  
  /* DO: Use calc-size to modify an intrinsic basis with a calculation or function */
  inline-size: calc-size(min-content, size + 2rem);
}
```

### Valid Basis Arguments (`<calc-size-basis>`)
The first argument defines the "base" size for the calculation.

**Standard Keywords:**
- `auto`: The default sizing for the element.
- `min-content`: The smallest size the element can take without overflowing.
- `max-content`: The size the element takes to fit all content on one line.
- `fit-content`: Equivalent to `clamp(min-content, auto, max-content)`.
- `content`: Only valid when `calc-size()` is used within the `flex-basis` property.

**Special Arguments:**
- `any`: A generic basis used when the specific intrinsic type is unknown or when nesting calculations.
- Nested `calc-size()`: Allows for multi-step or conditional calculations.
- `<calc-sum>`: A specific length, percentage, or mathematical expression (e.g., `100px` or `20%`). When a fixed value is used as the basis, the **`size` keyword is still available** (but only within the second argument) and represents the resolved value of that basis.

**MANDATORY**: The `size` keyword is **not valid** within the first argument (`<calc-size-basis>`) itself. It is a local variable that only exists to refer back to the basis from within the second argument (`<calc-sum>`).

### Valid Calculation Arguments (`<calc-sum>`)
The second argument is the mathematical expression.
- It typically uses the `size` keyword to refer to the value of the basis.
- While the `size` keyword is technically optional, omitting it means the calculation will resolve to a fixed value, ignoring the basis entirely.
- It can include standard math operators (`+`, `-`, `*`, `/`).
- It can include CSS math functions like `clamp()`, `min()`, `max()`, and `round()`.
- **MANDATORY**: `calc-size()` only allows a **single** intrinsic size value (the basis) in each calculation. You cannot mix intrinsic sizing keywords in the same `calc-size()` call.

## Use Cases

### Animating to and from Intrinsic Sizes
By default, browsers cannot interpolate between a length (e.g., `0px`) and an intrinsic keyword (e.g., `auto`). Wrapping the keyword in `calc-size()` makes it an interpolatable value.

#### Choosing the Right Tool for Animations
- **MANDATORY: Use `interpolate-size: allow-keywords`**: For simple animations to or from intrinsic sizes (e.g., `height: 0` to `height: auto`) without any mathematical modifications. This is the required approach for simple keyword interpolation and should ideally be applied globally via `:root`.

  ```css
  :root {
    /* Best practice: Enable keyword interpolation globally */
    interpolate-size: allow-keywords;
  }

  .item {
    height: 0;
    transition: height 0.3s ease;
  }

  .item.open {
    /* Simple interpolation from 0 to auto now works without calc-size() */
    height: auto;
  }
  ```

- **Use `calc-size()`**: ONLY when you need to perform mathematical calculations on an intrinsic size during a transition (e.g., adding padding or clamping the size).

```css
.accordion-content {
  display: block;
  overflow: hidden;
  /* MANDATORY: Fallback value for closed state */
  block-size: 0;
  transition: block-size 0.3s ease-out;
}

.accordion-content.open {
  /* MANDATORY: Fallback value for open state */
  block-size: auto;

  /* 
    DO: Use calc-size(auto, ...) to enable animation from 0 to the element's 
    intrinsic size while doing a calculation (in this case, adding a space of 2rem).
  */
  block-size: calc-size(auto, size + 2rem);
}
```

**MANDATORY**: Interpolation between two intrinsic sizing keywords is not possible directly. One end of the transition must be a length or a percentage.

#### Respecting User Motion Preferences
Animations that change the size of large layout areas can be particularly disruptive for users with vestibular disorders. **MANDATORY**: Always respect user motion preferences by using the `prefers-reduced-motion` media query to simplify or minimize non-essential animations. Common strategies include disabling motion entirely, reducing duration, or replacing layout shifts with subtle opacity transitions.

```css
.accordion-content {
  opacity: 0;
  transition: block-size 0.3s ease, opacity 0.3s ease;
}

.accordion-content.open {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .accordion-content {
    /* 
       EXAMPLE: Replacing disruptive layout animations with a subtle fade-in.
       Setting the block-size instantly and transitioning opacity 
       provides a clear state change without large-scale motion.
    */
    transition: opacity 1.5s ease;
  }

  .accordion-content.open {
    /* Jump the size instantly */
    block-size: auto;
  }
}
```


### Applying Constraints to Intrinsic Sizes
You can use `calc-size()` with any CSS math function—such as `min()`, `max()`, `clamp()`, or `round()`—to ensure an element's intrinsic size remains within design boundaries.

```css
.dynamic-container {
  /* MANDATORY: Always provide a fallback for browsers that do not support calc-size() */
  inline-size: fit-content;

  /* 
    DO: Establish a dynamic size based on content, while:
    1. Enforcing boundaries using CSS math functions (min, clamp, etc.)
    2. Modifying the intrinsic size with fixed or relative offsets
  */
  inline-size: calc-size(fit-content, min(size + var(--extra-space), var(--max-allowed)));
}
```

## Critical Considerations

- **Percentage Pitfalls**: Percentages inside the `<calc-sum>` are resolved against the **container's size**, not the `size` keyword. For example, `calc-size(auto, size + 10%)` adds 10% of the *parent's* width to the element's `auto` width, which may lead to unexpected results or overflows.
- **Calculations requirement**: **MANDATORY**: Use `interpolate-size: allow-keywords` instead of `calc-size()` for simple animations (e.g., `0` to `auto`). `calc-size()` should only be used when the layout requires dynamic mathematical adjustments to the intrinsic base.
- **Performance Note**: Animating box model properties like `inline-size` or `block-size` triggers layout recalculations, which can be expensive. Use `calc-size()` animations primarily for layout-critical elements where non-layout alternatives are insufficient.

## Fallback strategies

calc-size() has limited availability.
Supported by: Chrome 129 (Sep 2024) and Edge 129 (Sep 2024).
Unsupported in: Firefox and Safari.
interpolate-size has limited availability.
Supported by: Chrome 129 (Sep 2024) and Edge 129 (Sep 2024).
Unsupported in: Firefox and Safari.

`calc-size()` and `interpolate-size` are **progressive enhancements**. In browsers that do not support them, the properties will be ignored and the layout will remain functional, though animations to intrinsic keywords will jump instead of transitioning. Always provide a standard keyword or length as a fallback.

```css
.element {
  /* Fallback for browsers that don't support calc-size() */
  inline-size: fit-content; 
  /* Modern browsers will override the fallback */
  inline-size: calc-size(fit-content, size + 2rem);
}
```

### Animation and Transition Fallbacks
In browsers without support for `calc-size()` or `interpolate-size`, transitions involving intrinsic sizing keywords will fail to interpolate. 

- **Graceful Degradation**: The default fallback is an "instant jump" between states (e.g., from `0` to `auto`). This is often acceptable as the layout remains functional.
- **Enhanced Experience**: Use `@supports` to apply complex layout logic or additional styling that only makes sense when smooth intrinsic animations are possible.
- **Avoid JS-based measurements**: While you could use JavaScript to measure elements and manually animate their dimensions, this is often unnecessary and can lead to layout thrashing. Relying on the native "instant jump" is the recommended fallback for modern web applications.

For animations, the fallback experience will be an instant jump to the final size. To detect support in CSS or JavaScript:

```css
/* CSS Feature Detection */
@supports (inline-size: calc-size(auto, size + 0px)) {
  .element {
    /* Apply advanced logic only when supported */
  }
}
```

```javascript
/* JavaScript Feature Detection */
if (CSS.supports('inline-size', 'calc-size(auto, size + 0px)')) {
  // Apply advanced sizing or animations
}
```
