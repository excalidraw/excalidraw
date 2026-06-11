Add performant, interactive reveal effects to your site with CSS masks and registered custom properties. By using a radial gradient as a mask and registering its stop values, we can smoothly transition the entry and exit, while following a user's pointer with minimal JavaScript. 

## Implementation

### 1. Register Custom Properties
To enable smooth interpolation of gradient stop values, you must register the variables using `@property`. This informs the browser's engine about the data type, allowing it to transition between values during updates.

```css
/* Register the spotlight inner and outer sizes to enable interpolation */
 @property --inner-size{
  syntax: "<length-percentage>";
  inherits: true;
  initial-value: 0px;
}
@property --outer-size{
  syntax: "<length-percentage>";
  inherits: true;
  initial-value: 0px;
}
```

The custom properties tracking the pointer position do not need to be transitioned, so it is not required to register them.

### 2. Define the Masking Layer
Apply the `mask-image` to the element you want to reveal. Use a `radial-gradient` that references the registered properties.

```css
.reveal-layer {
  /* Only transition the size properties, NOT the position variables */
  transition: --inner-size 0.2s ease-in-out, --outer-size 0.2s ease-in-out;  

  /* The spotlight is defined by the transparent center of the mask */
  mask-image: radial-gradient(
    circle at var(--mouse-x) var(--mouse-y),
    black var(--inner-size, 0%),
    transparent var(--outer-size, 0%)
  );

  /* Ensure the mask doesn't repeat if the element is large */
  mask-repeat: no-repeat;

  /* Make the mask layer non-interactive */
  pointer-events: none;
}

/* Update the gradients stops on interaction */
.reveal-layer:hover {
  --inner-size: 100px;
  --outer-size: 120px;
}  
```

### 3. Update Coordinates with JavaScript
Track the pointer position and update the CSS variables. Because the properties are registered and have a `transition` defined, the spotlight will move smoothly even if the pointer events are infrequent.

```javascript
const container = document.querySelector('.container');
// Store the container's bounding rect
let rect = container.getBoundingClientRect();
// Update the rect when the container is resized
const resizeObserver = new ResizeObserver(()=>{
  rect = container.getBoundingClientRect();
})
resizeObserver.observe(container);

container.addEventListener('pointermove', (e) => {
  // Calculate position as a percentage of the container.
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;

  // Update the registered properties
  container.style.setProperty('--mouse-x', `${x}%`);
  container.style.setProperty('--mouse-y', `${y}%`);
});
```

### 4. Accessibility and Interaction
**MANDATORY Accessibility Guarantee:** This pattern relies on pointer interactions to reveal a visual spotlight. You MUST guarantee that all underlying content remains fully visible, legible, and independently keyboard-reachable by default in the underlying layout, using the spotlight layer purely as a non-essential visual enhancement for pointer users. Never use this effect to obscure or gate essential content from keyboard-only or assistive technology users.

* **Pointer Events:** Set `pointer-events: none` on the mask overlay layer to allow standard click and touch interactions to pass through to controls underneath.
* **Reduced Motion Override:** Disable smooth transition interpolation for users requesting reduced motion.

```css
/* MANDATORY Copy-Paste Safety: Disable transition scaling for motion-sensitive users */
@media (prefers-reduced-motion: reduce) {
  .reveal-layer {
    transition: none !important;
  }
}
```

## Fallback strategies

Baseline status for Registered custom properties: Newly available. It's been Baseline since 2024-07-09.
Supported by: Chrome 85 (Aug 2020), Edge 85 (Aug 2020), Firefox 128 (Jul 2024), and Safari 16.4 (Mar 2023).

### Non-registered Property Fallback
Browsers that support `mask-image` but not `@property` will still show the spotlight, but the movement will jump between on and off states because they cannot interpolate values inside a `radial-gradient`. Provide fallback values when using `var()`.

```css
.reveal-layer {
  mask-image: radial-gradient(
    circle at var(--mouse-x) var(--mouse-y),
    /* Use fallback values when using the `var()` function for browsers that don't get an initial value from the @property registration. */
    black var(--inner-size, 0%),
    transparent var(--outer-size, 0%)
  );
}
```

Baseline status for Masks: Newly available. It's been Baseline since 2023-12-07.
Supported by: Chrome 120 (Dec 2023), Edge 120 (Dec 2023), Firefox 53 (Apr 2017), and Safari 15.4 (Mar 2022).

### Basic Mask Support

For browsers that do not support CSS masking at all:
1. **Prefixed property:** Use the `-webkit-mask-image` prefixed property for broader browser support.
2. **Progressive Enhancement:** Design the base state of the UI to be fully functional and legible without the reveal effect. This is useful when the effect is only adds visual flair, and not a requirement for reading content.
