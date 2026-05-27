# Creating Persistent App Tours

Onboarding tours require overlays that persist while users interact with the highlighted features. Unlike auto popovers, manual popovers do not close when the user clicks elsewhere on the page. Combining `popover="manual"` with CSS Anchor Positioning allows you to create non-modal, tethered tour steps.

### Recommended Implementation

#### HTML
```html
<div id="feature-target">Highlight this feature</div>

<!-- MANDATORY: Enforce overlay dialog semantics and accessible name bindings -->
<div id="tour-step" popover="manual" role="dialog" aria-labelledby="tour-title">
  <!-- Assume an <h1> precedes this element in the full document outline -->
  <h2 id="tour-title">Step 1</h2>
  <p>Learn how to use this feature.</p>
  <button popovertarget="tour-step" popovertargetaction="hide">Got it</button>
</div>
```

#### CSS
```css
#feature-target {
  anchor-name: --feature-target;
}

#tour-step {
  popover: manual;
  position-anchor: --feature-target;
  position-area: right center;
  inset: auto;
  margin: 1rem;
  padding: 1rem;
  border: 1px solid blue;
  border-radius: 0.5rem;
  background: aliceblue;
}
```

#### JavaScript
```javascript
const tourStep = document.getElementById('tour-step');
tourStep.showPopover();
// MANDATORY: Programmatically route focus into the non-modal popover so keyboard/assistive technology users immediately perceive the new context
tourStep.querySelector('button').focus();
```

### Implementation Guidelines

* **MANDATORY:** Use `popover="manual"` to prevent the tour step from closing accidentally during user interaction.
* **MANDATORY:** Mark the container with `role="dialog"` and link its heading via `aria-labelledby`.
* **MANDATORY:** Shift programmatic focus inside the popover immediately after opening to prevent focus abandonment.
* **DO** use CSS Anchor Positioning to tether the tour step to the specific feature being explained.
* **DO** provide an explicit "Close" or "Next" button within the popover that uses `popovertargetaction="hide"`.

### Fallback strategies

Baseline status for Popover: Newly available. It's been Baseline since 2025-01-27.
Supported by: Chrome 116 (Aug 2023), Edge 116 (Aug 2023), Firefox 125 (Apr 2024), Safari 17 (Sep 2023), and Safari iOS 18.3 (Jan 2025).

If the browser does not support Popover, use the `@oddbird/popover-polyfill`:

```html
<script type="module">
  if (!HTMLElement.prototype.hasOwnProperty('popover')) {
    await import('https://unpkg.com/@oddbird/popover-polyfill');
  }
</script>
```

Alternatively, for legacy support without a polyfill, use `position: fixed` and manually calculate coordinates via JavaScript `getBoundingClientRect()`.

#### anchor-positioning

Anchor positioning is not natively supported by any major browser yet.

To support browsers without anchor positioning, you can choose between using a polyfill or a pure CSS fallback.

##### Option 1: Polyfill Fallback
The `@oddbird/css-anchor-positioning` polyfill can be used to emulate anchor positioning. It does not support implicit anchors, so you MUST add explicit anchor names to the trigger. Additionally, `position-area` is not supported on popovers by the polyfill, so you MUST use `anchor()` on the desired insets instead of `position-area`.

```html
<script type="module">
  if (!CSS.supports('anchor-name: --foo')) {
    await import("https://unpkg.com/@oddbird/css-anchor-positioning");
  }
</script>
```

```css
#tour-step {
  /* If using the anchor positioning polyfill with a popover, DO use `anchor()` functions instead of `position-area`. */
  left: anchor(right);
  top: anchor(top);
}
```

##### Option 2: Non-Polyfill CSS Fallback
If you prefer not to use a polyfill, you can default the tooltip to a fixed position at the bottom of the viewport using `@supports not`.

```css
@supports not (anchor-name: --foo) {
  #tour-step {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    margin: 0;
    border-radius: 0;
  }
}
```