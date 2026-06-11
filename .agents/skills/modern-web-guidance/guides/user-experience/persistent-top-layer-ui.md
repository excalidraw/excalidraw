When moving an open `<dialog>`, `popover`, or fullscreen element in the DOM using traditional methods like `appendChild()` or `insertBefore()`, the browser implicitly removes the element from the DOM and re-inserts it. This removal resets the state, causing open modals, popovers, and fullscreen elements to close abruptly.

To reparent top-layer elements without interrupting the user experience or closing them, use the atomic `moveBefore()` API instead.

### Reparenting open top-layer elements

`moveBefore()` takes two arguments: the node to move, and a reference node to insert before (or `null` to append to the end of the new parent).

```javascript
const newParent = document.getElementById('new-container');
const dialogElement = document.getElementById('my-dialog');

// MANDATORY: Use moveBefore to ensure the <dialog> or popover stays open.
// Passing null appends it to the end of newParent.
newParent.moveBefore(dialogElement, null);
```

### Fallback strategies

moveBefore() has limited availability.
Supported by: Chrome 133 (Feb 2025), Edge 133 (Feb 2025), and Firefox 144 (Oct 2025).
Unsupported in: Safari.

Since `moveBefore()` is a progressive enhancement, you MUST use feature detection before calling it. For older browsers, you will have to fallback to traditional reparenting.

**MANDATORY**: For `<dialog>` elements in unsupported browsers, the traditional move will close the dialog. If you need it to remain open, you must manually re-open it after the move.

```javascript
const targetParent = document.getElementById('target-container');
const popoverOrDialog = document.getElementById('my-top-layer-element');

// Check if moveBefore is supported
if ('moveBefore' in Element.prototype) {
  targetParent.moveBefore(popoverOrDialog, null);
} else {
  // Fallback: traditional move.
  // Note: This WILL close <dialog>, popover, and fullscreen elements.
  const wasOpen = popoverOrDialog.hasAttribute('open') || popoverOrDialog.matches(':popover-open');
  targetParent.insertBefore(popoverOrDialog, null);
  
  // Manually restore state if possible
  if (wasOpen && typeof popoverOrDialog.showModal === 'function') {
    popoverOrDialog.showModal();
  } else if (wasOpen && typeof popoverOrDialog.showPopover === 'function') {
    popoverOrDialog.showPopover();
  }
}
```