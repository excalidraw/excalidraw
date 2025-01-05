import { isTransparent, sanitizeHTMLAttribute } from "../utils";

describe("Test isTransparent", () => {
  it("should return true when color is rgb transparent", () => {
    expect(isTransparent("#ff00")).toEqual(true);
    expect(isTransparent("#fff00000")).toEqual(true);
    expect(isTransparent("transparent")).toEqual(true);
  });

  it("should return false when color is not transparent", () => {
    expect(isTransparent("#ced4da")).toEqual(false);
  });
});

describe("sanitizeHTMLAttribute()", () => {
  it("should escape HTML attribute special characters & not double escape", () => {
    expect(sanitizeHTMLAttribute(`&"'><`)).toBe("&amp;&quot;&#39;&gt;&lt;");
  });
});
