import { expect, it, describe } from "vitest";

import { validateHexColor } from "./ColorInput";

describe("should validate the validateHexColor function", () => {
  it("should validate length of hex color code", () => {
    expect(validateHexColor("123456789")).toBe(false);
    expect(validateHexColor("123")).toBe(true);
    expect(validateHexColor("1")).toBe(false);
  });

  it("should validate whether the color is alphanumeric", () => {
    expect(validateHexColor("13afg")).toBe(false);
    expect(validateHexColor("13f")).toBe(true);
    expect(validateHexColor("fff")).toBe(true);
  });

  it("should validate every {ith character} <= {f} ", () => {
    expect(validateHexColor("blue")).toBe(false);
    expect(validateHexColor("zzzzzz")).toBe(false);
    expect(validateHexColor("123fff")).toBe(true);
  });
});
