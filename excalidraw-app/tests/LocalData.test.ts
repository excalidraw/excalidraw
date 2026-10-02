import { isQuotaExceededError } from "../data/LocalData";

describe("isQuotaExceededError", () => {
  it("detects the Chromium QuotaExceededError", () => {
    const error = new DOMException("quota exceeded", "QuotaExceededError");
    expect(isQuotaExceededError(error)).toBe(true);
  });

  it("detects the Firefox NS_ERROR_DOM_QUOTA_REACHED name", () => {
    const error = new DOMException(
      "quota exceeded",
      "NS_ERROR_DOM_QUOTA_REACHED",
    );
    expect(isQuotaExceededError(error)).toBe(true);
  });

  it("detects the legacy WebKit QUOTA_EXCEEDED_ERR name", () => {
    const error = new DOMException("quota exceeded", "QUOTA_EXCEEDED_ERR");
    expect(isQuotaExceededError(error)).toBe(true);
  });

  it("detects legacy WebKit error code 22", () => {
    const error = new DOMException("quota exceeded", "SomeOtherName");
    Object.defineProperty(error, "code", { value: 22 });
    expect(isQuotaExceededError(error)).toBe(true);
  });

  it("detects Firefox error code 1014", () => {
    const error = new DOMException("quota exceeded", "SomeOtherName");
    Object.defineProperty(error, "code", { value: 1014 });
    expect(isQuotaExceededError(error)).toBe(true);
  });

  it("returns false for unrelated DOMExceptions", () => {
    const error = new DOMException("not related", "NotFoundError");
    expect(isQuotaExceededError(error)).toBe(false);
  });

  it("returns false for non-DOMException errors", () => {
    expect(isQuotaExceededError(new Error("boom"))).toBe(false);
    expect(isQuotaExceededError(null)).toBe(false);
    expect(isQuotaExceededError(undefined)).toBe(false);
  });
});
