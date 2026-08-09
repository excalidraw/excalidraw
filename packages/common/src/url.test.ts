import { isLocalLink } from "./url";

describe("@excalidraw/common/url", () => {
  describe("isLocalLink()", () => {
    const origin = window.location.origin;

    it("treats same-origin absolute links as local", () => {
      expect(isLocalLink(`${origin}/scene/123`)).toBe(true);
      expect(isLocalLink(`${origin}`)).toBe(true);
    });

    it("treats root-relative links as local", () => {
      expect(isLocalLink("/scene/123")).toBe(true);
      expect(isLocalLink("/")).toBe(true);
    });

    it("treats protocol-relative links as external", () => {
      // `//host` starts with a slash but points to another origin.
      expect(isLocalLink("//evil.example/phish")).toBe(false);
    });

    it("does not treat external links that merely contain the origin as local", () => {
      expect(isLocalLink(`https://evil.example/?next=${origin}`)).toBe(false);
      expect(isLocalLink(`https://evil.example/#${origin}`)).toBe(false);
    });

    it("treats plainly external links as external", () => {
      expect(isLocalLink("https://other.example/page")).toBe(false);
    });

    it("handles empty and nullish input", () => {
      expect(isLocalLink(null)).toBe(false);
      expect(isLocalLink("")).toBe(false);
    });
  });
});
