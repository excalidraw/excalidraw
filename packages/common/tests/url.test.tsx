import { isLocalLink, normalizeLink } from "../src/url";

describe("normalizeLink", () => {
  // NOTE not an extensive XSS test suite, just to check if we're not
  // regressing in sanitization
  it("should sanitize links", () => {
    expect(
      // eslint-disable-next-line no-script-url
      normalizeLink(`javascript://%0aalert(document.domain)`).startsWith(
        // eslint-disable-next-line no-script-url
        `javascript:`,
      ),
    ).toBe(false);
    expect(normalizeLink("ola")).toBe("ola");
    expect(normalizeLink(" ola")).toBe("ola");

    expect(normalizeLink("https://www.excalidraw.com")).toBe(
      "https://www.excalidraw.com",
    );
    expect(normalizeLink("www.excalidraw.com")).toBe("www.excalidraw.com");
    expect(normalizeLink("/ola")).toBe("/ola");
    expect(normalizeLink("http://test")).toBe("http://test");
    expect(normalizeLink("ftp://test")).toBe("ftp://test");
    expect(normalizeLink("file://")).toBe("file://");
    expect(normalizeLink("file://")).toBe("file://");
    expect(normalizeLink("[test](https://test)")).toBe("[test](https://test)");
    expect(normalizeLink("[[test]]")).toBe("[[test]]");
    expect(normalizeLink("<test>")).toBe("<test>");
    expect(normalizeLink("test&")).toBe("test&");
  });
});

describe("isLocalLink", () => {
  it("should identify valid local relative and absolute links", () => {
    expect(isLocalLink("/room/123")).toBe(true);
    expect(isLocalLink("/test")).toBe(true);
    expect(isLocalLink(`${location.origin}/test`)).toBe(true);
    expect(isLocalLink(location.origin)).toBe(true);
  });

  it("should reject external links, protocol-relative links, and spoofing attempts", () => {
    expect(isLocalLink(null)).toBe(false);
    expect(isLocalLink("")).toBe(false);
    expect(isLocalLink("https://google.com")).toBe(false);
    expect(isLocalLink("//attacker.com")).toBe(false);
    expect(isLocalLink("//attacker.com/path")).toBe(false);
    expect(isLocalLink(`${location.origin}.attacker.com`)).toBe(false);
    expect(
      isLocalLink(`https://attacker.com/?redirect=${location.origin}`),
    ).toBe(false);
    expect(isLocalLink(`https://attacker.com/#${location.origin}`)).toBe(false);
    expect(isLocalLink("ola")).toBe(false);
    // eslint-disable-next-line no-script-url
    expect(isLocalLink("javascript:alert(1)")).toBe(false);
  });
});
