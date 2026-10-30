import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { useHandleLibrary, validateLibraryUrl } from "./library";

import type { ExcalidrawImperativeAPI } from "../types";

describe("useHandleLibrary", () => {
  it("imports a protocol-relative library URL from the library host", async () => {
    const libraryUrl = "//libraries.excalidraw.com/library.excalidrawlib";
    const originalUrl = window.location.href;
    const blob = new Blob(["library"]);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      blob: async () => blob,
    } as Response);
    const updateLibrary = vi.fn(async () => []);
    const excalidrawAPI = {
      id: "editor",
      updateLibrary,
    } as unknown as ExcalidrawImperativeAPI;

    window.history.replaceState(
      {},
      "",
      `#addLibrary=${encodeURIComponent(libraryUrl)}&token=editor`,
    );
    const { unmount } = renderHook(() => useHandleLibrary({ excalidrawAPI }));

    try {
      await waitFor(() => expect(updateLibrary).toHaveBeenCalledTimes(1));
      const { libraryItems } = vi.mocked(excalidrawAPI.updateLibrary).mock
        .calls[0][0];
      await expect(libraryItems).resolves.toBe(blob);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        `${location.protocol}${libraryUrl}`,
      );
    } finally {
      unmount();
      fetchSpy.mockRestore();
      window.history.replaceState({}, "", originalUrl);
    }
  });
});

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
