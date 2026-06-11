Top-level `await` allows modules to act as asynchronous functions, meaning they can pause module execution to await promises. This is extremely useful for conditionally loading async dependencies—like polyfills or heavy secondary libraries—only when required by the browser. 

By utilizing top-level await, you can encapsulate the conditional loading logic inside a single module, effectively preventing downstream consumer modules from executing until the dependency is fully loaded and ready.

### Conditional polyfill pattern

While top-level `await` can be used to conditionally load any async dependency that's a module, a good use of the conditional depenency loading pattern is to conditionally load polyfills for browsers that don't support a specific feature. This approach encapsulates feature detection and the dynamic import inside a single dependency module.

In the following case, the `popover` attribute polyfill is conditionally loaded if it isn't present on `HTMLElement.prototype`:

```javascript
// conditionally-load-polyfill.js

// Check if the feature is missing before doing work.
// MANDATORY: Prefer checking HTMLElement.prototype over window or document
// when checking for a global DOM attribute or property like popover.
if (!('popover' in HTMLElement.prototype)) {
  // Use top-level await to pause the execution of any module that imports this file 
  // until the polyfill finishes downloading and executing.
  await import('/path/to/popover-polyfill.js');
}

// Export a marker if needed by your application
export const polyfillLoaded = true;
```

```javascript
// main.js

// MANDATORY: Because conditionally-load-polyfill.js uses top-level await, 
// this import will block execution of main.js until the polyfill is ready.
import './conditionally-load-polyfill.js';

// Now it is safe to use the feature (e.g., showing a popover)
const myPopover = document.getElementById('my-popover');
if (myPopover) {
  myPopover.showPopover();
}
```

### Avoiding the Safari top-level `await` bug

**MANDATORY:** You must structure your imports carefully to avoid a bug where top-level await doesn't behave as expected in Webkit, which occurs when multiple modules *simultaneously* import a module that contains a top-level `await`:

```javascript
// DO NOT do this: importing the top-level await module from multiple sibling modules
// simultaneously will crash in Safari.
// 
// a.js: import './conditionally-load-polyfill.js';
// b.js: import './conditionally-load-polyfill.js';
// main.js: import './a.js'; import './b.js'; // CRASH!

// INSTEAD, guarantee a single entry point:
// Import the top-level await module ONCE at the very top of your application tree.
import './conditionally-load-polyfill.js';

// Then import the rest of your application code, ensuring the await resolves first.
import './app.js';
```

### Fallback strategies

Top-level await has limited availability.
Supported by: Chrome 89 (Mar 2021), Edge 89 (Mar 2021), and Firefox 89 (Jun 2021).
Unsupported in: Safari.

Top-level `await` has been supported in all major browsers since 2021 (Chrome 89, Firefox 89, Safari 15). Because of this broad support, **you do not need to implement a fallback strategy for modern web applications.**

As long as you follow the guidance in the previous section to **avoid the Safari execution order bug**, you can safely rely on top-level `await` directly to manage your async dependencies.

You only need to avoid top-level `await` and fall back to standard asynchronous functions or dynamic `import()` orchestration if your application is explicitly required to support legacy browsers released before 2021.
