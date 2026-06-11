# Select Menu Interaction

## The Problem
For mandatory dropdowns (e.g., "Choose a Country"), standard validation flags the field as invalid immediately if the default option has an empty value. This can create visual noise. We want to show the error only if the user opens the menu and closes it without choosing an option, or attempts to submit the form.

## The Solution
The `:user-invalid` pseudo-class works seamlessly with `<select>` elements. It respects the user's interaction flow: simply loading the page or focusing/blurring without making a change doesn't count as an interaction, so the field stays neutral until they actively attempt a selection.

### Implementation Strategy

1.  **HTML Constraint**: Use a `<select>` with `required`. The first option should have `value=""` and ideally be disabled/hidden to force a valid choice.
2.  **Visual Feedback**: Use `:user-invalid` to style the select box border.
3.  **Timing**: The browser considers the field "interacted" if the user changes the value (even back to the default invalid state) before they blur the control, or upon form submission.

## Implementation Guide

### 1. HTML Structure
The "placeholder" option is key here.

```html
<form>
  <div class="field">
    <label for="country">Country</label>
    <select
      id="country"
      name="country"
      required
      aria-errormessage="country-error"
    >
      <option value="" disabled selected>Select a country...</option>
      <option value="us">United States</option>
      <option value="ca">Canada</option>
      <option value="uk">United Kingdom</option>
    </select>
    <div id="country-error" class="error-msg">
      Please select a country.
    </div>
  </div>
</form>
```

### 2. CSS
```css
.error-msg {
  display: none;
  color: #d93025;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

/*
  Only show error after the user visits the select menu.
*/
select:user-invalid {
  border-color: #d93025;
  background-color: #fce8e6;
}

select:user-invalid + .error-msg {
  display: block;
}

select:user-valid {
  border-color: #188038;
}
```

## Fallbacking & Browser Support

The `:user-invalid` pseudo-class is widely supported (Baseline 2023), but if you need to support older browsers, you must ensure consistency of the implementation.

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

1.  **Mobile behavior**: On mobile devices, "blur" might happen differently depending on the OS picker. Testing on actual devices is recommended.
2.  **Accessibility**: Native `:user-invalid` does not automatically sync with ARIA attributes. Add the following JavaScript to keep `aria-invalid` in sync with the visual state:

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
