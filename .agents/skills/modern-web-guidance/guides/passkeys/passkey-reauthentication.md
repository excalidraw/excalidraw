# Passkey Reauthentication Guide

This delta-focused guide details how to implement step-up authentication or re-verification for a signed-in user before they perform sensitive account changes (e.g. passwords updates, financial transfers).

## Delta Flow Architecture

Unlike regular authentication, passkey reauthentication constrains passkey dialog prompts strictly to the logged-in user's pre-registered credentials to prevent account-mixing or passkey spoofing during active sessions.

## Server-Side

### Options Generation Delta

Create an endpoint that populates the allowed credentials parameters specifically for the active, known user:

**Constrain Credentials**: Populate the `allowCredentials` options array with specific `PublicKeyCredentialDescriptor` records mapping all registered credential IDs for the signed-in user. Leaving this empty or omitting it regresses to discoverable credentials, violating session safety.

```javascript
// Node.js step-up options generation example
router.post("/api/reauth/options", enforceActiveSession, async (req, res) => {
  const userPasskeys = await db.findCredentialsByUserId(req.user.id);

  const options = {
    challenge: serverGeneratedBase64UrlChallenge, // Random challenge stored in user session
    rpId: "example.com",
    // Enforce allowance strictly limited to the user's credentials list
    allowCredentials: userPasskeys.map((cred) => ({
      type: "public-key",
      id: cred.id,
      transports: cred.transports, // Speeds up resolution by indicating platform transports
    })),
  };
  return res.json(options);
});
```

### Verification Endpoint Delta

Verify the assertion returned by the client:

**Verify Account Ownership**: The verification endpoint MUST explicitly verify that the resulting authenticated credential ID returned by the client resolves to a stored credential record whose associated user ID strictly matches the active signed-in user (`storedCredential.passkeyUserId === req.user.id`). If a valid passkey of a _different_ user is returned, authentication MUST be rejected immediately.

## Client-Side Flow Deltas

Applications choose from two reauthentication interfaces depending on the transaction UI:

### A. Button Flow (No Input Fields)

Trigger reauthentication when a user presses a "Verify Identity" or "Proceed with Transaction" button.

```html
<button id="reauth-btn" data-testid="reauth-button">Confirm Transaction</button>
```

```javascript
let reauthAbortController = new AbortController();

async function triggerButtonReauth() {
  // Abort any background suggestion flows to avoid passkey prompt collisions
  reauthAbortController.abort();
  reauthAbortController = new AbortController();

  const optionsResponse = await fetch("/api/reauth/options", {
    method: "POST",
  });
  const optionsJSON = await optionsResponse.json();
  const publicKey =
    PublicKeyCredential.parseRequestOptionsFromJSON(optionsJSON);

  try {
    const credential = await navigator.credentials.get({
      publicKey,
      signal: reauthAbortController.signal,
    });

    if (credential) {
      const encodedCredential = credential.toJSON();
      const verifyResponse = await fetch("/api/reauth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(encodedCredential),
      });

      if (verifyResponse.ok) {
        showTransactionSuccessUI();
      } else if (verifyResponse.status === 404 && PublicKeyCredential.signalUnknownCredential) {
        await PublicKeyCredential.signalUnknownCredential({
          rpId, // RP ID must match the one defined on the server
          credentialId: encodedCredential.id
        });
      }
    }
  } catch (err) {
    if (err.name === "NotAllowedError") {
      console.log("User cancelled reauthentication.");
    }
  }
}

document
  .getElementById("reauth-btn")
  .addEventListener("click", triggerButtonReauth);
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

### Easy JSON Serialization Fallback

Baseline status for the api.PublicKeyCredential.parseRequestOptionsFromJSON_static capability: Newly available. It's been Baseline since 2025-03-31.
Supported by: Chrome 129 (Sep 2024), Edge 129 (Sep 2024), Firefox 119 (Oct 2023), and Safari 18.4 (Mar 2025).

Always install 'webauthn-polyfills' and import it in the context.
Consider as long as  `PublicKeyCredential` is supported, `PublicKeyCredential.parseRequestOptionsFromJSON` and `PublicKeyCredential.prototype.toJSON` are also supported. 

```js 
import 'webauthn-polyfills';
``` 
