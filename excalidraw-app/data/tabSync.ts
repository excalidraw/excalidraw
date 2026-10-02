import { STORAGE_KEYS } from "../app_constants";

// in-memory state (this tab's current state) versions. Currently just
// timestamps of the last time the state was saved to browser storage.
const LOCAL_STATE_VERSIONS = {
  [STORAGE_KEYS.VERSION_DATA_STATE]: -1,
  [STORAGE_KEYS.VERSION_FILES]: -1,
};

type BrowserStateTypes = keyof typeof LOCAL_STATE_VERSIONS;

const getStorageTimestamp = (type: string): number => {
  try {
    const value = localStorage.getItem(type);
    if (value === null) {
      return -1;
    }

    const parsed = JSON.parse(value);

    // Validate it's a finite number
    if (typeof parsed !== "number" || !Number.isFinite(parsed)) {
      console.warn(`Invalid timestamp in localStorage for key: ${type}`);
      return -1;
    }

    return parsed;
  } catch (error) {
    console.error(`Error reading localStorage for key ${type}:`, error);
    // Clear corrupted data
    try {
      localStorage.removeItem(type);
    } catch (e) {
      // Ignore write errors in case storage is read-only
    }
    return -1;
  }
};

export const isBrowserStorageStateNewer = (type: BrowserStateTypes) => {
  const storageTimestamp = getStorageTimestamp(type);
  return storageTimestamp > LOCAL_STATE_VERSIONS[type];
};

export const updateBrowserStateVersion = (type: BrowserStateTypes) => {
  const timestamp = Date.now();
  if (!Number.isFinite(timestamp)) {
    console.error("Attempted to save invalid timestamp");
    return;
  }
  try {
    localStorage.setItem(type, JSON.stringify(timestamp));
    LOCAL_STATE_VERSIONS[type] = timestamp;
  } catch (error) {
    console.error("error while updating browser state verison", error);
  }
};

export const resetBrowserStateVersions = () => {
  try {
    for (const key of Object.keys(
      LOCAL_STATE_VERSIONS,
    ) as BrowserStateTypes[]) {
      const timestamp = -1;
      if (!Number.isFinite(timestamp)) {
        console.error("Attempted to save invalid timestamp");
        continue;
      }
      localStorage.setItem(key, JSON.stringify(timestamp));
      LOCAL_STATE_VERSIONS[key] = timestamp;
    }
  } catch (error) {
    console.error("error while resetting browser state verison", error);
  }
};
