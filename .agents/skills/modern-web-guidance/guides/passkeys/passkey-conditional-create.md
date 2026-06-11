# Passkey Conditional Create (Post-Login Promotion)

This guide details how to automatically and silently register a passkey for a user immediately after a successful password-based sign-in, minimizing friction and boosting passkey adoption.

## The Right Trigger Moment

Automatic passkey creation (also known as Conditional Create or silent post-login promotion) MUST only be triggered **immediately after a successful, full sign-in that involved a password**. 
* Do not attempt conditional creation for passwordless flows (e.g., magic links, SMS OTP, or identity federation).
* If multi-factor authentication is required, you MUST wait until all factors have succeeded before initiating conditional creation.
* Ensure a valid, authenticated user session is active before making requests to creation endpoints.

## Implementation Steps

### 1. Abort Prior Autofill Actions
If the sign-in page utilizes form autofill (Conditional UI/Get), the active credential get call must be aborted to prevent browser conflicts.
* Call `abortController.abort()` on the `AbortController` attached to the pending `navigator.credentials.get()` autofill request before calling `navigator.credentials.create()`.

### 2. Feature Detection
Determine whether Conditional Create is available by checking `conditionalCreate` with `PublicKeyCredential.getClientCapabilities()`.

```javascript
const capabilities = await PublicKeyCredential.getClientCapabilities();
if (capabilities.conditionalCreate) {
  // Conditional create is available
}
```

### 3. Create a passkey with Conditional Create
* Pass `mediation: 'conditional'` within the `navigator.credentials.create()` options. This signals the browser to handle the passkey creation flow silently in the background or contextually without throwing obtrusive modal dialogs.
* Populate `excludeCredentials` with the user's existing passkey credential IDs to avoid registering duplicate keys.

### 4. Silent Error Handling
* Wrap the passkey creation prompt (`navigator.credentials.create`) in a try/catch block. You MUST catch and silently ignore typical user-facing exceptions (`InvalidStateError`, `NotAllowedError`, `AbortError`) without rendering any error UI to the user.

### 5. Server-Side User Presence Verification
* The server-side verification endpoint MUST relax the User Presence (UP) requirement (`requireUserPresence: false`) **ONLY** when verifying credentials produced by a conditional-create trigger. Strict presence verification must remain active for standard explicit creations.

### 6. Handle Failed Server Verification gracefully
* If `navigator.credentials.create()` succeeds but the server verification fetch returns a bad response (e.g., signature verification fails), invoke `PublicKeyCredential.signalUnknownCredential()` to prevent orphaned credentials from lingering in the passkey provider.

## Code Example

```javascript
// optionsFetch and registerVerifyFetch are app-defined server endpoint requests
import { optionsFetch, registerVerifyFetch } from './api.js';

async function triggerConditionalCreate(loginAbortController) {
  const capabilities = await PublicKeyCredential.getClientCapabilities();
  if (capabilities.conditionalCreate !== true) {
    return; // Platform does not support conditional creation
  }

  // 1. Abort any active autofill conditional-get controllers to clear the WebAuthn pipeline
  loginAbortController.abort();

  // 2. Fetch creation options signaling the backend that this is a conditional request
  const creationOptionsJSON = await optionsFetch({ conditional: true });
  const publicKey = PublicKeyCredential.parseCreationOptionsFromJSON(creationOptionsJSON);

  let credential;
  try {
    // 3. Invoke silent credentials creation prompt
    credential = await navigator.credentials.create({ 
      publicKey,
      mediation: 'conditional' // Silent background creation mediation
    });
  } catch (e) {
    // 4. Silently swallow common WebAuthn browser exceptions
    if (['InvalidStateError', 'NotAllowedError', 'AbortError'].includes(e.name)) {
      return; 
    }
    console.error('Unexpected conditional create error:', e);
    return;
  }

  // 5. Server verification step using dedicated Try/Catch block
  let encodedResponse = credential.toJSON();
  try {
    const response = await registerVerifyFetch(encodedResponse);
    if (!response.ok) {
      // If the server verification fails, clean up using Signal API
      if (PublicKeyCredential.signalUnknownCredential) {
        await PublicKeyCredential.signalUnknownCredential({
          rpId, // RP ID must match the one defined on the server
          credentialId: encodedResponse.id
        });
      }
    }
  } catch (serverErr) {
    console.error('Verification network failure:', serverErr);
    if (PublicKeyCredential.signalUnknownCredential) {
      await PublicKeyCredential.signalUnknownCredential({
        rpId, // RP ID must match the one defined on the server
        credentialId: encodedResponse.id
      });
    }
  }
}
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
*   **Fallback Experience**: Gated via `if (PublicKeyCredential.signalUnknownCredential)`. If unsupported, the background verification sync is bypassed gracefully without throwing browser exceptions.

### Easy JSON Serialization Fallback

Baseline status for the api.PublicKeyCredential.parseCreationOptionsFromJSON_static capability: Newly available. It's been Baseline since 2025-03-31.
Supported by: Chrome 129 (Sep 2024), Edge 129 (Sep 2024), Firefox 119 (Oct 2023), and Safari 18.4 (Mar 2025).

Always install 'webauthn-polyfills' and import it in the context.
Consider as long as  `PublicKeyCredential` is supported, `PublicKeyCredential.parseCreationOptionsFromJSON` and `PublicKeyCredential.prototype.toJSON` are also supported. 

```js 
import 'webauthn-polyfills';
``` 
