When a modal dialog is open, users expect to use familiar controls to dismiss them: pressing the <kbd>Esc</kbd> key on a keyboard, using the back button or gesture on mobile platforms, or a dismiss gesture with assistive technologies.

When the `<dialog>` element was first introduced, it could be dismissed with the <kbd>Esc</kbd> key, but not other platform controls such as a back button/gesture on mobile. With the addition of the `closedby` attribute for `<dialog>` elements, the extended behavior of responding to more platform-specific controls for close requests has been applied for `<dialog>` elements that are opened in a modal state (i.e. when opened imperatively with the `<dialog>` element’s `showModal()` method in JavaScript or declaratively with the `show-modal` invoker command). So, there is no specific change developers need to make if they are already using the `<dialog>` element.

```html
<!-- MANDATORY: must be opened with either `showModal()` with JavaScript or the `show-modal` command using declarative command invokers in order respond to close requests including platform-specific controls. -->
<dialog aria-labelledby="example">
  <h1 id="example">Example</h1>
  <p>Modal that can be dismissed with close requests.</p>
</dialog>
```

When opened in a modal state, a dialog without the `closedby` attribute responds to close requests the same as explicitly setting the `closedby` attribute to `closerequest`.

```html
<!-- This is unnecessary as it is the default behavior for modal dialogs -->
<dialog closedby="closerequest" aria-labelledby="example">
  <h1 id="example">Example</h1>
  <p>Modal that can be dismissed with close requests.</p>
</dialog>
```

If you also want “light dismiss” behavior, then you must set `closedby` to `any`:

```html
<dialog closedby="any" aria-labelledby="example">
  <h1 id="example">Example</h1>
  <p>Modal that can be dismissed with close requests and light dismiss.</p>
</dialog>
```

## Fallback strategies

<dialog closedby> has limited availability.
Supported by: Chrome 134 (Mar 2025), Edge 134 (Mar 2025), and Firefox 141 (Jul 2025).
Unsupported in: Safari.

`<dialog>` elements opened in a modal state can already be dismissed with <kbd>Esc</kbd>, so there is no fallback necessary. There is no good way to implement close requests from mobile back button/gestures, so it is simpler to embrace this feature as a progressive enhancement, especially given that there are other inclusive means to dismiss the modal dialog. Similarly, light dismiss behavior for a `<dialog>` element using `closedby="any"` can be considered a progressive enhancement.