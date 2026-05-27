# Accessible Error Announcement

## The Problem
Standard HTML5 validation provides visual feedback (via `:invalid` or `:user-invalid`), but it doesn't automatically synchronize with accessibility attributes like `aria-invalid`. 

If you use standard `:invalid` styling, screen readers might announce "Invalid entry" the moment a user tabs into a required field that is currently empty. This creates a disruptive experience for users using assistive technologies, as the error is announced before interaction has occurred.

## The Solution
We want the *programmatic* state (`aria-invalid="true"`) to be applied **at the exact same moment** the *visual* state (`:user-invalid`) applies. Since `:user-invalid` relies on the browser's internal "user-interacted" flag, we can use JavaScript to check that this selector matches during standard interaction events.

See [MDN aria-invalid](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-invalid) for more details.

### Implementation Strategy

1.  **Visual Layer**: Use CSS `:user-invalid` to show borders/icons.
2.  **Accessibility Layer**: Use `aria-invalid` and `aria-errormessage` to communicate state to Assistive Technology (AT).
3.  **Bridge Visual & Accessibility Layer**: Create a lightweight JavaScript utility that listens for `blur` and `input` events, checks if the element matches `:user-invalid`, and updates the ARIA attributes accordingly.

## Implementation Guide

### 1. HTML Structure
Link your input to its error message using `aria-errormessage` (or `aria-describedby` for broader support).

```html
<form>
  <div class="field">
    <label for="email">Email</label>
    <input 
      type="email" 
      id="email" 
      required 
      aria-errormessage="email-error"
    >
    <span id="email-error" class="error-msg">
      Please enter a valid email address.
    </span>
  </div>
</form>
```

### 2. CSS
Control the visibility of the error message using the native pseudo-class `:user-invalid`.

```css
.error-msg {
  display: none;
  color: #d93025;
}

/* Show error message when input is user-invalid */
input:user-invalid ~ .error-msg {
  display: block;
}

/* Optional: Visual cues on the input itself */
input:user-invalid {
  border-color: #d93025;
}
```

### 3. JavaScript
Since there is no "UserInvalidChanged" event, hook into standard form events to check the state.

```javascript
const updateAriaState = (event) => {
  const input = event.target;
  if (!input.matches?.('input, textarea, select')) return;

  // Check if the browser currently considers this input "user-invalid"
  const isUserInvalid = input.matches(':user-invalid');
  
  if (isUserInvalid) {
    input.setAttribute('aria-invalid', 'true');
  } else {
    input.removeAttribute('aria-invalid');
  }
};

// Listen on the document to handle dynamically added fields.
// 'blur' and 'focus' do not bubble, so we must use the capture phase (true).
document.addEventListener('blur', updateAriaState, true);
document.addEventListener('focus', updateAriaState, true);

// Also update on input if we've already shown the error, 
// so the error clears immediately when fixed.
document.addEventListener('input', (event) => {
  const input = event.target;
  if (!input.matches?.('input, textarea, select')) return;

  const hasAriaInvalid = input.hasAttribute('aria-invalid');
  const ariaInvalid = input.getAttribute('aria-invalid');
  if (hasAriaInvalid && ariaInvalid === 'true') {
    updateAriaState(event);
  }
});
```

## Fallbacking & Browser Support

The `:user-invalid` pseudo-class is widely supported (Baseline 2023), but older browsers need a fallback.

### Feature Detection
You can check for support in CSS and JavaScript.

**JavaScript Check:**
```javascript
if (!CSS.supports('selector(:user-invalid)')) {
  // Fallback logic here
}
```

### CSS for Fallback
To ensure your fallback logic is visually indistinguishable from the native behavior, you must apply your error styles to both the pseudo-class and your fallback class.

```css
/* Apply error styles to both native selector and fallback class */
input:user-invalid,
input.user-invalid-fallback {
  border-color: #d93025;
  background-color: #fce8e6;
}

/* Show error message for both cases */
input:user-invalid ~ .error-msg,
input.user-invalid-fallback ~ .error-msg {
  display: block;
}
```

### Fallback Logic
If `:user-invalid` is missing manually track the interaction state using a `WeakMap`.

```javascript
const UserInvalidFallback = (() => {
  const dirtyState = new WeakMap();

  const updateState = (input) => {
    const isValid = input.checkValidity();

    // Update both visual and ARIA state
    input.classList.toggle('user-invalid-fallback', !isValid);
    input.classList.toggle('user-valid-fallback', isValid);

    if (!isValid) {
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
  };

  const handleEvent = (event) => {
    const input = event.target;

    if (event.type === 'reset' && input.matches?.('form')) {
      const controls = input.elements || [];
      for (const control of controls) {
        dirtyState.delete(control);
        control.classList.remove('user-invalid-fallback');
        control.classList.remove('user-valid-fallback');
        control.removeAttribute('aria-invalid');
      }
      return;
    }

    if (!input.matches?.('input, textarea, select')) return;

    if (event.type === 'input' || event.type === 'change') {
      const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
      state.hasInteracted = true;
      dirtyState.set(input, state);
      if (state.hasBlurred) {
        updateState(input);
      }
    } else if (event.type === 'blur') {
      const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
      state.hasBlurred = true;
      dirtyState.set(input, state);
      if (state.hasInteracted) {
        updateState(input);
      }
    }
  };

  const init = () => {
    if (CSS.supports('selector(:user-invalid)')) return;

    document.addEventListener('blur', handleEvent, true); // Capture phase required
    document.addEventListener('input', handleEvent, true);
    document.addEventListener('change', handleEvent, true);
    document.addEventListener('reset', handleEvent, true); // Capture resets
  };

  return { init };
})();

// Initialize globally
UserInvalidFallback.init();
```

## Other Considerations

1.  **`aria-live` vs. `aria-errormessage`**: 
    *   `aria-errormessage` connects the input to the text, but screen readers might not announce it immediately upon appearance (only when focusing the input).
    *   If you need *immediate* announcement when the error appears (e.g., on blur), consider adding `role="alert"` or `aria-live="polite"` to the error message container, but test thoroughly to avoid "double announcement" when the user focuses the field to fix it.

2.  **Internationalization**:
    *   Ensure the text content of your error message (`#email-error`) is translated. The logic remains the same.
