import { describe, expect, it } from "vitest";

import { isAllowedOrigin, normalizeEmail } from "./_shared";

describe("telemetry _shared", () => {
  it("allows tfdraw.dev and pages preview hosts", () => {
    expect(isAllowedOrigin("https://tfdraw.dev")).toBe(true);
    expect(isAllowedOrigin("https://abc.pages.dev")).toBe(true);
    expect(isAllowedOrigin("https://evil.example")).toBe(false);
  });

  it("normalizes valid emails", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
    expect(normalizeEmail("not-an-email")).toBeNull();
  });
});
