import { STORAGE_KEYS } from "../app_constants";

// in-memory state (this tab's current state) versions. Currently just
// timestamps of the last time the state was saved to browser storage.
const LOCAL_STATE_VERSIONS = {
  [STORAGE_KEYS.VERSION_DATA_STATE]: -1,
  [STORAGE_KEYS.VERSION_FILES]: -1,
};

type BrowserStateTypes = keyof typeof LOCAL_STATE_VERSIONS;

const getBrowserStorageStateVersion = (type: BrowserStateTypes): number =>
  JSON.parse(localStorage.getItem(type) || "-1");

export const isBrowserStorageStateNewer = (type: BrowserStateTypes) => {
  return getBrowserStorageStateVersion(type) > LOCAL_STATE_VERSIONS[type];
};

/** marks this tab's state as up to date with the current browser storage */
export const syncBrowserStateVersion = (type: BrowserStateTypes) => {
  LOCAL_STATE_VERSIONS[type] = getBrowserStorageStateVersion(type);
};

export const updateBrowserStateVersion = (type: BrowserStateTypes) => {
  const timestamp = Date.now();
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
      localStorage.setItem(key, JSON.stringify(timestamp));
      LOCAL_STATE_VERSIONS[key] = timestamp;
    }
  } catch (error) {
    console.error("error while resetting browser state verison", error);
  }
};
