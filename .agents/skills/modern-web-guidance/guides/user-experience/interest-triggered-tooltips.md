# Show a tooltip when hovering

Users expect to see additional related information without completely changing their context. Showing a tooltip when a user is interested in more information can be useful to provide definitions for a term, clarifying the action an icon-only button will take, or provide additional form field guidance.

## Creating the tooltip

You can create a popover with the required behavior by adding the `popover="hint"` attribute to a `<div>` or other semantically appropriate element. When the user opens the tooltip, this hides other `popover="hint"` tooltips, but doesn't hide `auto` or `manual` tooltips. It also handles dismissing nested tooltips.

It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.

The tooltip element must have an `id` attribute with a unique value:

```html
<!-- MANDATORY: The tooltip container `<div>` must have a `popover` attribute.
     the value of `"hint"` ensures it can be "light dismissed". -->
<div popover="hint" id="tooltip">Tooltip content</div>
```

A user expresses interest in the additional information by hovering or focusing on an `<a>` or `<button>` element. The element must have an `interestfor` attribute that matches the `id` attribute of the tooltip.

```html
<!-- The `interestfor` attribute can be applied to a `<button>` element: -->
<button interestfor="tooltip">Tooltip trigger</button>

<!-- The `interestfor` attribute can also be applied to an `<a>` element: -->
<a interestfor="tooltip" href="">Tooltip trigger</a>
```

The trigger must have a visual indicator to indicate that there is additional information available by interacting with the trigger.

### Accessibility built in to `interestfor`

`interestfor` handles the assistive-technology wiring for you, so you generally do not need to add ARIA attributes manually:

- A target with `popover="hint"` gains an implicit minimum role of `tooltip`. **DO NOT** set `role="tooltip"` yourself.
- The browser implicitly associates the source element with the target via `aria-describedby` when the target is plaintext, or via `aria-details` when the target contains interactive content. **DO NOT** add `aria-describedby` or `aria-details` to the trigger.
- Because the association switches to `aria-details` when needed, the target IS allowed to contain interactive content (e.g. a link inside an "interest card").

### Accessibility Constraints (WCAG 1.4.13)

Even with `interestfor` handling the semantics above, your implementation MUST still satisfy WCAG 1.4.13 (Content on Hover or Focus):
- **Dismissible:** Users must be able to dismiss the tooltip without moving pointer hover or keyboard focus (e.g., by pressing the `Escape` key). The native `popover` attribute manages this binding automatically.
- **Hoverable:** The pointer must be able to move over the tooltip content itself without the tooltip disappearing. This allows users with magnification tools to read the tooltip text safely.
- **Persistent:** The tooltip must remain visible until the hover or focus trigger is removed, the user explicitly dismisses it, or its content is no longer valid.

### Positioning the tooltip

The tooltip can be positioned using anchor positioning. When the tooltip is opened using `interestfor`, the trigger becomes an implicit anchor for the tooltip, meaning you don't have to add `anchor-name` or `position-anchor` CSS properties. However, to support browsers without anchor positioning you must use the anchor positioning polyfill, which has several limitations for popovers. **MANDATORY:** Implicit anchors are NOT supported by the polyfill, so YOU MUST explicitly set an `anchor-name` on the trigger and `position-anchor` on the popover.


```css
/* MANDATORY: use explicit anchor names for compatibility with the polyfill */
button[interestfor="tooltip-dom"] {
  anchor-name: --tooltip-dom;
}
#tooltip-dom {
  position-anchor: --tooltip-dom;
}
```

Also, the polyfill does not support `position-area` on popovers, so **MANDATORY:** DO position using `anchor()` functions, and **YOU MUST** include a `position-try` fallback (e.g. `flip-block` or `flip-inline`).

```css
[popover]{
  /* MANDATORY: use anchor functions and a position-try fallback for the polyfill */
  top: anchor(bottom);
  left: anchor(center);
  position-try: flip-block;
  margin: unset;
}
```


### Fallback strategies

Interest invokers has limited availability.
Supported by: Chrome 142 (Oct 2025) and Edge 142 (Oct 2025).
Unsupported in: Firefox and Safari.

Interest invokers must be conditionally polyfilled using the `interestfor` polyfill package from NPM. Do prefer bundling the polyfill over using the CDN.

```html
<script type="module">
  if(!HTMLButtonElement.prototype.hasOwnProperty("interestForElement")){
    // CDN link only used for example, prefer bundling.
    await import("https://unpkg.com/interestfor@latest");
  }
</script>
```

Baseline status for Popover: Newly available. It's been Baseline since 2025-01-27.
Supported by: Chrome 116 (Aug 2023), Edge 116 (Aug 2023), Firefox 125 (Apr 2024), Safari 17 (Sep 2023), and Safari iOS 18.3 (Jan 2025).
popover="hint" has limited availability.
Supported by: Chrome 133 (Feb 2025), Edge 133 (Feb 2025), and Firefox 149 (Mar 2026).
Unsupported in: Safari.

Popover and popover hint must conditionally be polyfilled with the `@oddbird/popover-polyfill` polyfill. The hint behavior will not be polyfilled in browsers that support `popover` but not `popover="hint"`. For those browsers, a tooltip opened via focus may stay open when a second tooltip opened via hover.

```html
<script type="module">
  if(!HTMLElement.prototype.hasOwnProperty("popover")){
    await import("https://unpkg.com/@oddbird/popover-polyfill@latest");
  }
</script>
```

Anchor positioning is not natively supported by any major browser yet.

**MANDATORY:** To support browsers without anchor positioning, you MUST use the `@oddbird/css-anchor-positioning` polyfill. It does not support implicit anchors, so you MUST add anchor names to the trigger. Additionally, `position-area` is not supported on popovers by the polyfill, so you MUST use `anchor()` on the desired insets. 

```html
<!-- MANDATORY: Conditionally install the anchor positioning polyfill -->
<script type="module">
  if (!("anchorName" in document.documentElement.style)) {
    await import("https://unpkg.com/@oddbird/css-anchor-positioning");
  }
</script>
```

```css
button[interestfor="tooltip-attrs"] {
  /* MANDATORY: Each trigger and popover pair must have a unique anchor name, referenced by `anchor-name` on the trigger and `position-anchor` on the popover. */
  anchor-name: --tooltip-attrs;
}
#tooltip-attrs {
  position-anchor: --tooltip-attrs;
  /* If using the anchor positioning polyfill with a popover, DO use `anchor()` functions, and not `position-area. */
  top: anchor(bottom);
  left: anchor(right);
  margin: unset;
}
```