import { STORAGE_KEYS } from "../app_constants";
import {
  isBrowserStorageStateNewer,
  updateBrowserStateVersion,
  resetBrowserStateVersions,
} from "../data/tabSync";

describe("tabSync", () => {
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;

  beforeEach(() => {
    localStorage.clear();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it("should initialize and return false when storage is empty", () => {
    expect(isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)).toBe(
      false,
    );
  });

  it("should update state version and store timestamp in localStorage", () => {
    updateBrowserStateVersion(STORAGE_KEYS.VERSION_DATA_STATE);

    const storedValue = localStorage.getItem(STORAGE_KEYS.VERSION_DATA_STATE);
    expect(storedValue).not.toBeNull();

    const timestamp = JSON.parse(storedValue!);
    expect(typeof timestamp).toBe("number");
    expect(Number.isFinite(timestamp)).toBe(true);

    // After updating, local state is same as storage, so it shouldn't be newer
    expect(isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)).toBe(
      false,
    );
  });

  it("should detect if storage state is newer", () => {
    // Set a baseline local version
    updateBrowserStateVersion(STORAGE_KEYS.VERSION_DATA_STATE);

    // Simulate another tab updating the timestamp
    const futureTimestamp = Date.now() + 10000;
    localStorage.setItem(
      STORAGE_KEYS.VERSION_DATA_STATE,
      JSON.stringify(futureTimestamp),
    );

    expect(isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)).toBe(
      true,
    );
  });

  it("should handle malformed JSON gracefully, delete item, and log error", () => {
    localStorage.setItem(STORAGE_KEYS.VERSION_DATA_STATE, "{invalid json");

    expect(isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)).toBe(
      false,
    );
    expect(localStorage.getItem(STORAGE_KEYS.VERSION_DATA_STATE)).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("should handle non-number types in localStorage gracefully and log warning", () => {
    // String in localStorage
    localStorage.setItem(
      STORAGE_KEYS.VERSION_DATA_STATE,
      JSON.stringify("not-a-number"),
    );
    expect(isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)).toBe(
      false,
    );
    expect(consoleWarnSpy).toHaveBeenCalled();

    // Object in localStorage
    localStorage.setItem(
      STORAGE_KEYS.VERSION_DATA_STATE,
      JSON.stringify({ time: 12345 }),
    );
    expect(isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)).toBe(
      false,
    );

    // Array in localStorage
    localStorage.setItem(STORAGE_KEYS.VERSION_DATA_STATE, JSON.stringify([1]));
    expect(isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)).toBe(
      false,
    );

    // Boolean in localStorage
    localStorage.setItem(STORAGE_KEYS.VERSION_DATA_STATE, JSON.stringify(true));
    expect(isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)).toBe(
      false,
    );
  });

  it("should handle invalid numbers (NaN, Infinity) gracefully and log warning", () => {
    const jsonParseSpy = vi.spyOn(JSON, "parse").mockReturnValueOnce(NaN);
    localStorage.setItem(STORAGE_KEYS.VERSION_DATA_STATE, "123");

    expect(isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)).toBe(
      false,
    );
    expect(consoleWarnSpy).toHaveBeenCalled();
    jsonParseSpy.mockRestore();

    const jsonParseSpy2 = vi.spyOn(JSON, "parse").mockReturnValueOnce(Infinity);
    localStorage.setItem(STORAGE_KEYS.VERSION_DATA_STATE, "123");

    expect(isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)).toBe(
      false,
    );
    expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    jsonParseSpy2.mockRestore();
  });

  it("should reset browser state versions properly", () => {
    updateBrowserStateVersion(STORAGE_KEYS.VERSION_DATA_STATE);
    updateBrowserStateVersion(STORAGE_KEYS.VERSION_FILES);

    resetBrowserStateVersions();

    expect(localStorage.getItem(STORAGE_KEYS.VERSION_DATA_STATE)).toBe("-1");
    expect(localStorage.getItem(STORAGE_KEYS.VERSION_FILES)).toBe("-1");

    expect(isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)).toBe(
      false,
    );
    expect(isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_FILES)).toBe(false);
  });
});
