import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppState } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../app_constants";
import { appJotaiStore } from "../app-jotai";
import { DocumentStore } from "../data/DocumentStore";
import { LocalData } from "../data/LocalData";
import {
  activateTab,
  clearLegacyLocalStorageDocument,
  createBlankTab,
  ensureTabsReady,
  getNextDefaultTabName,
  loadActiveTabId,
  loadTabsMetadata,
  migrateLegacyDocumentIfNeeded,
  resetTabsBootstrapForTests,
  saveActiveTabId,
  saveTabsMetadata,
} from "../data/tabsStore";
import { activeTabIdAtom } from "../tabs-atoms";

describe("tabsStore", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    resetTabsBootstrapForTests();
    appJotaiStore.set(activeTabIdAtom, null);
  });

  it("migrates legacy localStorage document into the first tab and clears legacy keys", async () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });

    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      JSON.stringify([rectangle]),
    );
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      JSON.stringify({ viewBackgroundColor: "#ffffff" }),
    );

    const { tabs, activeTabId } = await migrateLegacyDocumentIfNeeded();

    expect(tabs).toHaveLength(1);
    expect(tabs[0].name).toBe("Drawing 1");
    expect(activeTabId).toBe(tabs[0].id);
    expect(loadTabsMetadata()).toEqual(tabs);
    expect(loadActiveTabId()).toBe(activeTabId);

    expect(
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS),
    ).toBeNull();
    expect(
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE),
    ).toBeNull();

    const doc = await DocumentStore.loadDocument(activeTabId);
    expect(doc?.elements).toHaveLength(1);
    expect(doc?.elements[0].id).toBe(rectangle.id);
  });

  it("clears legacy keys when tab metadata already exists", async () => {
    const tab = createBlankTab("Drawing 1");
    saveTabsMetadata([tab]);
    saveActiveTabId(tab.id);
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      JSON.stringify([]),
    );

    const result = await migrateLegacyDocumentIfNeeded();

    expect(result.tabs).toHaveLength(1);
    expect(
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS),
    ).toBeNull();
  });

  it("returns existing tabs without creating duplicates", async () => {
    const tabA = createBlankTab("Drawing 1");
    const tabB = createBlankTab("Drawing 2");
    saveTabsMetadata([tabA, tabB]);
    saveActiveTabId(tabB.id);

    const result = await migrateLegacyDocumentIfNeeded();

    expect(result.tabs).toHaveLength(2);
    expect(result.activeTabId).toBe(tabB.id);
  });

  it("getNextDefaultTabName skips used default names", () => {
    const tabs = [
      createBlankTab("Drawing 1"),
      createBlankTab("Drawing 2"),
      createBlankTab("Sketch"),
    ];

    expect(getNextDefaultTabName(tabs)).toBe("Drawing 3");
  });

  it("activateTab updates atom and localStorage after preparing for switch", () => {
    const prepareSpy = vi.spyOn(LocalData, "prepareForTabSwitch");
    const tab = createBlankTab("Drawing 1");
    saveTabsMetadata([tab]);

    activateTab(tab.id);

    expect(prepareSpy).toHaveBeenCalledTimes(1);
    expect(appJotaiStore.get(activeTabIdAtom)).toBe(tab.id);
    expect(loadActiveTabId()).toBe(tab.id);

    prepareSpy.mockRestore();
    LocalData.resumeSave("tabSwitch");
  });

  it("preserves legacy keys when IDB persistence fails during migration", async () => {
    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      JSON.stringify([rectangle]),
    );
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      JSON.stringify({}),
    );

    const saveSpy = vi
      .spyOn(DocumentStore, "saveDocument")
      .mockRejectedValueOnce(new Error("idb unavailable"));

    const result = await migrateLegacyDocumentIfNeeded();

    expect(result.tabs).toHaveLength(1);
    expect(result.activeTabId).toBe(result.tabs[0].id);
    // Tab metadata must NOT be persisted yet, otherwise next boot would
    // skip the migration and the legacy data would never reach IDB.
    expect(loadTabsMetadata()).toEqual([]);
    // Legacy keys must remain so the next boot can retry the migration.
    expect(localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS)).not.toBe(
      null,
    );
    expect(localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE)).not.toBe(
      null,
    );

    saveSpy.mockRestore();
  });

  it("clearLegacyLocalStorageDocument removes legacy keys only", () => {
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS, "[]");
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE, "{}");
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_THEME, "light");

    clearLegacyLocalStorageDocument();

    expect(
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS),
    ).toBeNull();
    expect(
      localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_APP_STATE),
    ).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_THEME)).toBe(
      "light",
    );
  });

  it("ensureTabsReady allows retry after a rejection", async () => {
    const saveSpy = vi
      .spyOn(DocumentStore, "saveDocument")
      .mockRejectedValueOnce(new Error("transient idb"));

    const first = await ensureTabsReady();
    // First call returns the in-memory fallback (legacy keys preserved).
    expect(first.tabs).toHaveLength(1);
    expect(loadTabsMetadata()).toEqual([]);

    // Second call must NOT return the cached promise; it must re-run the
    // migration so the user's data eventually reaches IDB.
    resetTabsBootstrapForTests();
    saveSpy.mockRestore();

    const second = await ensureTabsReady();
    expect(second.tabs).toHaveLength(1);
    expect(loadTabsMetadata()).toHaveLength(1);
  });
});

describe("LocalData multitab saves", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    resetTabsBootstrapForTests();
    LocalData.resumeSave("tabSwitch");
    LocalData.resumeSave("collaboration");
  });

  it("prepareForTabSwitch blocks saves until resumed", () => {
    const appState = getDefaultAppState() as AppState;

    LocalData.prepareForTabSwitch();
    expect(LocalData.isSavePaused()).toBe(true);

    LocalData.save([], appState, {}, () => {});

    LocalData.resumeSave("tabSwitch");
    expect(LocalData.isSavePaused()).toBe(false);
  });

  it("resumeSave releases the tabSwitch lock acquired by activateTab", () => {
    // Regression for the collab early-return path in App.tsx: when the user
    // switches tabs while collaborating, App.tsx bails out of the scene swap
    // but must still release the "tabSwitch" lock that activateTab acquired,
    // otherwise saves stay paused even after collab ends.
    const tab = createBlankTab("Drawing 1");
    saveTabsMetadata([tab]);

    activateTab(tab.id);
    expect(LocalData.isSavePaused()).toBe(true);

    LocalData.resumeSave("tabSwitch");
    expect(LocalData.isSavePaused()).toBe(false);
  });

  it("deleteTabDocument undoes a save that was already in flight", async () => {
    const tab = createBlankTab("Drawing 1");
    saveTabsMetadata([tab]);
    activateTab(tab.id);
    LocalData.resumeSave("tabSwitch");

    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });

    LocalData.save([rectangle], getDefaultAppState() as AppState, {}, () => {});
    // Fire the debounce immediately so the async save body starts before we
    // delete the tab — this simulates the race where the user closes a tab
    // while its save is mid-flight.
    LocalData.flushSave();

    await LocalData.deleteTabDocument(tab.id);

    // Wait long enough for any in-flight save body to finish; it must have
    // observed `_deletingTabIds` and undone its own write.
    await vi.waitFor(async () => {
      const doc = await DocumentStore.loadDocument(tab.id);
      expect(doc).toBeNull();
    });
  });

  it("save bails when the target tab is already being deleted", async () => {
    const tab = createBlankTab("Drawing 1");
    saveTabsMetadata([tab]);
    activateTab(tab.id);
    LocalData.resumeSave("tabSwitch");

    // Mark the tab as deleting before the save fires.
    await LocalData.deleteTabDocument(tab.id);

    LocalData.save(
      [
        API.createElement({
          type: "rectangle",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
        }),
      ],
      getDefaultAppState() as AppState,
      {},
      () => {},
    );
    LocalData.flushSave();

    // Allow microtasks to drain.
    await Promise.resolve();
    await Promise.resolve();

    const doc = await DocumentStore.loadDocument(tab.id);
    expect(doc).toBeNull();
  });

  it("save writes to the tab id captured at enqueue time", async () => {
    const tabA = createBlankTab("Drawing 1");
    const tabB = createBlankTab("Drawing 2");
    saveTabsMetadata([tabA, tabB]);
    activateTab(tabA.id);
    LocalData.resumeSave("tabSwitch");

    const rectangle = API.createElement({
      type: "rectangle",
      x: 0,
      y: 0,
      width: 40,
      height: 40,
    });

    LocalData.save([rectangle], getDefaultAppState() as AppState, {}, () => {});
    LocalData.flushSave();

    await vi.waitFor(async () => {
      const docA = await DocumentStore.loadDocument(tabA.id);
      expect(docA?.elements).toHaveLength(1);
    });

    const docB = await DocumentStore.loadDocument(tabB.id);
    expect(docB).toBeNull();
  });
});
