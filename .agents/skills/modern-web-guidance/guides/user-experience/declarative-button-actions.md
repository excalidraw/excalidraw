# Declarative Button Actions
The Invoker Commands API allows buttons to trigger actions on target elements declaratively using HTML attributes. This approach reduces the need for manual event listeners and ensures interactivity as soon as the HTML is parsed.

For custom, application-specific actions, you can define your own command names. Custom commands must be prefixed with a double dash (`--`) to avoid collisions with future built-in browser commands.

## Implementation steps

1.  **Define the target element**: Identify the element that will respond to the action. It must have a unique `id`.
2.  **Configure the invoker button**: Use the `commandfor` attribute to point to the target's `id`, and the `command` attribute to specify the custom command name (prefixed with `--`).
3.  **Handle the command event**: Attach a `command` event listener to the `document` (or a common parent). This ensures that the event is captured even if it is dispatched by a polyfill or from a child element. The event object contains a `command` property and a `target` property (referring to the element identified by `commandfor`).

## Example: Custom Animation Controls

```html
<!-- The target element that will respond to custom commands -->
<div id="action-target" class="target">
  Action Target
</div>

<!-- Buttons declaratively linked to the target element -->
<!-- Each button sends a unique custom command starting with '--' -->
<button commandfor="action-target" command="--spin">
  Spin
</button>

<button commandfor="action-target" command="--grow">
  Grow
</button>

<button commandfor="action-target" command="--reset">
  Reset All
</button>

<script>
  // Listen for the 'command' event directly on the target element
  // (This is necessary because the native 'command' event does not bubble)
  document.getElementById('action-target').addEventListener('command', (event) => {
    // Robustly handle both native API and manual/polyfill fallbacks
    const command = event.command || event.detail?.command;
    const target = event.currentTarget;

    // Custom commands are checked to identify the requested action
    if (command === '--spin') {
      target.classList.toggle('is-spun');
    } else if (command === '--grow') {
      target.classList.toggle('is-grown');
    } else if (command === '--reset') {
      // Clear all custom classes to return to initial state
      target.classList.remove('is-spun', 'is-grown');
    }
  });
</script>
```

## Key constraints

*   **Prefix custom commands**: MANDATORY: All custom command names must start with `--` (e.g., `command="--my-action"`).
*   **Targeting**: The `commandfor` attribute must match the `id` of an element in the same document tree.

## Fallback strategies

Baseline status for Invoker commands: Newly available. It's been Baseline since 2025-12-12.
Supported by: Chrome 135 (Apr 2025), Edge 135 (Apr 2025), Firefox 144 (Oct 2025), and Safari 26.2 (Dec 2025).

If the Invoker Commands API is not supported, the `command` event will not fire. For full support across all modern browsers, it is recommended to use the invokers-polyfill from https://github.com/keithamus/invokers-polyfill via `npm install` or CDN.

This polyfill fully supports custom actions (starting with `--`) and dispatches the `command` event exactly like the native API.

### Dynamic Import (Performance Optimization)

For the best performance, you should only load the polyfill if the browser doesn't support the API natively. This saves bandwidth and reduces script execution time for users on modern browsers.

```javascript
// Check for native support first
const hasNativeSupport = 'commandForElement' in HTMLButtonElement.prototype;

if (!hasNativeSupport) {
  // Dynamically import the polyfill only when needed
  try {
    await import('https://cdn.jsdelivr.net/npm/invokers-polyfill@latest/dist/index.min.js');
    console.log('Invoker Commands polyfill loaded');
  } catch (err) {
    console.error('Error loading fallback:', err);
  }
}
```

### Manual fallback (Traditional pattern)

If you prefer not to use a polyfill, you can use a combination of **event delegation** to dispatch events and a **command registry** to handle the actions. This is a common architectural pattern in traditional JavaScript development that remains highly efficient and scalable.

```javascript
// 1. Define a registry of requested actions for cleaner logic
const commandRegistry = {
  '--spin': (target) => target.classList.toggle('is-spun'),
  '--grow': (target) => target.classList.toggle('is-grown'),
  '--reset': (target) => target.classList.remove('is-spun', 'is-grown'),
};

const supportsInvokers = 'commandForElement' in HTMLButtonElement.prototype;

// 2. The fallback: Dispatch events manually if native support is missing
if (!supportsInvokers) {
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button[commandfor]');
    if (!button) return;

    const target = document.getElementById(button.getAttribute('commandfor'));
    const command = button.getAttribute('command');

    if (target && command) {
      target.dispatchEvent(new CustomEvent('command', {
        bubbles: true,
        detail: { command }
      }));
    }
  });
}

// 3. The unified listener: Registered directly on the target element
document.getElementById('action-target').addEventListener('command', (event) => {
  const command = event.command || event.detail?.command;
  const target = event.currentTarget;
  const action = commandRegistry[command];

  if (action) {
    action(target);
  }
});
```
