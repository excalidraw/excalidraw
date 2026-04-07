import { validateLibraryUrl } from "./library";

describe("validateLibraryUrl", () => {
  it("should validate hostname & pathname", () => {
    // valid hostnames
    // -------------------------------------------------------------------------
    expect(
      validateLibraryUrl("https://www.excalidraw.com", ["excalidraw.com"]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com", ["excalidraw.com"]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://library.excalidraw.com", ["excalidraw.com"]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://library.excalidraw.com", [
        "library.excalidraw.com",
      ]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com/", ["excalidraw.com/"]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com", ["excalidraw.com/"]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com/", ["excalidraw.com"]),
    ).toBe(true);

    // valid pathnames
    // -------------------------------------------------------------------------
    expect(
      validateLibraryUrl("https://excalidraw.com/path", ["excalidraw.com"]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com/path/", ["excalidraw.com"]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com/specific/path", [
        "excalidraw.com/specific/path",
      ]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com/specific/path/", [
        "excalidraw.com/specific/path",
      ]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com/specific/path", [
        "excalidraw.com/specific/path/",
      ]),
    ).toBe(true);
    expect(
      validateLibraryUrl("https://excalidraw.com/specific/path/other", [
        "excalidraw.com/specific/path",
      ]),
    ).toBe(true);

    // invalid hostnames
    // -------------------------------------------------------------------------
    expect(() =>
      validateLibraryUrl("https://xexcalidraw.com", ["excalidraw.com"]),
    ).toThrow();
    expect(() =>
      validateLibraryUrl("https://x-excalidraw.com", ["excalidraw.com"]),
    ).toThrow();
    expect(() =>
      validateLibraryUrl("https://excalidraw.comx", ["excalidraw.com"]),
    ).toThrow();
    expect(() =>
      validateLibraryUrl("https://excalidraw.comx", ["excalidraw.com"]),
    ).toThrow();
    expect(() =>
      validateLibraryUrl("https://excalidraw.com.mx", ["excalidraw.com"]),
    ).toThrow();
    // protocol must be https
    expect(() =>
      validateLibraryUrl("http://excalidraw.com.mx", ["excalidraw.com"]),
    ).toThrow();

    // invalid pathnames
    // -------------------------------------------------------------------------
    expect(() =>
      validateLibraryUrl("https://excalidraw.com/specific/other/path", [
        "excalidraw.com/specific/path",
      ]),
    ).toThrow();
    expect(() =>
      validateLibraryUrl("https://excalidraw.com/specific/paths", [
        "excalidraw.com/specific/path",
      ]),
    ).toThrow();
    expect(() =>
      validateLibraryUrl("https://excalidraw.com/specific/path-s", [
        "excalidraw.com/specific/path",
      ]),
    ).toThrow();
    expect(() =>
      validateLibraryUrl("https://excalidraw.com/some/specific/path", [
        "excalidraw.com/specific/path",
      ]),
    ).toThrow();
  });
});
