# Same Document Transitions

## The Problem

Web sites often provide multiple views of an object, for instance a list of products, and then a detail page for each product. Navigating between the two views often feels disconnected. When a user clicks a product thumbnail to view its details, the thumbnail disappears and a new, larger image appears instantly elsewhere on the screen. This lack of continuity makes it harder for users to track relationships between elements.

## The Solution

The **View Transitions API** allows you to specify element pairs that exist in different states before and after a transition. When triggering a transition with `document.startViewTransition()` in a Single Page Navigation (SPA), the browser identifies these shared elements by their shared unique `view-transition-name`. It then automatically calculates the difference in their position, size, and styling, and animates them smoothly from the old state to the new state. This transition occurs in the top layer, above even elements with high `z-index` values.

## Implementation Guide

### Step 1: Wrap State Changes in `startViewTransition`

For Single-Page Applications (SPAs) or simple state changes, wrap the logic that updates the DOM in `document.startViewTransition`. The browser captures a snapshot of the current state, runs the update, and then captures the new state. 

```javascript
function navigate(view) {
  // MANDATORY: Wrap the update in startViewTransition
  document.startViewTransition(() => updateDOM(view));
}
```

### Step 2: Assign Shared Transition Names

Use the `view-transition-name` CSS property to tell the browser which elements should be morphed. The name can be anything (except `none`). **MANDATORY**: there must be no more than 1 element before and after with a given `view-transition-name`. If there are 2 or more elements with a given `view-transition-name`, the DOM will be updated to the new state immediately, without a transition.

You can use multiple `view-transition-name`s to morph multiple pairs of elements. For example, you may want to transition both the product image and title with separate transitions.

Because there are multiple items on the list view, you can not give the all of them the same `view-transition-name`. This can be solved in two ways in a SPA.

1. **Dynamic detail page:** Assign each item on the list page a unique `view-transition-name`, and then dynamically apply that name to the matching element on the detail page when the list item is selected, as shown here.

```css
/* In the list view, give each */
#product-1 { view-transition-name: p1 }
#product-2 { view-transition-name: p2 }
#product-3 { view-transition-name: p3 }
```

```js
function updateDOM(clickedTransitionName){
  const hero = document.getElementById("hero");
  hero.style.viewTransitionName = clickedTransitionName;
}
```

2. **Dynamic list item:** Assign the element on the detail page a `view-transition-name`, and apply that name to the item on the list page when it is selected. Remove the `view-transition-name` from the item on the list page when returning to the list page.

The `#hero` element on the detail page and the selected `.thumbnail` element on the list page share a `view-transition-name`. 

```css
#hero{
  view-transition-name: hero;
}
.thumbnail.selected {
  view-transition-name: hero;
}
```

When a thumbnail is clicked, we need to prepare the list view by assigning the `view-transition-name` using the `.selected` class selector, and making any changes to the DOM before starting the transition.

Then, you can call `document.startViewTransition()`, and apply the changes to transition the page from the detail to list view.

After navigating back to the list view, you must clean up the view transition classes to prevent the next navigation from erroring. You can perform this cleanup after the transition's `finished` promise resolves.

```javascript
// Function called when a thumbnail is clicked
function goFromListToDetail(e){
  e.currentTarget.classList.add("selected");
  const hero = document.getElementById("hero");
  const bgColor = getComputedStyle(e.currentTarget).backgroundColor;
  hero.style.background = bgColor;

  // Trigger the transition, checking for support
  if (!document.startViewTransition) {
    document.body.classList.add("detail");
    // MANDATORY Accessibility Routing: Route focus to the newly revealed heading to announce context and preserve logical tab flow
    document.getElementById("detail-heading")?.focus();
    return; // MANDATORY: End function execution if view transitions are not supported.  
  }
  const transition = document.startViewTransition(() => {
    document.body.classList.add("detail");
  });
  // MANDATORY Accessibility Routing: Route focus after the view transition resolves
  transition.finished.finally(() => {
    document.getElementById("detail-heading")?.focus();
  });
}

// Function called when navigating from detail back to list view
function goFromDetailToList() {
  if (!document.startViewTransition) {
    document.body.classList.remove("detail");
    document.getElementById("list-heading")?.focus();
    return;
  }
  const transition = document.startViewTransition(() => {
    document.body.classList.remove("detail");
  });
  // Clean up the list view and route focus
  transition.finished.finally(() => {
    // Route focus back to list view
    document.getElementById("list-heading")?.focus();
    // Remove selected classList to remove view-transition-names
    document.querySelectorAll(".selected").forEach(
      (element) => {
        element.classList.remove("selected");
      },
    );
  });
}
```

The method you choose will depend on the use case. The dynamic list item requires less repeated CSS, but more manual JavaScript cleanup.


### Step 3: Fix Aspect Ratio "Stretching"

By default, the browser cross-fades the old and new snapshots within a group that stretches to fit both. If you are transitioning text, set the width of the text element to `fit-content` on both the old and new views, so that the transitioned element's aspect ratio is stable.

```css
#list-page .title {
  width: fit-content;
}

#detail-page #title {
  width: fit-content;
}
```

If you are transitioning elements that change aspect ratio, you may need to set the height of the old and new pseudo-elements to 100% of the `::view-transition-pair()` pseudo-element.

```css
::view-transition-old(hero),
::view-transition-new(hero){
  height: 100%;
}
```

The pseudo-elements are snapshots of the live elements, so you can also use `object-fit` and `object-position` declarations for more control of the transitioning effect.

## Best Practices

-   **DO NOT** specify too many transitions. Only use shared elements for primary content that the user is actively tracking (e.g., hero images, headings).
-   **DO** remove temporary `view-transition-name` values after the transition finishes to avoid side effects on future transitions.
-   **DO NOT** transition elements with active animations. View transitions operate on snapshots, so any animations will appear to be paused during the view transition.
-   **DO** respect user preferences for reduced motion using the `prefers-reduced-motion` media query.
-   **MANDATORY Accessibility Routing**: View transitions morph page layouts dynamically but do not manage programmatic focus. If focus remains on an element that is hidden or removed during the transition, focus is abandoned, leaving keyboard and assistive technology users without context. Shift focus programmatically to an updated page heading or view container (using `tabindex="-1"`) immediately after the DOM updates or when the view transition's `finished` promise resolves.

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

## Fallback Strategies

Baseline status for View transitions: Newly available. It's been Baseline since 2025-10-14.
Supported by: Chrome 111 (Mar 2023), Edge 111 (Mar 2023), Firefox 144 (Oct 2025), and Safari 18 (Sep 2024).

The View Transitions API is designed for progressive enhancement. Browsers that do not support it will simply execute the DOM update immediately without animation.

```javascript
function navigate(){
  if (!document.startViewTransition) {
    // Fallback: Just update the DOM
    updateDOM();
  } else {
    document.startViewTransition(() => updateDOM());
  }
}
```
