Traditional CSS easing functions like `ease-in` or `cubic-bezier()` are limited to simple curves, making it impossible to create complex physics-based effects like bounces or springs. The `linear()` timing function solves this by allowing you to provide a series of stops that can approximate complex curves. Transitions and animations are interpolated based on straight lines between the stops, but within enough stops, it can appear smooth.

### Implementation Steps

1.  **Generate the curve stops:**
    Manually plotting dozens of points for a spring or bounce is impractical. Use a timing function from an external library, or use a  tool to convert an existing JavaScript easing function or an SVG path into the `linear()` syntax. Optional: store these timing functions as CSS custom properties for reuse throughout your site.
2.  **Define the timing function:**
    Apply the generated stops to the `transition-timing-function` or `animation-timing-function` property, or through the `transition` or `animation` shorthands.
3.  **Adjust the duration:**
    Unlike JavaScript physics engines where duration is derived from physical properties (mass, stiffness), CSS still requires a fixed `duration`. You may need to adjust the duration to get the intended effect.

### Example: Spring Easing

This example shows how to use a custom `linear()` function to create a spring effect that overshoots the target value before settling.

```css
.spring {
  /* Define the physics-based easing as a reusable variable */
  --spring-easing: linear(0, 0.016 0.5%, 0.06 1%, 0.226 2%, 1.116 5.4%, 1.375 6.6%, 1.527 7.7%, 1.565 8.2%, 1.585 8.8%, 1.581 9.3%, 1.559 9.8%, 1.458 10.9%, 0.937 14.3%, 0.784 15.5%, 0.693 16.6%, 0.67 17.1%, 0.657 17.7%, 0.671 18.7%, 0.729 19.8%, 1.042 23.3%, 1.13 24.5%, 1.182 25.6%, 1.201 26.7%, 1.192 27.7%, 1.156 28.8%, 0.977 32.2%, 0.925 33.4%, 0.894 34.5%, 0.882 35.6%, 0.887 36.6%, 0.907 37.7%, 1.045 42.4%, 1.069 44.5%, 1.059 46.3%, 0.979 50.9%, 0.96 53.4%, 0.966 55.3%, 1.013 59.9%, 1.024 62.3%, 0.986 71.2%, 1.008 79.9%, 0.995 88.9%, 1);


  /* Apply the easing with a duration that fits the spring's complexity */
  /* MANDATORY: Always include a duration; linear() does not calculate it automatically */
  transition: scale 0.8s var(--spring-easing);
}

.spring:hover {
  scale: 1.2;
}
```
### Example: Bounce Easing

This example shows how to use a custom `linear()` function to create a bounce effect.

```css
.bounce {
  /* Define the physics-based easing as a reusable variable */
  --bounce-easing: linear(0, 0.214 14.7%, 0.386 23.7%, 0.598 31.9%, 0.999 44.7%, 0.807 52.6%, 0.762 56%, 0.747 59.4%, 0.758 62.4%, 0.793 65.6%, 0.999 77.4%, 0.961 81.2%, 0.949 84.8%, 0.956 88%, 0.993 95.5%, 1);


  /* Apply the easing with a duration that fits the bounce's complexity */
  /* MANDATORY: Always include a duration; linear() does not calculate it automatically */
  transition: scale 0.4s var(--bounce-easing);
}

.bounce:hover {
  scale: 1.2;
}
```

### Key Considerations

*   **Performance:** For the smoothest physics-based animations, apply `linear()` to properties that run on a separate thread, such as `transform` and `opacity`.
*   **Precision vs. Payload:** While more stops result in a smoother curve, they also increase the size of your CSS. Most generators allow you to "simplify" the curve to find the optimal balance between smoothness and code size.
*   **Avoid Opacity for Bounces:** Applying bounce easings to `opacity` can cause visually jarring flickering if the value overshoots below 0 or above 1.
*   **Accessibility:** Complex physics-based animations can be distracting or cause motion sensitivity for some users. Always respect user preferences by reducing or disabling these animations.

```css
@media (prefers-reduced-motion: reduce) {
  .element {
    transition: none;
  }
}
```

### Fallback strategies

Baseline status for linear() easing: Newly available. It's been Baseline since 2023-12-11.
Supported by: Chrome 113 (May 2023), Edge 113 (May 2023), Firefox 112 (Apr 2023), and Safari 17.2 (Dec 2023).

#### CSS Fallback
For browsers that do not support `linear()`, provide a standard easing function as a fallback. The browser will ignore the `linear()` value if it doesn't recognize it, falling back to the previous valid declaration.

```css
.element {
  /* Fallback for older browsers (standard smooth exit) */
  transition: transform 0.8s ease-out;
  
  /* Modern browsers will override with the physics-based easing */
  transition-timing-function: linear(0, 1.1, 0.95, 1.02, 1);
}
```

#### JavaScript Library Fallback (Motion/GSAP)

Optional: If a high-fidelity physics animation is critical even in older browsers, use a JavaScript library like **Motion** (motion.dev) or **GSAP** (greensock.com) to handle the animation when `linear()` is unsupported.

1.  **Detect support:** Use `CSS.supports()` to check if the browser handles the `linear()` function.
2.  **Conditionally load/apply:** If unsupported, use the library's spring or bounce implementation.

```javascript
/* Detect if the browser supports the linear() function */
const supportsLinearEasing = window.CSS && CSS.supports('animation-timing-function', 'linear(0, 1)');

if (!supportsLinearEasing) {
  /* 
     Example using Motion (motion.dev) for a spring fallback.
     This should only be initialized if native CSS support is missing.
  */
  import("https://cdn.jsdelivr.net/npm/motion@latest/dist/motion.js").then(({ animate, spring }) => {
    animate(".element", { transform: "scale(1.2)" }, {
      easing: spring({ stiffness: 100, damping: 10 })
    });
  });
}
```

You can also use `@supports` in CSS for more explicit feature detection:

```css
@supports not (animation-timing-function: linear(0, 1)) {
  .element {
    /* Alternative experience for unsupported browsers */
    transition-duration: 0.4s;
    transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
  }
}
```
