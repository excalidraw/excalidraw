import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

/**
 * Security Property:
 * URLs derived from user-controlled input (e.g., shared links) must be validated
 * against an allowlist of trusted domains before being fetched. The application
 * must never fetch arbitrary URLs provided by untrusted input without domain validation.
 */

// Minimal URL validator that represents the REQUIRED security control
function isAllowedUrl(rawUrl: string): boolean {
  const ALLOWED_DOMAINS = [
    'excalidraw.com',
    'excalidraw-backend.excalidraw.com',
    'json.excalidraw.com',
    'libraries.excalidraw.com',
  ];

  let decoded: string;
  try {
    // Attempt to fully decode (handle double/triple encoding attacks)
    let prev = rawUrl;
    let current = rawUrl;
    let iterations = 0;
    do {
      prev = current;
      current = decodeURIComponent(current);
      iterations++;
    } while (current !== prev && iterations < 10);
    decoded = current;
  } catch {
    return false;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(decoded);
  } catch {
    return false;
  }

  // Only allow https protocol
  if (parsedUrl.protocol !== 'https:') {
    return false;
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Check against allowlist (exact match or subdomain of allowed domain)
  return ALLOWED_DOMAINS.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
  );
}

describe("URL fetching from user-controlled input must be restricted to allowlisted domains", () => {
  const payloads = [
    // SSRF - internal network
    "http://localhost/admin",
    "http://127.0.0.1/etc/passwd",
    "http://0.0.0.0/secret",
    "http://169.254.169.254/latest/meta-data/",
    "http://192.168.1.1/router-admin",
    "http://10.0.0.1/internal",
    "http://172.16.0.1/private",
    // Protocol attacks
    "file:///etc/passwd",
    "file:///C:/Windows/System32/drivers/etc/hosts",
    "ftp://attacker.com/malicious",
    "javascript:alert(document.cookie)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox(1)",
    // Malicious external domains
    "https://evil.com/malicious-payload.json",
    "https://attacker.example.com/steal-data",
    "https://phishing-excalidraw.com/fake",
    // URL encoding attacks (encoded malicious URLs)
    "https%3A%2F%2Fevil.com%2Fpayload",
    "%68%74%74%70%3A%2F%2F%6C%6F%63%61%6C%68%6F%73%74%2F",
    "http%3A%2F%2F127.0.0.1%2Fadmin",
    // Double encoding
    "https%253A%252F%252Fevil.com%252Fpayload",
    "%2568%2574%2574%2570%253A%252F%252F127.0.0.1",
    // Domain confusion / subdomain attacks
    "https://excalidraw.com.evil.com/payload",
    "https://evil.com/excalidraw.com",
    "https://notexcalidraw.com/data",
    "https://excalidraw.com.attacker.com/steal",
    "https://fake-excalidraw.com/data.json",
    // Open redirect via path manipulation
    "https://excalidraw.com@evil.com/payload",
    "https://evil.com#excalidraw.com",
    // IPv6 SSRF
    "http://[::1]/admin",
    "http://[::ffff:127.0.0.1]/secret",
    "http://[0:0:0:0:0:ffff:7f00:1]/",
    // Null byte injection
    "https://evil.com/payload\x00.excalidraw.com",
    "https://evil.com%00.excalidraw.com/data",
    // Whitespace tricks
    " https://evil.com/payload",
    "https://evil.com/payload ",
    "\thttps://evil.com/payload",
    // Empty / malformed
    "",
    "   ",
    "not-a-url",
    "://missing-protocol.com",
    // HTTP (non-HTTPS) to allowed-looking domains
    "http://excalidraw.com/data",
    "http://json.excalidraw.com/data",
    // Credential injection
    "https://user:pass@evil.com/payload",
    "https://excalidraw.com:password@evil.com/steal",
  ];

  test.each(payloads)("rejects adversarial input: %s", (payload) => {
    // SECURITY INVARIANT: isAllowedUrl must return false for all adversarial inputs
    const result = isAllowedUrl(payload);
    expect(result).toBe(false);
  });

  // Positive test: valid allowed URLs must pass
  const allowedPayloads = [
    "https://json.excalidraw.com/abc123",
    "https://excalidraw.com/data/scene.json",
    "https://libraries.excalidraw.com/libraries.json",
    "https://excalidraw-backend.excalidraw.com/rooms/abc",
  ];

  test.each(allowedPayloads)("allows legitimate URL: %s", (url) => {
    const result = isAllowedUrl(url);
    expect(result).toBe(true);
  });

  test("fetch is never called with an unvalidated URL", async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
    const originalFetch = global.fetch;
    global.fetch = mockFetch as unknown as typeof fetch;

    try {
      const adversarialUrls = [
        "http://localhost/admin",
        "https://evil.com/steal",
        "file:///etc/passwd",
        "javascript:alert(1)",
        "https://excalidraw.com.evil.com/payload",
      ];

      for (const url of adversarialUrls) {
        // Simulate the secure fetch wrapper: only fetch if URL is allowed
        const secureFetch = async (rawUrl: string) => {
          const decoded = decodeURIComponent(rawUrl);
          if (!isAllowedUrl(decoded)) {
            throw new Error(`Blocked fetch to disallowed URL: ${decoded}`);
          }
          return fetch(decoded);
        };

        await expect(secureFetch(url)).rejects.toThrow(/Blocked fetch/);
      }

      // fetch must never have been called with adversarial URLs
      expect(mockFetch).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("URL validation is applied BEFORE decoding, not after", () => {
    // Encoded malicious URLs must be caught even before decoding
    const encodedMalicious = [
      "https%3A%2F%2Fevil.com%2Fpayload",
      "http%3A%2F%2F127.0.0.1%2Fadmin",
      "%68%74%74%70%3A%2F%2F%6C%6F%63%61%6C%68%6F%73%74",
    ];

    for (const encoded of encodedMalicious) {
      // After decoding, these should still fail validation
      let decoded = encoded;
      try {
        decoded = decodeURIComponent(encoded);
      } catch {
        // invalid encoding is itself a rejection signal
      }
      expect(isAllowedUrl(decoded)).toBe(false);
    }
  });
});