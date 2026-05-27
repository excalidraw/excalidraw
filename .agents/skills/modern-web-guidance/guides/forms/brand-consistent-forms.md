# Brand-Consistent Forms

Customizing standard HTML form elements like checkboxes and radio buttons has historically been difficult. Developers often faced a choice between using the browser defaults or building custom components from scratch. Building custom controls is time-consuming and can easily lead to accessibility issues or missing states (like the indeterminate state for checkboxes).

The CSS property `accent-color` provides a simple way to bring your brand color to built-in HTML form inputs with a single line of CSS, without sacrificing accessibility or built-in browser features.

## How to Implement

To apply your brand color to form controls:

1. **Identify your brand color:** Choose a color that represents your brand.
2. **Apply the `accent-color` property:** Add `accent-color` to the element or a container element (like `body` or a specific form) in your CSS.
3. **Support Dark Mode (Optional but Recommended):** Use `color-scheme` to let the browser know your site supports dark mode, and adjust the `accent-color` if necessary for better contrast.

## Example Code: Brand-Consistent Form Controls

```css
:root {
  --brand-color: #6200ee;
}

/* Apply accent-color to the body or a specific container */
body {
  accent-color: var(--brand-color);
}

/* Optional: Adjust for dark mode if needed */
@media (prefers-color-scheme: dark) {
  :root {
    --brand-color: #bb86fc; /* A lighter shade for dark mode */
  }
}
```

```html
<form>
  <!-- Checkbox -->
  <label for="subscribe">
    <input type="checkbox" id="subscribe" checked>
    Subscribe to newsletter
  </label>

  <!-- Radio Buttons -->
  <label for="plan-monthly">
    <input type="radio" id="plan-monthly" name="plan" value="monthly">
    Monthly
  </label>
  <label for="plan-yearly">
    <input type="radio" id="plan-yearly" name="plan" value="yearly" checked>
    Yearly
  </label>

  <!-- Range Slider -->
  <label for="volume">Volume:</label>
  <input type="range" id="volume" min="0" max="100" value="70">

  <!-- Progress Bar -->
  <label for="file">Upload Progress:</label>
  <progress id="file" max="100" value="70">70%</progress>
</form>
```

## Strategic Implementation & Best Practices

- **DO** use `accent-color` to easily theme form controls to match your brand.
- **DO NOT** blindly trust the browser to handle contrast. While browsers are supposed to automatically determine an eligible contrast color, known bugs in implementations like **Safari** (WebKit bug 244233) and **Android Chrome** (Chromium bug 343503163) can fail to invert checkmark colors, leading to invisible or hard-to-see controls when using colors that lack sufficient contrast against the background (e.g., light colors in light mode, or dark colors in dark mode).
- **DO** combine `accent-color` with `color-scheme: light dark` to ensure form controls look good in both light and dark themes.
- **DO NOT** use a color that is too close to the background color, even though browsers try to guarantee contrast, it's best to provide a color with good base contrast.
- **DO NOT** assume `accent-color` works on all form elements. Currently, it only tints `checkbox`, `radio`, `range`, and `progress` elements.

## Fallback Strategy

accent-color has limited availability.
Supported by: Chrome 93 (Aug 2021), Edge 93 (Sep 2021), and Firefox 92 (Sep 2021).
Unsupported in: Safari.

For browsers that do not support `accent-color`, the form controls fall back to the browser's default appearance. To ensure full brand consistency and high reliability across all environments, you MUST implement a custom fallback strategy using the established "visually hidden input" technique.

### Progressive Enhancement with `@supports not`

You MUST use the `@supports not` rule to apply custom fallback styles only when `accent-color` is not supported. This ensures you leverage the simplicity of `accent-color` for modern browsers while guaranteeing a consistent branded experience for older ones.

#### 1. HTML Structure
Ensure your labels wrap the text in a `<span>` to allow for sibling selectors in CSS:
```html
<label for="subscribe-fallback">
  <input type="checkbox" id="subscribe-fallback" class="visually-hidden" checked>
  <span>Subscribe to newsletter</span>
</label>
```

#### 2. CSS Fallback
Apply custom styles within a `@supports not` block:
```css
/* Fallback for older browsers without accent-color */
@supports not (accent-color: var(--brand-color)) {
  /* Visually hide the native input using the canonical accessible recipe */
  form input[type="checkbox"].visually-hidden {
    position: absolute !important;
    clip-path: inset(50%) !important;
    overflow: hidden !important;
    width: 1px !important;
    height: 1px !important;
    margin: -1px !important;
    padding: 0 !important;
    border: 0 !important;
    white-space: nowrap !important;
  }

  /* Style the wrapper label */
  label {
    position: relative;
    padding-left: 2rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
  }

  /* Custom box for checkbox */
  input[type="checkbox"] + span::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 1.2rem;
    height: 1.2rem;
    border: 2px solid #ccc;
    background: white;
    border-radius: 4px;
    box-sizing: border-box;
    transition: all 0.2s ease;
  }

  /* Ensure custom checkbox shows focus for keyboard users */
  input[type="checkbox"]:focus-visible + span::before {
    outline: 2px solid #000;
    outline-offset: 2px;
  }

  /* Checked State */
  input[type="checkbox"]:checked + span::before {
    background-color: var(--brand-color, #6200ee);
    border-color: var(--brand-color, #6200ee);
  }

  /* Checkmark (Unicode) */
  input[type="checkbox"]:checked + span::after {
    content: "✓";
    position: absolute;
    left: 0.25rem;
    top: 50%;
    transform: translateY(-50%);
    color: white;
    font-weight: bold;
    font-size: 0.9rem;
  }

  /* Fallback for Range Slider */
  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
  }

  /* Webkit (Chrome, Safari, Edge) */
  input[type="range"]::-webkit-slider-runnable-track {
    width: 100%;
    height: 8px;
    /* Use gradient to show progress for a static value (e.g., 70%) or update with JS */
    background: linear-gradient(to right, var(--brand-color, #6200ee) 70%, #ccc 70%);
    border-radius: 4px;
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    height: 16px;
    width: 16px;
    border-radius: 50%;
    background: var(--brand-color, #6200ee);
    cursor: pointer;
    margin-top: -4px; /* Center vertically */
  }

  /* Firefox */
  input[type="range"]::-moz-range-track {
    width: 100%;
    height: 8px;
    background: #ccc;
    border-radius: 4px;
  }

  input[type="range"]::-moz-range-thumb {
    height: 16px;
    width: 16px;
    border-radius: 50%;
    background: var(--brand-color, #6200ee);
    cursor: pointer;
  }

  /* Firefox specific progress bar */
  input[type="range"]::-moz-range-progress {
    background-color: var(--brand-color, #6200ee);
    height: 8px;
    border-radius: 4px;
  }

  /* Fallback for Progress Bar */
  progress {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    border: none;
    background: #ccc;
    height: 8px;
    border-radius: 4px;
  }

  progress::-webkit-progress-bar {
    background-color: #ccc;
    border-radius: 4px;
  }

  progress::-webkit-progress-value {
    background-color: var(--brand-color, #6200ee);
    border-radius: 4px;
  }

  progress::-moz-progress-bar {
    background-color: var(--brand-color, #6200ee);
    border-radius: 4px;
  }
}
```

### Dynamic Range Progress in Webkit Fallback

To make the progress fill move with the thumb on a range slider in Webkit browsers (without `accent-color`), you can use a CSS variable and a small amount of JavaScript.

1. **Update CSS**: Use a CSS variable for the gradient stop:
```css
input[type="range"]::-webkit-slider-runnable-track {
  background: linear-gradient(to right, var(--brand-color) var(--progress, 0%), #ccc var(--progress, 0%));
}
```

2. **Add JavaScript**: Update the variable on the `input` event:
```javascript
if (!CSS.supports('accent-color')) {
  const slider = document.getElementById('volume');
  slider.addEventListener('input', (e) => {
    e.target.style.setProperty('--progress', `${e.target.value}%`);
  });
}
```
