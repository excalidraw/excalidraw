import fs from "fs";
import path from "path";
import vm from "vm";

import { act, renderHook } from "@testing-library/react";

import { getThemeFromSearch } from "../appTheme";
import { useHandleAppTheme } from "../useHandleAppTheme";

const storageKey = "excalidraw-theme";
const initialThemeScript = fs
  .readFileSync(path.resolve(__dirname, "../index.html"), "utf8")
  .match(/<script>([\s\S]*?)<\/script>/)![1];

describe("theme URL parameter", () => {
  const originalMatchMedia = window.matchMedia;
  let changeListener: ((event: { matches: boolean }) => void) | undefined;

  beforeEach(() => {
    localStorage.removeItem(storageKey);
    window.history.replaceState(null, "", "/");
    document.documentElement.classList.remove("dark");
    changeListener = undefined;
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: (_: string, listener: typeof changeListener) => {
        changeListener = listener;
      },
      removeEventListener: vi.fn(),
    }));
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    localStorage.removeItem(storageKey);
    window.history.replaceState(null, "", "/");
    document.documentElement.classList.remove("dark");
  });

  it.each([
    ["?theme=dark", "dark"],
    ["?theme=light", "light"],
    ["?other=value&theme=dark", "dark"],
    ["", undefined],
    ["?theme=system", undefined],
    ["?theme=invalid", undefined],
    ["?theme=", undefined],
  ])("parses only supported URL themes: %s", (search, expected) => {
    expect(getThemeFromSearch(search)).toBe(expected);
  });

  it.each([
    ["dark", "light"],
    ["light", "dark"],
  ] as const)(
    "starts in URL theme %s without overwriting saved %s",
    (urlTheme, savedTheme) => {
      localStorage.setItem(storageKey, savedTheme);
      const { result } = renderHook(() => useHandleAppTheme(urlTheme));
      expect(result.current.appTheme).toBe(urlTheme);
      expect(result.current.editorTheme).toBe(urlTheme);
      expect(localStorage.getItem(storageKey)).toBe(savedTheme);
    },
  );

  it("keeps URL-only theme out of storage and saves a later explicit choice", () => {
    const { result } = renderHook(() => useHandleAppTheme("dark"));
    expect(localStorage.getItem(storageKey)).toBeNull();
    act(() => result.current.setAppTheme("light"));
    expect(result.current.editorTheme).toBe("light");
    expect(localStorage.getItem(storageKey)).toBe("light");
  });

  it("uses light when neither the URL nor storage supplies a theme", () => {
    const { result } = renderHook(() => useHandleAppTheme());
    expect(result.current.editorTheme).toBe("light");
  });

  it("falls back to the stored preference for an invalid URL value", () => {
    localStorage.setItem(storageKey, "dark");
    const { result } = renderHook(() =>
      useHandleAppTheme(getThemeFromSearch("?theme=invalid")),
    );
    expect(result.current.editorTheme).toBe("dark");
  });

  it("keeps system preference updates working without an override", () => {
    localStorage.setItem(storageKey, "system");
    const { result } = renderHook(() => useHandleAppTheme());
    expect(result.current.editorTheme).toBe("dark");
    act(() => changeListener?.({ matches: false }));
    expect(result.current.editorTheme).toBe("light");
    expect(localStorage.getItem(storageKey)).toBe("system");
  });

  it("does not subscribe to system changes while the URL theme is active", () => {
    localStorage.setItem(storageKey, "system");
    const { result } = renderHook(() => useHandleAppTheme("light"));
    expect(result.current.editorTheme).toBe("light");
    expect(changeListener).toBeUndefined();
    expect(localStorage.getItem(storageKey)).toBe("system");
    act(() => result.current.setAppTheme("system"));
    expect(result.current.editorTheme).toBe("dark");
    expect(changeListener).toBeDefined();
  });

  it.each([
    ["?theme=dark", "light", true],
    ["?theme=light", "dark", false],
    ["?theme=invalid", "dark", true],
    ["", "system", true],
    ["", "light", false],
  ])(
    "applies the same theme before React loads (%s, saved %s)",
    (search, savedTheme, dark) => {
      window.history.replaceState(null, "", `/${search}#room=test,key`);
      localStorage.setItem(storageKey, savedTheme as string);
      // Execute the actual early bootstrap script to catch drift from the hook.
      vm.runInNewContext(initialThemeScript, {
        document,
        window,
        URLSearchParams,
        console,
      });
      expect(document.documentElement.classList.contains("dark")).toBe(dark);
      expect(localStorage.getItem(storageKey)).toBe(savedTheme);
      expect(window.location.hash).toBe("#room=test,key");
    },
  );
});
