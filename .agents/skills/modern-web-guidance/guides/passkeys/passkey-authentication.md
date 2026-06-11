# Passkey Authentication Guide

This guide details how to implement returning user authentication using discoverable credentials, both through explicit button triggers and seamless browser autofill suggestions (Conditional UI).

## Server-Side

### Options Generation

Create an endpoint that generates WebAuthn request parameters using a vetted library per standards.

1.  **Use the predefined RP ID**: Use the predefined proper RP ID as a constant string.
2.  **Generate challenge**: Generate a high-entropy, cryptographically secure random buffer, store it securely in the user's session, and encode it as Base64URL.
3.  **Discoverable Credentials mapping**: Specify an empty array `[]` for `allowCredentials`. This requests discoverable credentials, meaning the user does not need to enter their username first; the passkey provider will present available accounts.
4.  **User Verification level**: Set `userVerification: "preferred"` (or `"required"` if explicitly mandated by corporate compliance policies).
    - The requested `userVerification` constraint level MUST be persisted inside the server session record at the options endpoint, rather than passed back from the client via query strings. This allows the verification endpoint to enforce strict matching constraints safely without risk of client manipulation.

```javascript
// Options generation example (discoverable flow)
const options = {
  challenge: serverGeneratedBase64UrlChallenge, // High-entropy random challenge stored in session
  rpId: "example.com",
  allowCredentials: [], // Request discoverable passkeys
  userVerification: "preferred",
};

// Persist expected UV level to user session
req.session.expectedUserVerification = "preferred";
```

### Verification Endpoint

Securely verify the assertion returned by the client to authenticate the user:

1.  **Validate session challenge**: Enforce strict challenge matching between the client response and the expected challenge stored in the session.
2.  **Enforce UV Preferences**:
    - Allow UV-less authenticators (e.g., authenticator screen locks disabled) if the session's `expectedUserVerification` requested `"preferred"`, by passing `requireUserVerification: false` to your server-side verification library. If requested `"required"`, enforce biometrics/PIN entry strictly.
3.  **Clean Server Error 404**: If the credential ID returned by the client is not found in the database, return an explicit HTTP `404` error so the client can trigger the Signal API.

## Client-Side Logic

### HTML Form Annotation

Annotate your username and password inputs to natively leverage Conditional UI. Autocomplete tokens combine the webauthn spec parameters, and autofocus triggers the browser autofill popup immediately when the input is focused.

```html
<!-- Autocomplete tokens must contain webauthn space-separated -->
<form id="signin-form">
  <input
    type="text"
    name="username"
    autocomplete="username webauthn"
    autofocus
    data-testid="username-field"
  />
  <input type="password" name="password" autocomplete="current-password" />
  <button type="submit">Sign in</button>
</form>
```

### Explicit Button Flow

Trigger passkey authentication when a user clicks a "Sign in with passkey" button. Abort any ongoing form autofill (Conditional Get) calls before invoking the passkey prompt.

### Conditional Mediation Flow (Form Autofill)

Activate form autofill suggestions on page load to offer passkey authentication natively when users focus on sign-in fields:

1.  **Feature detect**: Call `PublicKeyCredential.getClientCapabilities()` on page load and **skip signing in with passkey** if `conditionalGet` is not available.
2.  **Decode options**: Decode fetched credential JSON object with `PublicKeyCredential.parseRequestOptionsFromJSON()`.
3.  **Invoke Conditional Get**: Call `navigator.credentials.get()` with `mediation: "conditional"` and pass an `AbortController` signal. This registers autofill silently without rendering a passkey dialog.
4.  **Try/Catch Exception Segregation**: Wrap `navigator.credentials.get` call in try/catch block:
    - `NotAllowedError`: The user cancelled or timed out the passkey login prompt.
    - `AbortError`: The authentication request was cancelled programmatically.
5.  **Call Signal API**: Wrap server verification `fetch()` call in a try/catch block:
    - Show an error message for the user to understand what went wrong.
    - Call `signalUnknownCredential()` ONLY when the server explicitly responds with HTTP status `404` (Credential not found) and the user is unauthenticated.
    - The `credentialId` parameter passed to `signalUnknownCredential()` MUST strictly be the Base64URL-encoded credential ID string (e.g., `encoded.id`), NOT the raw ArrayBuffer object `credential.rawId`.
6.  **Encode the response**: Encode the credential `AuthenticatorAssertionResponse` with `.toJSON()` before sending it to the server for verification.

```javascript
// optionsFetch and loginVerifyFetch are app-defined HTTP methods
import { optionsFetch, loginVerifyFetch } from "./api.js";

let autofillAbortController = new AbortController();

async function initializeConditionalAutofill() {
  // Feature detect Conditional Get autofill support
  const capabilities = await PublicKeyCredential.getClientCapabilities();
  if (capabilities.conditionalGet === true) {
    const loginOptionsJSON = await optionsFetch();
    const publicKey =
      PublicKeyCredential.parseRequestOptionsFromJSON(loginOptionsJSON);

    try {
      // Initiate Conditional UI form autofill suggestions
      const credential = await navigator.credentials.get({
        publicKey,
        signal: autofillAbortController.signal,
        mediation: "conditional",
      });

      // Segregated verification fetch
      const encoded = credential.toJSON();
      const response = await loginVerifyFetch(encoded);
      if (!response.ok && response.status === 404) {
        // Note: this code path runs pre-authentication, satisfying the unauth precondition
        if (PublicKeyCredential.signalUnknownCredential) {
          await PublicKeyCredential.signalUnknownCredential({
            rpId, // RP ID must match the one defined on the server
            credentialId: encoded.id,
          });
        }
      }
    } catch (err) {
      // Silently swallow expected client WebAuthn exceptions
      if (["NotAllowedError", "AbortError"].includes(err.name)) {
        return;
      }
      console.error("Unexpected conditional get error:", err);
    }
  }
}

async function triggerButtonAuthentication() {
  // Abort any pending Conditional Get call to prevent passkey prompt collisions
  autofillAbortController.abort();
  autofillAbortController = new AbortController(); // Reset controller for next triggers

  const loginOptionsJSON = await optionsFetch();
  const publicKey =
    PublicKeyCredential.parseRequestOptionsFromJSON(loginOptionsJSON);

  let credential;
  try {
    // Passkey explicit prompt trigger
    credential = await navigator.credentials.get({
      publicKey,
      signal: autofillAbortController.signal,
    });
  } catch (err) {
    if (err.name === "NotAllowedError") {
      console.log("User cancelled passkey login.");
    } else if (err.name === "AbortError") {
      console.log("The authentication operation was aborted.");
    }
    // Re-arm Conditional autofill Suggestions after cancelled explicit button prompts
    initializeConditionalAutofill();
    return; // Safe exit
  }

  // Segregated verification try/catch (HTTP 404 trigger)
  const encoded = credential.toJSON();
  try {
    const response = await loginVerifyFetch(encoded);
    if (!response.ok && response.status === 404) {
      // Note: this code path runs pre-authentication, satisfying the unauth precondition
      await PublicKeyCredential.signalUnknownCredential({
        rpId, // RP ID must match the one defined on the server
        credentialId: encoded.id, // Base64URL-encoded credential ID
      });
    }
  } catch (serverErr) {
    console.error("Verification request error:", serverErr);
  }
}

// Trigger Conditional Get on load
window.addEventListener("DOMContentLoaded", initializeConditionalAutofill);
```

## Fallback Strategies

### Passkey feature detection fallback

Baseline status for the api.PublicKeyCredential.getClientCapabilities_static capability: Newly available. It's been Baseline since 2025-02-06.
Supported by: Chrome 133 (Feb 2025), Edge 133 (Feb 2025), Firefox 135 (Feb 2025), and Safari 17.4 (Mar 2024).

Always install 'webauthn-polyfills' and import it in the context.
Consider as long as  `PublicKeyCredential` is supported, `PublicKeyCredential.getClientCapabilities` is also supported. 

```js 
import 'webauthn-polyfills';
``` 

### Signal API Synchronization Fallback

Web authentication signal methods has limited availability.
Supported by: Chrome 132 (Jan 2025), Edge 132 (Jan 2025), and Safari 26 (Sep 2025).
Unsupported in: Firefox.

The WebAuthn Signal API (`webauthn-signals`) is a progressive optimization used to keep password managers in sync with the server credential state.

- **Fallback Experience**: Gated via `if (PublicKeyCredential.signalUnknownCredential)`. If unsupported, the background verification sync is bypassed gracefully without throwing browser exceptions.

### Easy JSON Serialization Fallback

Baseline status for the api.PublicKeyCredential.parseRequestOptionsFromJSON_static capability: Newly available. It's been Baseline since 2025-03-31.
Supported by: Chrome 129 (Sep 2024), Edge 129 (Sep 2024), Firefox 119 (Oct 2023), and Safari 18.4 (Mar 2025).

Always install 'webauthn-polyfills' and import it in the context.
Consider as long as  `PublicKeyCredential` is supported, `PublicKeyCredential.parseRequestOptionsFromJSON` and `PublicKeyCredential.prototype.toJSON` are also supported. 

```js 
import 'webauthn-polyfills';
``` 
