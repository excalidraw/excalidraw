import { getHexColorInputError } from "../components/ColorPicker/colorPickerUtils";

describe("getHexColorInputError", () => {
  it("returns null for empty input", () => {
    expect(getHexColorInputError("")).toBe(null);
    expect(getHexColorInputError("   ")).toBe(null);
  });

  it("returns null for valid hex lengths", () => {
    expect(getHexColorInputError("abc")).toBe(null);
    expect(getHexColorInputError("abcd")).toBe(null);
    expect(getHexColorInputError("ff0000")).toBe(null);
    expect(getHexColorInputError("#ff000080")).toBe(null);
  });

  it("returns invalidLength for wrong digit counts from issue #9527", () => {
    expect(getHexColorInputError("1")).toBe("invalidLength");
    expect(getHexColorInputError("12")).toBe("invalidLength");
    expect(getHexColorInputError("12345")).toBe("invalidLength");
    expect(getHexColorInputError("1234567")).toBe("invalidLength");
    expect(getHexColorInputError("123456789")).toBe("invalidLength");
  });

  it("returns invalidCharacters for non-hex input", () => {
    expect(getHexColorInputError("zzzzzz")).toBe("invalidCharacters");
    expect(getHexColorInputError("blue")).toBe("invalidCharacters");
    expect(getHexColorInputError("12g456")).toBe("invalidCharacters");
  });
});
