# Web Privacy Guidelines for Developers

Web application developers must treat privacy as a foundational architectural requirement, not just a legal compliance checkbox. As the web ecosystem shifts away from passive tracking toward explicit, user-consented interactions, building privacy-preserving applications is critical for user trust and security.

This document provides high-level principles and detailed, actionable guidelines with code examples for web developers.

## High-Level Overview

These core themes should guide your approach to privacy in web development:

1.  **Automation Asymmetry & Privacy Labor**: Do not offload the burden of protecting privacy to the user (privacy labor). Avoid overwhelming users with complex consent dialogs (automation asymmetry). Users have limited time and attention; offloading privacy choices to them is often ineffective and causes fatigue. Systems should be privacy-protective by default.
2.  **Data Minimization**: "If you don't have the data, you can't lose it." Collect only the bare minimum required for the immediate task. Reducing data storage reduces the risk of breach and builds user trust.
3.  **Purpose Limitation**: Data collected for one purpose must not be used for another without fresh consent. Repurposing data without explicit agreement violates the trust relationship with the user.
4.  **Transparency by Default**: Be honest and clear about why data is collected, where it goes, and how long it is kept. Transparency builds trust and can be a unique selling point for your application.
5.  **Trustworthy Agency**: Treat your application as an agent acting in the user's best interest. This means protecting them from intrusive behaviors, unnecessary data exposure, and acting as a loyal fiduciary to the user rather than serving third-party interests.

## Detailed Guidelines

### 1. Data Minimization and Purpose Limitation

Reducing the amount of data collected and strictly limiting its use is the most effective way to protect user privacy.

#### DOs:
*   **DO** collect data at the lowest granularity necessary. If you only need to know if a user is in a certain age bracket (e.g., 18-34), ask for the bracket, not the exact date of birth.
*   **DO** provide guest checkout options for e-commerce to avoid forced account creation, which reduces data collection and cart abandonment.
*   **DO** delete data as soon as the purpose for its collection has been fulfilled.
*   **DO** use techniques like "fuzzing" or adding noise to data (Differential Privacy) when gathering aggregate statistics.

#### DON'Ts:
*   **DON'T** collect data speculatively "just in case" it might be useful in the future.
*   **DON'T** reuse data collected for one purpose (e.g., security verification) for another (e.g., marketing) without explicit user consent.

#### Code Examples:

**Fuzzing Data Collection (HTML/JS)**
Instead of asking for exact age:
```html
<label for="age-bracket">Age Bracket:</label>
<select id="age-bracket" name="age-bracket">
  <option value="18-34">18-34</option>
  <option value="35-49">35-49</option>
  <option value="50+">50+</option>
</select>
```

### 2. Transparency and Trust

Build trust by being open about your data practices and providing easy ways for users to control their data.

#### DOs:
*   **DO** provide inline explanations for why data is requested. Place the explanation directly next to the input field.
*   **DO** provide a clear reason and context *before* requesting powerful browser permissions (e.g., camera, location).
*   **DO** consider using the **Page Embedded Permission Control (PEPC)** `<permission>` element, if supported, to make permission requests declarative, user-initiated, and act as data mediators.
*   **DO** use the `Clear-Site-Data` header when a user logs out to ensure no lingering data remains in the browser.
*   **DO** make it as easy to opt-out or delete an account as it was to sign up.

#### DON'Ts:
*   **DON'T** bury data collection explanations in long, complex privacy policies.
*   **DON'T** use deceptive patterns (dark patterns) to trick users into giving consent.

#### Code Examples:

**Inline Transparency (HTML)**
```html
<div>
  <label for="phone">Phone Number (Optional)</label>
  <input id="phone" type="tel" name="phone">
  <a href="#phone-help">Why do we ask for this?</a>
  <aside id="phone-help">
    We only use your phone number to send two-factor authentication codes for account security.
  </aside>
</div>
```

**Clear-Site-Data on Logout (HTTP Response)**
```http
HTTP/1.1 200 OK
Clear-Site-Data: "*"
```
*Note: If clearing the cache, avoid sending this on the main navigation page to prevent blocking UI rendering on slow devices; trigger it via a subresource.*

**Page Embedded Permission Control (HTML)**
```html
<!-- Declarative permission element with fallback -->
<permission type="geolocation" onpromptdismiss="updateMap()">
  <!-- Fallback for unsupported browsers -->
  <button onclick="navigator.geolocation.getCurrentPosition(updateMap)">
    Use my location
  </button>
</permission>
```

### 3. Security and Data Handling for Privacy
 
Privacy relies on a foundation of secure coding. Vulnerabilities in the application or insecure storage directly lead to privacy violations.
 
#### DOs:
*   **DO** scrub Personally Identifiable Information (PII) from application logs. Use automated masking for emails, tokens, and IDs.
*   **DO** use `HttpOnly` flags for cookies storing session identifiers to prevent other scripts from accessing them.
*   **DO** implement rate limiting on sensitive endpoints (e.g., user search or profile views) to prevent bulk data scraping.
*   **DO** use **CHIPS (Cookies Having Independent Partitioned State)** by appending the `Partitioned` attribute for 1:1 embeds that do not share state across top-level sites.
 
#### DON'Ts:
*   **DON'T** store sensitive tokens or PII in `localStorage`, as it is accessible by any embedded script.
*   **DON'T** rely on unpartitioned `SameSite=None` cookies.
 
#### Code Examples:
 
**Secure Session Cookie (HTTP)**
```http
Set-Cookie: session_id=xyz123; Secure; HttpOnly; SameSite=Lax
```

**CHIPS Cookie (HTTP)**
```http
Set-Cookie: theme_pref=dark; SameSite=None; Secure; Path=/; Partitioned; HttpOnly
```

### 4. Third-Party Audits and Mitigations

Third-party scripts and resources are a common source of privacy leaks. You are responsible for the third parties you bring into your application.

#### DOs:
*   **DO** conduct regular technical audits of network requests using DevTools or HAR files to identify what data third parties are collecting.
*   **DO** use the **Façade Pattern** for heavy embeds (like YouTube or TikTok). Display a static thumbnail and load the interactive iframe only after the user clicks.
*   **DO** use privacy-preserving options for embeds when available (e.g., `youtube-nocookie.com`).
*   **DO** replace heavy social sharing SDKs with simple, static HTML links that do not track users.
*   **DO** use the **Federated Credential Management API (FedCM)** to mediate "Sign-In" flows natively, preventing IdP tracking of Relying Parties prior to user consent.

#### DON'Ts:
*   **DON'T** assume a third party is privacy-safe just because it is popular.
*   **DON'T** load third-party scripts on pages where sensitive data (like checkout or health info) is handled unless strictly necessary.

#### Code Examples:

**Privacy-Preserving Social Sharing (HTML)**
```html
<!-- No JS SDK required -->
<a href="https://x.com/intent/tweet?text=Check%20this%20out&url=https%3A%2F%2Fexample.com" 
   rel="noopener" target="_blank">
   Share on X
</a>
```

**Video Façade Pattern (HTML/JS)**
```html
<div id="video-container" data-video-id="abc123">
  <img src="https://img.youtube.com/vi/abc123/maxresdefault.jpg" alt="Play Video" id="play-btn">
</div>

<script>
document.getElementById('play-btn').addEventListener('click', function() {
  const container = document.getElementById('video-container');
  const videoId = container.dataset.videoId;
  container.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1" allowfullscreen></iframe>`;
});
</script>
```

**FedCM Sign-In (JavaScript)**
```javascript
try {
  const credential = await navigator.credentials.get({
    identity: {
      providers: [{
        configURL: "https://idp.example/fedcm.json",
        clientId: "rp-client-id-123",
        nonce: "a_secure_random_nonce_value"
      }]
    }
  });
  authenticateWithBackend(credential.token);
} catch (error) {
  // Handle FedCM login failure
}
```

### 5. Privacy-Preserving Headers

Use standard HTTP headers to instruct the browser to enforce privacy boundaries.

#### DOs:
*   **DO** use `Permissions-Policy` to disable powerful features (like camera, microphone, geolocation) by default, enabling them only where required.
*   **DO** set a strict `Referrer-Policy` to prevent leaking sensitive URL parameters to third parties.

#### Code Examples:

**Strict Referrer Policy (HTTP)**
```http
Referrer-Policy: strict-origin-when-cross-origin
```

**Defensive Permissions Policy (HTTP)**
Disables powerful features for all origins by default.
```http
Permissions-Policy: geolocation=(), camera=(), microphone=(), accelerometer=()
```

### 6. Fingerprinting and User-Agent Reduction

Avoid techniques that attempt to uniquely identify users covertly based on their device configuration. Fingerprinting takes away user control because it relies on unchanging characteristics and happens invisibly, preventing users from opting out or clearing their identifier.

#### DOs:
*   **DO** use **Feature Detection** instead of User-Agent sniffing to determine if a browser supports a capability.
*   **DO** use **User-Agent Client Hints** (UA-CH) if supported by the browser, when specific device targeting is required.

#### DON'Ts:
*   **DON'T** use canvas rendering, font lists, or audio/video device enumerations to build a device fingerprint.
*   **DON'T** rely on the full granularity of the traditional `navigator.userAgent` string.

#### Code Examples:

**Feature Detection (JavaScript)**
```javascript
// GOOD: Check if the API exists
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(...);
} else {
  // Fallback
}

// BAD: Sniffing UA
// if (navigator.userAgent.includes("Chrome/100")) ...
```

**User-Agent Client Hints (JavaScript)**
```javascript
if (navigator.userAgentData) {
  navigator.userAgentData.getHighEntropyValues(["platformVersion", "architecture"])
    .then(ua => {
      console.log(ua.platformVersion);
    });
}
```

### 7. Data Rights and User Control

Empower users to exercise their rights over their personal data.

#### DOs:
*   **DO** provide clear mechanisms for users to **access** all data you have collected about them.
*   **DO** implement automated or easy manual flows for **data deletion** (erasure).
*   **DO** allow users to correct inaccurate information associated with their identity.

#### DON'Ts:
*   **DON'T** make the deletion process difficult or require users to contact support if sign-up was automated.
*   **DON'T** retaliate against users who exercise their data rights by denying access to non-dependent services.
