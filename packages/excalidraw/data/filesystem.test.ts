import { isFilesystemPermissionError } from "./filesystem";

describe("isFilesystemPermissionError", () => {
  it("returns true for a NotAllowedError", () => {
    const error = new DOMException("blocked", "NotAllowedError");
    expect(isFilesystemPermissionError(error)).toBe(true);
  });

  it("returns true for a SecurityError", () => {
    const error = new DOMException("blocked", "SecurityError");
    expect(isFilesystemPermissionError(error)).toBe(true);
  });

  it("returns false for an AbortError (user cancelled the picker)", () => {
    const error = new DOMException("cancelled", "AbortError");
    expect(isFilesystemPermissionError(error)).toBe(false);
  });

  it("returns false for a generic Error", () => {
    expect(isFilesystemPermissionError(new Error("boom"))).toBe(false);
  });

  it("returns false for non-error values", () => {
    expect(isFilesystemPermissionError(null)).toBe(false);
    expect(isFilesystemPermissionError(undefined)).toBe(false);
    expect(isFilesystemPermissionError("NotAllowedError")).toBe(false);
  });
});
