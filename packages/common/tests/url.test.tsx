import { normalizeLink, toValidURL } from "../src/url";

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

describe("toValidURL", () => {
  it("resolves protocol-relative library URLs against the current protocol", () => {
    const url =
      "//libraries.excalidraw.com/library.excalidrawlib?version=2#item";

    expect(toValidURL(url)).toBe(`${location.protocol}${url}`);
  });

  it("preserves absolute and root-relative URLs", () => {
    expect(toValidURL("https://example.com/path?query=1#fragment")).toBe(
      "https://example.com/path?query=1#fragment",
    );
    expect(toValidURL("/path?query=1#fragment")).toBe(
      `${location.origin}/path?query=1#fragment`,
    );
  });

  it("rejects an empty protocol-relative host", () => {
    expect(toValidURL("//")).toBe("about:blank");
  });

  it("continues to sanitize unsafe links and reject invalid URLs", () => {
    // eslint-disable-next-line no-script-url
    expect(toValidURL("javascript:alert(1)")).toBe("about:blank");
    expect(toValidURL("not a URL")).toBe("about:blank");
  });
});
