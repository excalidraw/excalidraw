import { isLocalLink, normalizeLink } from "./url";

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
  });
});

describe("isLocalLink", () => {
  const OLD_LOCATION = window.location;
  beforeEach(() => {
    Object.defineProperty(window, "location", {
      value: new URL("https://excalidraw.com/"),
      writable: true,
    });
  });
  afterAll(() => {
    Object.defineProperty(window, "location", {
      value: OLD_LOCATION,
      writable: true,
    });
  });
  it("should return true for local links", () => {
    expect(isLocalLink("./test")).toBe(true);
    expect(isLocalLink("/test")).toBe(true);
    // == ./example.test (relative)
    expect(isLocalLink("example.test")).toBe(true);
    expect(isLocalLink("https://excalidraw.com/test")).toBe(true);
  });
  it("should return false for external links", () => {
    expect(isLocalLink("https://example.test")).toBe(false);
    expect(
      isLocalLink("https://example.test/?url=https://excalidraw.com"),
    ).toBe(false);
    expect(isLocalLink("https://subdomain.excalidraw.com/")).toBe(false);
    expect(isLocalLink(null)).toBe(false);
    // parse error, should return false
    expect(isLocalLink("http:::")).toBe(false);
  });
});
