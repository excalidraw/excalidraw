import { describe, it, expect } from "vitest";
import { parseEmailValidationError, EMAIL_VALIDATION_MESSAGE } from "./validateEmail";

describe("parseEmailValidationError", () => {
  it("should handle string errors with standard message", () => {
    expect(parseEmailValidationError("Custom error")).toBe(EMAIL_VALIDATION_MESSAGE);
  });

  it("should handle invalid format email errors", () => {
    const error = {
      code: "invalid_format",
      format: "email",
    };
    expect(parseEmailValidationError(error)).toBe(
      "Invalid email address. Please use only basic Latin characters (A-Z, 0-9) and standard symbols."
    );
  });

  it("should handle array of errors", () => {
    const errors = [
      {
        code: "invalid_format",
        format: "email",
      },
    ];
    expect(parseEmailValidationError(errors)).toBe(
      "Invalid email address. Please use only basic Latin characters (A-Z, 0-9) and standard symbols."
    );
  });

  it("should handle invalid JSON", () => {
    expect(parseEmailValidationError("{invalid json}")).toBe(
      "Invalid email address. Please use only basic Latin characters (A-Z, 0-9) and standard symbols."
    );
  });

  it("should handle unknown error formats", () => {
    const error = {
      someOtherField: "value",
    };
    expect(parseEmailValidationError(error)).toBe(
      "Invalid email address. Please use only basic Latin characters (A-Z, 0-9) and standard symbols."
    );
  });
});