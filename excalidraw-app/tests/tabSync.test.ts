import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import { STORAGE_KEYS } from "../app_constants";
import {
  isBrowserStorageStateNewer,
  updateBrowserStateVersion,
  resetBrowserStateVersions,
} from "../data/tabSync";

describe("tabSync", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("should update storage and detect newer state correctly", () => {
    const now = Date.now();
    localStorage.setItem(STORAGE_KEYS.VERSION_DATA_STATE, JSON.stringify(now));

    expect(isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)).toBe(
      true,
    );

    updateBrowserStateVersion(STORAGE_KEYS.VERSION_DATA_STATE);
    expect(isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)).toBe(
      false,
    );
  });

  it("should handle missing keys (null/empty) in localStorage safely", () => {
    expect(isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)).toBe(
      false,
    );
  });

  it("should handle and clean up malformed JSON in localStorage", () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    localStorage.setItem(STORAGE_KEYS.VERSION_DATA_STATE, "{broken json");

    expect(isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)).toBe(
      false,
    );
    expect(localStorage.getItem(STORAGE_KEYS.VERSION_DATA_STATE)).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("should handle incorrect/invalid types in localStorage", () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    localStorage.setItem(
      STORAGE_KEYS.VERSION_DATA_STATE,
      JSON.stringify("not-a-number"),
    );
    expect(isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)).toBe(
      false,
    );
    expect(consoleWarnSpy).toHaveBeenCalled();

    localStorage.setItem(
      STORAGE_KEYS.VERSION_DATA_STATE,
      JSON.stringify({ version: 123 }),
    );
    expect(isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)).toBe(
      false,
    );

    localStorage.setItem(
      STORAGE_KEYS.VERSION_DATA_STATE,
      JSON.stringify(Infinity),
    );
    expect(isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)).toBe(
      false,
    );

    localStorage.setItem(STORAGE_KEYS.VERSION_DATA_STATE, JSON.stringify(NaN));
    expect(isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)).toBe(
      false,
    );
  });

  it("should handle write operations successfully", () => {
    resetBrowserStateVersions();
    expect(localStorage.getItem(STORAGE_KEYS.VERSION_DATA_STATE)).toBe("-1");
    expect(localStorage.getItem(STORAGE_KEYS.VERSION_FILES)).toBe("-1");
  });
});
