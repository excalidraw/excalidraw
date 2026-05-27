Modern modal dialogs often support "light-dismiss," allowing users to close a dialog by clicking or tapping the backdrop (the area outside the dialog). The `closedby` attribute provides a declarative way to enable this behavior without custom JavaScript.

## Implementation

To enable light-dismiss:

1. Add `closedby="any"` to the `<dialog>` element.
2. Open the dialog using `dialog.showModal()`.

### Attribute Values

- `any`: Enables light-dismiss (clicking the backdrop), "close requests" (the `Esc` key), and developer mechanisms (e.g., `dialog.close()`).
- `closerequest`: Enables "close requests" and developer mechanisms only. This is the default for modal dialogs.
- `none`: Only developer mechanisms can close the dialog.

### Styling the Backdrop
When a dialog is opened as a modal using `showModal()`, the browser generates a `::backdrop` pseudo-element. This backdrop covers the entire viewport and sits directly behind the dialog.

```css
/* Style the backdrop to indicate the dialog is modal */
dialog::backdrop {
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px); /* Optional: add blur for modern browsers */
}
```

## Example

```html
<!-- MANDATORY: Use closedby="any" to enable light-dismiss behavior -->
<dialog id="myDialog" closedby="any" aria-labelledby="dialogTitle">
  <form method="dialog">
    <h2 id="dialogTitle">Feedback</h2>
    <p>Click outside this box or press Esc to dismiss.</p>
    <button type="submit">Close</button>
  </form>
</dialog>

<button onclick="document.getElementById('myDialog').showModal()">Open Dialog</button>
```

## Constraints & Accessibility

- **MANDATORY**: Use `closedby="any"` to enable light-dismiss declaratively.
- **MANDATORY**: Always open modal dialogs with `showModal()`. This ensures the dialog is in the top layer, focus is trapped, and the `Esc` key is handled.
- **DO**: Use `aria-labelledby` or `aria-label` to provide an accessible name for the dialog.
- **DO NOT**: Use `closedby` for non-modal dialogs (opened with `show()`), as they do not have a backdrop and won't trigger light-dismiss.
- **DO NOT**: Use the `click` event for critical logic that should happen *before* closing; instead, listen for the `close` or `cancel` events.

## Fallback strategies

<dialog closedby> has limited availability.
Supported by: Chrome 134 (Mar 2025), Edge 134 (Mar 2025), and Firefox 141 (Jul 2025).
Unsupported in: Safari.

**MANDATORY**: For browsers that do not yet support `closedby`, you **must** implement a fallback for light-dismiss by checking if a click occurred outside the dialog content's boundaries using the following script:

```javascript
const dialog = document.querySelector('dialog');

// Fallback for browsers without closedby support
if (!('closedBy' in HTMLDialogElement.prototype)) {
  dialog.addEventListener('click', (event) => {
    // 1. When clicking the backdrop, the event target is the dialog element itself.
    // Ignore clicks where the target is a child element inside the dialog.
    if (event.target !== dialog) return;

    // 2. Check if the click coordinates fall within the dialog's content box.
    // This distinguishes between a click on the backdrop vs a click on the dialog's background/padding.
    const rect = dialog.getBoundingClientRect();
    const isDialogContent = (
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width
    );

    if (isDialogContent) return;

    // 3. Since the click was outside the content area (on the backdrop), manually close the dialog.
    dialog.close();
  });
}
```
