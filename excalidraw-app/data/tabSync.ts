import type { STORAGE_KEYS } from "../app_constants";

type BrowserStateTypes =
  | typeof STORAGE_KEYS.VERSION_DATA_STATE
  | typeof STORAGE_KEYS.VERSION_FILES;

const getBrowserStorageStateVersion = (type: BrowserStateTypes): number => {
  try {
    const value = JSON.parse(localStorage.getItem(type) || "-1");
    return typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= -1
      ? value
      : -1;
  } catch {
    return -1;
  }
};

export const updateBrowserStateVersion = (type: BrowserStateTypes) => {
  try {
    const timestamp = Math.max(
      Date.now(),
      getBrowserStorageStateVersion(type) + 1,
    );
    localStorage.setItem(type, JSON.stringify(timestamp));
  } catch (error) {
    console.error("error while updating browser state verison", error);
  }
};
