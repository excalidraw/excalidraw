# Validate Input After Interaction

## The Problem

Displaying validation errors the moment a user focuses on a field and starts typing is premature and distracting. For example, as a user types an email address (e.g., "user@gm") or a password with complex requirements, the field is technically invalid until completion. Standard `:invalid` styling results in an error state appearing immediately, frustrating the user.

## The Solution

The `:user-invalid` pseudo-class allows you to defer the error state until the user has "committed" to a value (by blurring the field) or attempted to submit the form. This ensures validation feedback is provided only after the user has finished interacting with the field.

### Implementation Strategy

1.  **HTML Constraint**: DO use standard HTML5 attributes like `type="email"`, `pattern`, and `required` to trigger the browser's built-in validation logic.
2.  **Visual Feedback**: DO use `:user-invalid` to apply error styling only after interaction.
3.  **Positive Reinforcement**: DO optionally use `:user-valid` to give a green "success" indicator once the requirements are met.
4.  **Graceful Recovery**: As soon as the user corrects the input to a valid format, `:user-invalid` stops matching, removing the error state immediately.

## Implementation Guide

### Use Case 1: Email Validation

MANDATORY: Rely on standard HTML5 attributes for email fields. The error message is hidden by default and only revealed when the browser determines the user has left the field in an invalid state.

```html
<form>
  <div class="field">
    <label for="email">Email Address</label>
    <!-- MANDATORY: Place format hints above the input so autocomplete popovers don't cover them during editing -->
    <span id="email-hint" class="hint">Format: you@example.com</span>
    <!-- DO: Use standard HTML validation attributes like type="email" and required -->
    <input
      type="email"
      id="email"
      name="email"
      required
      autocomplete="email"
      aria-describedby="email-hint"
      aria-errormessage="email-error"
    >
    <div id="email-error" class="error-msg">
      <span aria-hidden="true">❌</span> Please enter a valid email address.
    </div>
  </div>
</form>
```

```css
.hint {
  display: block;
  color: #5f6368;
  font-size: 0.85rem;
  margin-bottom: 0.25rem;
}

.error-msg {
  display: none;
  color: #d93025;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

/*
  DO: Only show error styles after user interaction.
  Use multiple indicators (border/background shift + icon/text) to avoid color-only states.
*/
input:user-invalid {
  border-color: #d93025;
  background-color: #fce8e6;
}

/* DO: Reveal the error message using the adjacent sibling selector */
input:user-invalid + .error-msg {
  display: block;
}

/* DO: Provide a clear success indication on :user-valid */
input:user-valid {
  border-color: #188038;
}
```

### Use Case 2: Password Complexity

MANDATORY: Define the complexity rule using a Regex Lookahead pattern in the `pattern` attribute. The rules list is shown above the input to guide the user, and highlighted if there's an error.

```html
<form>
  <div class="field">
    <label for="password">New Password</label>
    <!-- MANDATORY: Place hints and rules above the input so mobile keyboards do not obscure them -->
    <ul id="password-rules" class="rules-list">
      <li>At least 8 characters</li>
      <li>One uppercase letter</li>
      <li>One number</li>
      <li>One special character</li>
    </ul>
    <!-- DO: Use pattern and minlength for complex password validation
         DO: Match all constraints with lookaheads via pattern attribute
     -->
    <input
      type="password"
      id="password"
      autocomplete="new-password"
      required
      pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,}"
      minlength="8"
      aria-describedby="password-rules"
    >
  </div>
</form>
```

```css
/* DO: State the default styling as neutral */
.rules-list { 
  color: #5f6368; 
  margin-bottom: 0.5rem;
}

/* DO: Show invalid state (After interaction): Error */
input:user-invalid {
  border-color: #d93025;
  background-color: #fce8e6;
}

/* DO: Highlight rules list when error is shown using the modern :has() selector */
.field:has(input:user-invalid) .rules-list {
  color: #d93025;
  font-weight: 600;
}

/* DO: Add success indications for :user-valid state */
input:user-valid {
  border-color: #188038;
}

/* DO: Hide rules once satisfied */
.field:has(input:user-valid) .rules-list {
  display: none;
}
```

## Fallbacking & Browser Support

### Fallbacks & browser support for :user-valid and :user-invalid

Baseline status for :user-valid and :user-invalid: Widely available. It's been Baseline since 2023-11-02.
Supported by: Chrome 119 (Oct 2023), Edge 119 (Nov 2023), Firefox 88 (Apr 2021), and Safari 16.5 (May 2023).

### CSS for Fallback

```css
input:user-invalid,
input.user-invalid-fallback {
  border-color: #d93025;
  background-color: #fce8e6;
}

input:user-invalid + .error-msg,
input.user-invalid-fallback + .error-msg {
  display: block;
}
```

### JavaScript Fallback

Use a reusable utility that tracks interaction state using a `WeakMap`. This avoids polluting the DOM with "dirty" classes or data attributes.

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

    if (event.type === 'reset') {
      const controls = input.elements || [];
      for (const control of controls) {
        dirtyState.delete(control);
        control.classList.remove('user-invalid-fallback');
        control.classList.remove('user-valid-fallback');
        control.removeAttribute('aria-invalid');
      }
      return;
    }

    if (!input.checkValidity) return;

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

  const init = (root = document) => {
    if (CSS.supports('selector(:user-invalid)')) return;

    root.addEventListener('blur', handleEvent, true); // Capture phase
    root.addEventListener('input', handleEvent);
    root.addEventListener('change', handleEvent);
    root.addEventListener('reset', handleEvent, true); // Capture resets
  };

  return { init };
})();

// Initialize for a specific form
const form = document.querySelector('#demo-form');
UserInvalidFallback.init(form);
```

## Other Considerations

1.  **Accessibility**:
    *   MANDATORY: Use `aria-describedby` to link the rules list to the input.
    *   DO NOT: Hide rules lists entirely until the input is valid; users need to know what to type!
2.  **Pattern Attribute Limits**: MANDATORY: The `pattern` attribute performs a full match (implied `^...$`). Ensure your password regex accounts for the entire string.
3.  **Validation Strictness**: DO note that the browser's default `type="email"` validation is quite permissive (e.g., `user@localserver` might pass). If you need stricter validation, you may need to use a more robust validation library or a custom validation function alongside `type="email"`.
4.  **Focus Management**: MANDATORY: If a user submits the form with an invalid field, the browser will automatically focus the first invalid field. Your `:user-invalid` styles will apply immediately because a submission attempt counts as an interaction.
5. **Consistent ARIA Experience**: Native `:user-invalid` does not automatically sync with ARIA attributes. Add the following JavaScript to keep `aria-invalid` in sync with the visual state:

```javascript
// Sync aria-invalid with the CSS :user-invalid state
const syncAria = (el) => {
  el.setAttribute?.('aria-invalid', el.matches(':user-invalid') ? 'true' : 'false');
};

// Update on blur (to show error) and input (to clear it)
document.addEventListener('blur', (e) => syncAria(e.target), true);
document.addEventListener('input', (e) => {
  if (e.target.hasAttribute('aria-invalid')) syncAria(e.target);
});
```
