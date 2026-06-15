import {
  reconstructSceneHistoryData,
  trimSceneHistoryData,
} from "./SceneHistory";

import type {
  SceneHistoryData,
  SceneHistoryEntry,
  SceneHistorySnapshot,
} from "./SceneHistory";

const createAppState = (name: string | null) => ({
  name,
  editingGroupId: null,
  viewBackgroundColor: "#ffffff",
  selectedElementIds: {},
  selectedGroupIds: {},
  selectedLinearElement: null,
  croppingElementId: null,
  lockedMultiSelections: {},
  activeLockedId: null,
});

const createSnapshot = (name: string | null): SceneHistorySnapshot => ({
  elements: [],
  appState: createAppState(name),
});

const createNameDelta = (from: string | null, to: string) => ({
  id: `delta-${to}`,
  elements: {
    added: {},
    removed: {},
    updated: {},
  },
  appState: {
    delta: {
      deleted: {
        name: from,
      },
      inserted: {
        name: to,
      },
    },
  },
});

const createEntry = (index: number): SceneHistoryEntry => {
  const name = `v${index}`;

  return {
    id: `entry-${index}`,
    kind: index === 0 ? "initial" : "change",
    sequence: index,
    createdAt: index,
    sessionId: "test-session",
    parentId: index === 0 ? null : `entry-${index - 1}`,
    summary: "Scene updated",
    thumbnail: null,
    fileIds: [],
    snapshot: index === 0 ? createSnapshot(null) : undefined,
    delta: index === 0 ? undefined : createNameDelta(`v${index - 1}`, name),
  };
};

const createHistoryData = (entries: SceneHistoryEntry[]): SceneHistoryData => ({
  version: 1,
  documentId: "test-document",
  currentEntryId: entries[entries.length - 1]?.id ?? null,
  entries,
  files: {},
});

describe("SceneHistory", () => {
  it("reconstructs a target entry from the previous snapshot and deltas", () => {
    const historyData = createHistoryData([
      createEntry(0),
      {
        ...createEntry(1),
        delta: createNameDelta(null, "v1"),
      },
    ]);
    const target = reconstructSceneHistoryData(historyData, "entry-1");

    expect(target?.appState.name).toBe("v1");
    expect(target?.appState.selectedElementIds).toEqual({});
  });

  it("trims old entries while keeping the first retained entry reconstructable", () => {
    const historyData = createHistoryData(
      Array.from({ length: 122 }, (_, index) => createEntry(index)),
    );
    const trimmedHistoryData = trimSceneHistoryData(historyData);
    const target = reconstructSceneHistoryData(
      trimmedHistoryData,
      trimmedHistoryData.currentEntryId!,
    );

    expect(trimmedHistoryData.entries).toHaveLength(120);
    expect(trimmedHistoryData.entries[0].snapshot).toBeDefined();
    expect(trimmedHistoryData.entries[0].delta).toBeUndefined();
    expect(target?.appState.name).toBe("v121");
  });
});
