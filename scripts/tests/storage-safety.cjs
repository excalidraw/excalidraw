const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadTypeScript } = require("./load-typescript.cjs");

const setup = () => {
  const values = new Map();
  let failure = null;
  let discardKey = null;
  let versions = 0;
  const storage = {
    setItem: (key, value) => {
      if (failure) {
        throw failure;
      }
      if (key !== discardKey) {
        values.set(key, value);
      }
    },
    getItem: (key) => values.get(key) ?? null,
  };
  const store = {
    get: (atom) => atom.value,
    set: (atom, value) => {
      atom.value = value;
    },
  };
  const keys = {
    LOCAL_STORAGE_ELEMENTS: "elements",
    LOCAL_STORAGE_APP_STATE: "appState",
    VERSION_DATA_STATE: "version",
  };
  const module = loadTypeScript(
    "excalidraw-app/data/LocalData.ts",
    {
      "@excalidraw/excalidraw/appState": {
        clearAppStateForLocalStorage: (state) => ({ ...state }),
      },
      "@excalidraw/common": {
        DEFAULT_SIDEBAR: { name: "default" },
        CANVAS_SEARCH_TAB: "search",
        debounce: (fn) => {
          let args;
          const debounced = (...input) => {
            args = input;
          };
          debounced.flush = () => {
            if (args) {
              const input = args;
              args = null;
              return fn(...input);
            }
          };
          return debounced;
        },
      },
      "@excalidraw/element": {
        getNonDeletedElements: (elements) =>
          elements.filter((el) => !el.isDeleted),
      },
      "idb-keyval": { createStore: () => ({}) },
      "../app-jotai": { appJotaiStore: store, atom: (value) => ({ value }) },
      "../app_constants": { STORAGE_KEYS: keys },
      "./FileManager": {
        FileManager: class {
          saveFiles = async () => {};
        },
      },
      "./fileStatusStore": { FileStatusStore: { updateStatuses() {} } },
      "./Locker": {
        Locker: class {
          isLocked = () => false;
        },
      },
      "./tabSync": {
        updateBrowserStateVersion: () => {
          versions++;
        },
      },
    },
    {
      localStorage: storage,
      document: { hidden: false },
      console: { error() {} },
    },
  );
  return {
    values,
    fail: (error) => {
      failure = error;
    },
    discard: (key) => {
      discardKey = key;
    },
    versions: () => versions,
    errored: () => store.get(module.localStorageSaveErrorAtom),
    quotaExceeded: () => store.get(module.localStorageQuotaExceededAtom),
    save: () => {
      module.LocalData.save(
        [{ id: "kept" }, { id: "deleted", isDeleted: true }],
        { theme: "light" },
        {},
        () => {},
      );
      module.LocalData.flushSave();
    },
  };
};

test("verified saves exclude deleted elements and publish the new version", () => {
  const s = setup();
  s.save();
  assert.equal(s.errored(), false);
  assert.equal(s.versions(), 1);
  assert.deepEqual(JSON.parse(s.values.get("elements")), [{ id: "kept" }]);
});

for (const name of [
  "QuotaExceededError",
  "NS_ERROR_DOM_QUOTA_REACHED",
  "SecurityError",
]) {
  test(`${name} marks the drawing unsaved without announcing a version`, () => {
    const s = setup();
    s.fail({ name });
    s.save();
    assert.equal(s.errored(), true);
    assert.equal(s.quotaExceeded(), name !== "SecurityError");
    assert.equal(s.versions(), 0);
  });
}

for (const key of ["elements", "appState"]) {
  test(`silently discarded ${key} writes are detected`, () => {
    const s = setup();
    s.discard(key);
    s.save();
    assert.equal(s.errored(), true);
    assert.equal(s.versions(), 0);
  });
}

test("warnings clear only after a verified recovery", () => {
  const s = setup();
  s.fail({ name: "QuotaExceededError" });
  s.save();
  assert.equal(s.errored(), true);
  s.fail(null);
  s.save();
  assert.equal(s.errored(), false);
  assert.equal(s.quotaExceeded(), false);
  assert.equal(s.versions(), 1);
});

test("a failed save preserves the last stored drawing", () => {
  const s = setup();
  s.values.set("elements", '[{"id":"previous"}]');
  s.fail({ name: "QuotaExceededError" });
  s.save();
  assert.equal(s.values.get("elements"), '[{"id":"previous"}]');
  assert.equal(s.errored(), true);
});
