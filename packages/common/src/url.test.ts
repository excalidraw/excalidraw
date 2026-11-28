import { isLocalLink } from "@excalidraw/common";

describe("isLocalLink", () => {
  it("treats same-origin and relative links as local", () => {
    expect(isLocalLink(`${location.origin}/#room=abc,123`)).toBe(true);
    expect(isLocalLink("/#json=abc")).toBe(true);
  });

  it("treats links to other origins as external", () => {
    expect(isLocalLink("https://example.com")).toBe(false);
    // protocol-relative link to another host
    expect(isLocalLink("//example.com")).toBe(false);
    // our origin as a prefix of another host
    expect(isLocalLink(`${location.origin}.example.com`)).toBe(false);
    // our origin inside the query string
    expect(isLocalLink(`https://example.com/?ref=${location.origin}`)).toBe(
      false,
    );
  });

  it("returns false for empty links", () => {
    expect(isLocalLink(null)).toBe(false);
    expect(isLocalLink("")).toBe(false);
  });
});
