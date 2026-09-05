import { isQuotaExceededError } from "../data/LocalData";

describe("Test isQuotaExceededError", () => {
  it("should return true for the Chromium spelling", () => {
    const error = new DOMException("quota exceeded", "QuotaExceededError");

    expect(isQuotaExceededError(error)).toBe(true);
  });

  it("should return true for the Firefox spelling", () => {
    const error = new DOMException(
      "quota exceeded",
      "NS_ERROR_DOM_QUOTA_REACHED",
    );

    expect(isQuotaExceededError(error)).toBe(true);
  });

  it("should return true for the legacy WebKit code 22", () => {
    const error = new DOMException("quota exceeded", "SomeUnknownError");
    // jsdom's DOMException doesn't set `code` from an unrecognized name,
    // so we assert the legacy numeric code path explicitly too
    Object.defineProperty(error, "code", { value: 22 });

    expect(isQuotaExceededError(error)).toBe(true);
  });

  it("should return true for the legacy WebKit code 1014", () => {
    const error = new DOMException("quota exceeded", "SomeUnknownError");
    // jsdom's DOMException doesn't set `code` from an unrecognized name,
    // so we assert the legacy numeric code path explicitly too
    Object.defineProperty(error, "code", { value: 1014 });

    expect(isQuotaExceededError(error)).toBe(true);
  });

  it("should return false for a non-quota DOMException", () => {
    const error = new DOMException("not found", "NotFoundError");

    expect(isQuotaExceededError(error)).toBe(false);
  });

  it("should return false for a non-DOMException error", () => {
    const error = new Error("some other error");

    expect(isQuotaExceededError(error)).toBe(false);
  });
});
