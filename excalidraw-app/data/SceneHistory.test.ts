import type { StoreDelta } from "@excalidraw/element";
import type { OrderedExcalidrawElement } from "@excalidraw/element/types";

import {
  createCollabRestoreElements,
  isSceneHistoryDeltaRecordable,
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

const createStoreDelta = (
  delta: Partial<{
    elements: {
      added: Record<string, unknown>;
      removed: Record<string, unknown>;
      updated: Record<string, unknown>;
    };
    appState: {
      delta: {
        deleted: Record<string, unknown>;
        inserted: Record<string, unknown>;
      };
    };
  }> = {},
) =>
  ({
    id: "delta",
    elements: delta.elements ?? {
      added: {},
      removed: {},
      updated: {},
    },
    appState: delta.appState ?? {
      delta: {
        deleted: {},
        inserted: {},
      },
    },
  } as unknown as StoreDelta);

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

const createElement = ({
  id,
  isDeleted = false,
  version,
  versionNonce = version,
}: {
  id: string;
  isDeleted?: boolean;
  version: number;
  versionNonce?: number;
}) =>
  ({
    id,
    isDeleted,
    updated: version,
    version,
    versionNonce,
  } as OrderedExcalidrawElement);

describe("SceneHistory", () => {
  it("does not record transient-only app state deltas", () => {
    const delta = createStoreDelta({
      appState: {
        delta: {
          deleted: {
            selectedElementIds: {},
          },
          inserted: {
            selectedElementIds: {
              elementId: true,
            },
          },
        },
      },
    });

    expect(isSceneHistoryDeltaRecordable(delta)).toBe(false);
  });

  it("records element and scene-level app state deltas", () => {
    const elementDelta = createStoreDelta({
      elements: {
        added: {},
        removed: {},
        updated: {
          elementId: {
            deleted: {
              version: 1,
            },
            inserted: {
              version: 2,
            },
          },
        },
      },
    });
    const nameDelta = createNameDelta(null, "v1") as unknown as StoreDelta;

    expect(isSceneHistoryDeltaRecordable(elementDelta)).toBe(true);
    expect(isSceneHistoryDeltaRecordable(nameDelta)).toBe(true);
  });

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

  it("creates collab restore elements with bumped targets and deletion tombstones", () => {
    const restoredElements = createCollabRestoreElements(
      [createElement({ id: "existing", version: 1, versionNonce: 10 })],
      [
        createElement({ id: "existing", version: 5, versionNonce: 20 }),
        createElement({ id: "newer", version: 3 }),
      ],
    );
    const existingElement = restoredElements.find(
      (element) => element.id === "existing",
    );
    const deletedElement = restoredElements.find(
      (element) => element.id === "newer",
    );

    expect(existingElement?.version).toBeGreaterThan(5);
    expect(deletedElement?.isDeleted).toBe(true);
    expect(deletedElement?.version).toBeGreaterThan(3);
  });
});
