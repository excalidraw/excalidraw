import { validateHexColor } from "./hexValidation";

describe("validateHexColor", () => {
  it("should accept valid hex colors", () => {
    // 3-character hex
    expect(validateHexColor("abc")).toEqual({
      isValid: true,
      normalizedValue: "#abc",
    });

    // 4-character hex (with alpha)
    expect(validateHexColor("abcd")).toEqual({
      isValid: true,
      normalizedValue: "#abcd",
    });

    // 6-character hex
    expect(validateHexColor("abcdef")).toEqual({
      isValid: true,
      normalizedValue: "#abcdef",
    });

    // 8-character hex (with alpha)
    expect(validateHexColor("abcdef12")).toEqual({
      isValid: true,
      normalizedValue: "#abcdef12",
    });

    // With # prefix
    expect(validateHexColor("#abc")).toEqual({
      isValid: true,
      normalizedValue: "#abc",
    });

    // Uppercase letters
    expect(validateHexColor("ABCDEF")).toEqual({
      isValid: true,
      normalizedValue: "#abcdef",
    });
  });

  it("should reject invalid lengths", () => {
    // Too short
    expect(validateHexColor("a")).toEqual({
      isValid: false,
      errorKey: "colorPicker.hexCodeLength",
    });

    expect(validateHexColor("ab")).toEqual({
      isValid: false,
      errorKey: "colorPicker.hexCodeLength",
    });

    // Invalid lengths
    expect(validateHexColor("abcde")).toEqual({
      isValid: false,
      errorKey: "colorPicker.hexCodeLength",
    });

    expect(validateHexColor("abcdefg")).toEqual({
      isValid: false,
      errorKey: "colorPicker.hexCodeLength",
    });

    // Too long
    expect(validateHexColor("123456789")).toEqual({
      isValid: false,
      errorKey: "colorPicker.hexCodeLength",
    });
  });

  it("should reject invalid characters", () => {
    expect(validateHexColor("zzzzzz")).toEqual({
      isValid: false,
      errorKey: "colorPicker.hexCodeCharacters",
    });

    expect(validateHexColor("blue")).toEqual({
      isValid: false,
      errorKey: "colorPicker.hexCodeCharacters",
    });

    expect(validateHexColor("12345g")).toEqual({
      isValid: false,
      errorKey: "colorPicker.hexCodeCharacters",
    });

    expect(validateHexColor("abc!")).toEqual({
      isValid: false,
      errorKey: "colorPicker.hexCodeCharacters",
    });
  });

  it("should handle empty input", () => {
    expect(validateHexColor("")).toEqual({
      isValid: true,
    });

    expect(validateHexColor("   ")).toEqual({
      isValid: true,
    });
  });

  it("should handle whitespace", () => {
    expect(validateHexColor("  abc  ")).toEqual({
      isValid: true,
      normalizedValue: "#abc",
    });
  });
});
