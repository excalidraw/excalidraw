The Declarative API transforms standard HTML `<form>` elements into WebMCP tools via attributes. The browser synthesizes a JSON Schema from the form inputs and handles agent interactions.

## Form Attributes

*   `toolname`: Unique name for the tool.
*   `tooldescription`: Purpose of the tool.
*   `toolautosubmit`: (Optional) If present, the agent can submit the form without waiting for user interaction. 
*   `toolparamdescription`: (Optional) Provides a way to define a property description within the JSON Schema.
    *   **Resolution Order**: The browser uses `toolparamdescription` if present. In its absence, it uses the `textContent` of the associated `<label>` (skipping labelable descendants). If no label exists, it falls back to the `aria-description`.
    *   **Grouping (Fieldsets)**: To attach a description to a group of related elements (like `<input type="radio">` buttons), place `toolparamdescription` on the nearest parent `<fieldset>` element so it applies to the parameter group as a whole.

### Example

```html
<form toolname="search-cars" 
      tooldescription="Perform a car make/model search" 
      toolautosubmit>
  <label for="make">Vehicle Make</label>
  <input type="text" id="make" name="make" required>
  
  <label for="model">Vehicle Model</label>
  <input type="text" id="model" name="model" toolparamdescription="e.g., 330i, F-150" required>
  
  <button type="submit">Search</button>
</form>
```

## Handling Submissions in JavaScript

When an agent submits the form, the `SubmitEvent` includes `agentInvoked` (boolean) and `respondWith(promise)`.

```javascript
document.querySelector('form').addEventListener('submit', (event) => {
  event.preventDefault();

  // Validate the form
  const formValidationErrors = myFormIsValid();

  if (formValidationErrors.length > 0) {
    if (event.agentInvoked) {
      const errorString =
        'Validation failed: ' +
        formValidationErrors
          .map((err) => `${err.field} (${err.message})`)
          .join(', ');

      event.respondWith(Promise.resolve(errorString));
    }
    return;
  }

  const resultPromise = performAsyncSearch(new FormData(event.target));

  // Return the result directly to the agent without navigation
  if (event.agentInvoked) {
    event.respondWith(resultPromise);
  }
});
```

## Lifecycle Events

The window emits events when agents start or stop interacting with a tool:

```javascript
window.addEventListener('toolactivated', ({ toolName }) => {
  console.log(`Tool "${toolName}" was activated by the agent.`);
});

window.addEventListener('toolcancel', ({ toolName }) => {
  console.log(`Tool "${toolName}" interaction was cancelled.`);
});
```

## Visual Feedback (CSS)

Use pseudo-classes to highlight forms when an agent interacts with them:

*   `:tool-form-active`: Applied to the `<form>` element actively used by the agent.
*   `:tool-submit-active`: Applied to the submit button when the browser pauses for user review (if `toolautosubmit` is omitted).

```css
form:tool-form-active {
  outline: 2px dashed blue;
  background-color: rgba(0, 0, 255, 0.05);
}

button:tool-submit-active {
  outline: 2px dashed red;
  animation: pulse 2s infinite;
}
```

## Form Suitability (When to Avoid)

The Declarative API is best for self-contained, standard forms. It is a poor choice in these scenarios:

* **Highly Dependent Fields**: Forms where inputs change options or visibility based on other inputs. The synthesized schema cannot express these dependencies well.
* **Custom UI Components**: Forms relying on non-standard inputs (e.g., canvas, rich text editors) that don't auto-serialize values.
* **Multi-Step Wizards**: Complex workflows requiring multiple form submissions. The Imperative API or standard DOM interaction is better suited here.

## When to use toolautosubmit
* **Read-Only Operations & Queries**: Searches, filters, fetching details, or checking status (e.g., a car model search, searching a directory, checking stock availability).
* **Low-Risk, Reversible Actions**: Form actions that can easily be undone or refined by the user manually (e.g., adding items to a cart, applying a coupon code, saving a draft, or setting temporary layout options).

## When to omit toolautosubmit
* **Destructive or Irreversible Actions**: Deleting records, resetting system configurations, or clearing databases.
* **Financial & Transactional Actions**: Submitting a checkout form, transferring funds, authorizing subscription payments, or final order placements.
* **High-Impact User Communication**: Submitting a final job application, sending emails/messages to other real users, or publishing public-facing content.
* **Sensitive Account Settings**: Changing passwords, modifying user roles/permissions, or updating billing/profile info.

## Fallback strategies

Form-associated WebMCP attributes is not natively supported by any major browser yet.

The WebMCP Declarative API is safe to use in all browsers. Browsers that do not support WebMCP will ignore the `tool*` attributes, and the `<form>` will continue to function as a normal HTML form. No feature detection is required.
