As items are added or removed from a list, or rearranged, transitions can help users maintain context. View transitions provide a way to transition between two states of an element by giving the element a unique `view-transition-name`. When multiple elements on a page share the same transition behavior, `view-transition-class` allows you to define that logic once in CSS rather than repeating it for every unique `view-transition-name`. This keeps your stylesheets maintainable while ensuring consistent animations across a group of elements.

### Implementation steps

1. **Assign unique names and a shared class**

Each element that needs to be tracked individually during a transition must have a unique `view-transition-name`.

```html
<!-- Mandatory: Each element must have a unique view-transition-name -->
<li style="view-transition-name: item-1" class="item">Item 1</li>
<li style="view-transition-name: item-2" class="item">Item 2</li>
```

To apply shared styles, also assign a `view-transition-class`.

```css
.item {
  view-transition-class: list-item;
}
```

2. **Define the shared transition logic**
   
Use the `::view-transition-group()` pseudo-element with the class selector to apply styles to all members of that group.

```css
/* Targets any view transition group that has the 'list-item' class */
::view-transition-group(.list-item) {
  animation-duration: 0.5s;
  animation-timing-function: ease-in-out;
}

/* Handle accessibility by respecting motion preferences */
@media (prefers-reduced-motion: reduce) {
  /* Disable all group transitions, including the default `root` group. */
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

3. **Optional: Define entry and exit animations**

Use the `:only-child` selector to add specific transitions to the elements that are added or removed. `::view-transition-new()` and `::view-transition-old()` pseudo-elements are children of a `::view-transition-image-pair()` pseudo-element, so we can determine it is an added or removed element if it is the only child.

```css
/* A `::view-transition-new()` element is the only child if it wasn't present before the view transition, so it is an added element. */
::view-transition-new(.list-item):only-child {
  animation-name: slide-in;
  /* Specify an animation duration if you want something different than the UA default of 0.5s */
  animation-duration: 1s;
}
/* A `::view-transition-old()` element is the only child if it isn't present after the view transition, so it is a removed element. */
::view-transition-old(.list-item):only-child {
  animation-name: slide-out;
  /* Specify an animation duration if you want something different than the UA default of 0.5s */
  animation-duration: 1s;
}

@keyframes slide-in {
  from {
    translate: -100vw 0;
  }
}
@keyframes slide-out {
  to {
    translate: -100vw 0;
  }
}
```

4. **Trigger the transition**

Wrap the DOM update in `document.startViewTransition()`. The browser will capture the old state, perform the update, and then animate to the new state.

```javascript
function updateList(newData) {
  document.startViewTransition(() => {
    // All DOM changes inside this callback will be transitioned
    render(newData);
  });
}
```

5. **Maintain interactivity of non-transitioned elements**

View transitions work by overlaying snapshots of the DOM elements, and then transitioning the snapshots. This means that during the transition, elements are not interactive. If there are interactive elements that are not transitioned, you can make them interactive by disabling touch events on the view transitions.

```css
::view-transition {
  /* Non-transitioned elements below the view transitions remain interactive */
  pointer-events: none;
}
```

In addition, by default, the `:root` element has a view transition named `root`, which enables default full-page transitions. If there are no changes to the root element, this will be a transition between two identical snapshots, which are not interactive. Because we are only transitioning specific elements, and not the entire screen, we can disable the `root` transition. 

```css
:root {
  /* Disable the root transition because we are only transitioning specific elements. */
  view-transition-name: none;
}
```

### Fallback strategies

Baseline status for view-transition-class: Newly available. It's been Baseline since 2025-10-14.
Supported by: Chrome 125 (May 2024), Edge 125 (May 2024), Firefox 144 (Oct 2025), and Safari 18.2 (Dec 2024).

View Transitions are a progressive enhancement. If the browser does not support `document.startViewTransition`, the DOM update should still occur immediately, providing a functional but non-animated experience.

```javascript
if (document.startViewTransition) {
  document.startViewTransition(() => updateDOM());
} else {
  // Fallback: Perform the update without animation
  updateDOM();
}
```

For CSS, browsers that do not recognize `view-transition-class` or the `::view-transition-group()` class selector will simply ignore those rules, and no animation will be applied.
