import {
  isValidHexColor,
  getHexColorValidationError,
} from "./colorPickerUtils";

describe("Hex Color Validation", () => {
  describe("isValidHexColor", () => {
    it("should return true for valid hex colors", () => {
      expect(isValidHexColor("fff")).toBe(true);
      expect(isValidHexColor("FFF")).toBe(true);
      expect(isValidHexColor("ffffff")).toBe(true);
      expect(isValidHexColor("FFFFFF")).toBe(true);
      expect(isValidHexColor("ffff")).toBe(true);
      expect(isValidHexColor("ffffffff")).toBe(true);
      expect(isValidHexColor("#fff")).toBe(true);
      expect(isValidHexColor("#ffffff")).toBe(true);
      expect(isValidHexColor("123")).toBe(true);
      expect(isValidHexColor("abc123")).toBe(true);
    });

    it("should return false for invalid hex colors", () => {
      expect(isValidHexColor("")).toBe(false);
      expect(isValidHexColor("ff")).toBe(false);
      expect(isValidHexColor("fffff")).toBe(false);
      expect(isValidHexColor("fffffff")).toBe(false);
      expect(isValidHexColor("123456789")).toBe(false);
      expect(isValidHexColor("gggggg")).toBe(false);
      expect(isValidHexColor("zzzzzz")).toBe(false);
      expect(isValidHexColor("blue")).toBe(false);
      expect(isValidHexColor("red")).toBe(false);
    });
  });

  describe("getHexColorValidationError", () => {
    it("should return null for valid hex colors", () => {
      expect(getHexColorValidationError("fff")).toBe(null);
      expect(getHexColorValidationError("ffffff")).toBe(null);
      expect(getHexColorValidationError("ffff")).toBe(null);
      expect(getHexColorValidationError("ffffffff")).toBe(null);
      expect(getHexColorValidationError("#fff")).toBe(null);
      expect(getHexColorValidationError("#ffffff")).toBe(null);
    });

    it("should return null for empty string", () => {
      expect(getHexColorValidationError("")).toBe(null);
    });

    it("should return length error for invalid lengths", () => {
      expect(getHexColorValidationError("f")).toBe(
        "Hex code must be 3, 4, 6, or 8 characters (excluding #)",
      );
      expect(getHexColorValidationError("ff")).toBe(
        "Hex code must be 3, 4, 6, or 8 characters (excluding #)",
      );
      expect(getHexColorValidationError("fffff")).toBe(
        "Hex code must be 3, 4, 6, or 8 characters (excluding #)",
      );
      expect(getHexColorValidationError("fffffff")).toBe(
        "Hex code must be 3, 4, 6, or 8 characters (excluding #)",
      );
      expect(getHexColorValidationError("123456789")).toBe(
        "Hex code must be 3, 4, 6, or 8 characters (excluding #)",
      );
    });

    it("should return character error for invalid characters", () => {
      expect(getHexColorValidationError("gggggg")).toBe(
        "Invalid characters in hex code",
      );
      expect(getHexColorValidationError("zzzzzz")).toBe(
        "Invalid characters in hex code",
      );
      expect(getHexColorValidationError("blue")).toBe(
        "Invalid characters in hex code",
      );
      expect(getHexColorValidationError("red")).toBe(
        "Invalid characters in hex code",
      );
    });
  });
});
