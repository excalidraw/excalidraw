import {
  getInitializedImageElements,
  getObservedAppState,
  StoreDelta,
} from "@excalidraw/element";
import { createStore, get, set } from "idb-keyval";

import type {
  ExcalidrawElement,
  FileId,
  OrderedExcalidrawElement,
  SceneElementsMap,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
  ObservedAppState,
} from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../app_constants";

const HISTORY_VERSION = 1;
const MAX_HISTORY_ENTRIES = 120;
const SNAPSHOT_INTERVAL = 20;
const LOCAL_DOCUMENT_ID = "local-default";

export type SceneHistoryEntryKind = "initial" | "change" | "restore";

type SerializedDelta<T> = {
  deleted: Partial<T>;
  inserted: Partial<T>;
};

type SerializedStoreDelta = {
  id: string;
  elements: {
    added: Record<string, SerializedDelta<Partial<ExcalidrawElement>>>;
    removed: Record<string, SerializedDelta<Partial<ExcalidrawElement>>>;
    updated: Record<string, SerializedDelta<Partial<ExcalidrawElement>>>;
  };
  appState: {
    delta: SerializedDelta<ObservedAppState>;
  };
};

export type SceneHistorySnapshot = {
  elements: OrderedExcalidrawElement[];
  appState: ObservedAppState;
};

export type SceneHistoryEntry = {
  id: string;
  kind: SceneHistoryEntryKind;
  sequence: number;
  createdAt: number;
  sessionId: string;
  parentId: string | null;
  summary: string;
  thumbnail: string | null;
  fileIds: FileId[];
  delta?: SerializedStoreDelta;
  snapshot?: SceneHistorySnapshot;
  restoreSourceId?: string;
};

export type SceneHistoryData = {
  version: typeof HISTORY_VERSION;
  documentId: string;
  currentEntryId: string | null;
  entries: SceneHistoryEntry[];
  files: BinaryFiles;
};

export type SceneHistoryTargetState = {
  entry: SceneHistoryEntry;
  elements: OrderedExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
};

type SceneHistoryInit = {
  documentId?: string;
  sessionId: string;
  elements: readonly OrderedExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
  thumbnail?: string | null;
};

type SceneHistoryAppend = SceneHistoryInit & {
  delta: StoreDelta;
  kind?: Extract<SceneHistoryEntryKind, "change" | "restore">;
  restoreSourceId?: string;
};

const store = createStore(
  `${STORAGE_KEYS.IDB_SCENE_HISTORY}-db`,
  `${STORAGE_KEYS.IDB_SCENE_HISTORY}-store`,
);

const createId = () => {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
};

const cloneSerializable = <T>(value: T): T => {
  return JSON.parse(JSON.stringify(value));
};

const createEmptyHistory = (
  documentId = LOCAL_DOCUMENT_ID,
): SceneHistoryData => ({
  version: HISTORY_VERSION,
  documentId,
  currentEntryId: null,
  entries: [],
  files: {},
});

const normalizeObservedAppState = (appState: AppState): ObservedAppState => {
  const observedAppState = getObservedAppState(appState);

  return cloneSerializable({
    name: observedAppState.name,
    editingGroupId: observedAppState.editingGroupId,
    viewBackgroundColor: observedAppState.viewBackgroundColor,
    selectedElementIds: observedAppState.selectedElementIds,
    selectedGroupIds: observedAppState.selectedGroupIds,
    selectedLinearElement: observedAppState.selectedLinearElement,
    croppingElementId: observedAppState.croppingElementId,
    lockedMultiSelections: observedAppState.lockedMultiSelections,
    activeLockedId: observedAppState.activeLockedId,
  });
};

const resetTransientAppState = (
  appState: Partial<AppState>,
): Partial<AppState> => {
  return {
    ...appState,
    selectedElementIds: {},
    selectedGroupIds: {},
    selectedLinearElement: null,
    editingGroupId: null,
    croppingElementId: null,
    lockedMultiSelections: {},
    activeLockedId: null,
  };
};

export const createSceneHistorySnapshot = ({
  elements,
  appState,
}: {
  elements: readonly OrderedExcalidrawElement[];
  appState: AppState;
}): SceneHistorySnapshot => ({
  elements: cloneSerializable([...elements]),
  appState: normalizeObservedAppState(appState),
});

const getReferencedFileIds = (
  elements: readonly ExcalidrawElement[],
): FileId[] => {
  const ids = new Set<FileId>();

  for (const element of getInitializedImageElements(elements)) {
    if (!element.isDeleted) {
      ids.add(element.fileId);
    }
  }

  return [...ids];
};

const collectReferencedFiles = (
  elements: readonly ExcalidrawElement[],
  files: BinaryFiles,
): BinaryFiles => {
  const referencedFiles: BinaryFiles = {};

  for (const fileId of getReferencedFileIds(elements)) {
    const file = files[fileId];

    if (file) {
      referencedFiles[fileId] = cloneSerializable(file) as BinaryFileData;
    }
  }

  return referencedFiles;
};

const pickFiles = (fileIds: readonly FileId[], files: BinaryFiles) => {
  const nextFiles: BinaryFiles = {};

  for (const fileId of fileIds) {
    const file = files[fileId];

    if (file) {
      nextFiles[fileId] = file;
    }
  }

  return nextFiles;
};

const pruneFiles = (
  entries: readonly SceneHistoryEntry[],
  files: BinaryFiles,
): BinaryFiles => {
  const referencedFileIds = new Set<FileId>();

  for (const entry of entries) {
    for (const fileId of entry.fileIds) {
      referencedFileIds.add(fileId);
    }
  }

  return pickFiles([...referencedFileIds], files);
};

const createElementsMap = (
  elements: readonly OrderedExcalidrawElement[],
): SceneElementsMap => {
  return new Map(
    elements.map((element) => [element.id, element]),
  ) as SceneElementsMap;
};

const serializeDelta = (delta: StoreDelta): SerializedStoreDelta => {
  return cloneSerializable(delta) as SerializedStoreDelta;
};

const countObjectKeys = (value: unknown) => {
  return value && typeof value === "object" ? Object.keys(value).length : 0;
};

export const describeStoreDelta = (delta: StoreDelta): string => {
  const serializedDelta = serializeDelta(delta);
  const added = countObjectKeys(serializedDelta.elements.added);
  const removed = countObjectKeys(serializedDelta.elements.removed);
  const updated = countObjectKeys(serializedDelta.elements.updated);
  const appState = countObjectKeys(serializedDelta.appState.delta.inserted);
  const parts: string[] = [];

  if (added) {
    parts.push(`${added} added`);
  }
  if (updated) {
    parts.push(`${updated} edited`);
  }
  if (removed) {
    parts.push(`${removed} removed`);
  }
  if (appState) {
    parts.push("view updated");
  }

  return parts.join(", ") || "Scene updated";
};

export const reconstructSceneHistoryData = (
  historyData: SceneHistoryData,
  entryId: string,
): SceneHistoryTargetState | null => {
  const targetIndex = historyData.entries.findIndex(
    (entry) => entry.id === entryId,
  );

  if (targetIndex === -1) {
    return null;
  }

  let snapshotIndex = targetIndex;

  while (snapshotIndex >= 0 && !historyData.entries[snapshotIndex].snapshot) {
    snapshotIndex--;
  }

  const snapshotEntry = historyData.entries[snapshotIndex];
  const snapshot = snapshotEntry?.snapshot;

  if (!snapshot) {
    return null;
  }

  let elementsMap = createElementsMap(snapshot.elements);
  let appState = snapshot.appState as AppState;

  for (const entry of historyData.entries.slice(
    snapshotIndex + 1,
    targetIndex + 1,
  )) {
    if (!entry.delta) {
      continue;
    }

    [elementsMap, appState] = StoreDelta.applyTo(
      StoreDelta.restore(entry.delta as any),
      elementsMap,
      appState,
    );
  }

  const entry = historyData.entries[targetIndex];
  const elements = Array.from(elementsMap.values());

  return {
    entry,
    elements,
    appState: resetTransientAppState(appState),
    files: pickFiles(getReferencedFileIds(elements), historyData.files),
  };
};

export const trimSceneHistoryData = (
  historyData: SceneHistoryData,
): SceneHistoryData => {
  if (historyData.entries.length <= MAX_HISTORY_ENTRIES) {
    return {
      ...historyData,
      files: pruneFiles(historyData.entries, historyData.files),
    };
  }

  const firstKeptIndex = historyData.entries.length - MAX_HISTORY_ENTRIES;
  const firstKeptEntry = historyData.entries[firstKeptIndex];
  const reconstructedFirstEntry = reconstructSceneHistoryData(
    historyData,
    firstKeptEntry.id,
  );

  if (!reconstructedFirstEntry) {
    return historyData;
  }

  const entries = historyData.entries.slice(firstKeptIndex);

  entries[0] = {
    ...entries[0],
    kind: "initial",
    parentId: null,
    summary: "History checkpoint",
    delta: undefined,
    restoreSourceId: undefined,
    snapshot: {
      elements: reconstructedFirstEntry.elements,
      appState: reconstructedFirstEntry.appState as ObservedAppState,
    },
  };

  return {
    ...historyData,
    currentEntryId: entries[entries.length - 1]?.id ?? null,
    entries,
    files: pruneFiles(entries, historyData.files),
  };
};

class SceneHistoryIndexedDBAdapter {
  private static key = "sceneHistory";

  static async load(documentId = LOCAL_DOCUMENT_ID): Promise<SceneHistoryData> {
    try {
      const historyData = await get<SceneHistoryData>(
        SceneHistoryIndexedDBAdapter.key,
        store,
      );

      if (
        historyData?.version === HISTORY_VERSION &&
        historyData.documentId === documentId
      ) {
        return historyData;
      }
    } catch (error) {
      console.warn("Failed to load scene history from IndexedDB:", error);
    }

    return createEmptyHistory(documentId);
  }

  static save(historyData: SceneHistoryData) {
    return set(SceneHistoryIndexedDBAdapter.key, historyData, store);
  }
}

export class SceneHistory {
  static async load(documentId = LOCAL_DOCUMENT_ID) {
    return SceneHistoryIndexedDBAdapter.load(documentId);
  }

  static async ensureInitialized({
    documentId = LOCAL_DOCUMENT_ID,
    sessionId,
    elements,
    appState,
    files,
    thumbnail = null,
  }: SceneHistoryInit) {
    const historyData = await SceneHistoryIndexedDBAdapter.load(documentId);

    if (historyData.entries.length) {
      return historyData;
    }

    const entry: SceneHistoryEntry = {
      id: createId(),
      kind: "initial",
      sequence: 0,
      createdAt: Date.now(),
      sessionId,
      parentId: null,
      summary: "Initial version",
      thumbnail,
      fileIds: getReferencedFileIds(elements),
      snapshot: createSceneHistorySnapshot({ elements, appState }),
    };

    const nextHistoryData = trimSceneHistoryData({
      ...historyData,
      currentEntryId: entry.id,
      entries: [entry],
      files: {
        ...historyData.files,
        ...collectReferencedFiles(elements, files),
      },
    });

    await SceneHistoryIndexedDBAdapter.save(nextHistoryData);

    return nextHistoryData;
  }

  static async append({
    documentId = LOCAL_DOCUMENT_ID,
    sessionId,
    elements,
    appState,
    files,
    thumbnail = null,
    delta,
    kind = "change",
    restoreSourceId,
  }: SceneHistoryAppend) {
    const historyData = await SceneHistoryIndexedDBAdapter.load(documentId);

    if (!historyData.entries.length) {
      return SceneHistory.ensureInitialized({
        documentId,
        sessionId,
        elements,
        appState,
        files,
        thumbnail,
      });
    }

    const lastEntry = historyData.entries[historyData.entries.length - 1];
    const sequence = (lastEntry?.sequence ?? -1) + 1;
    const isCheckpoint = sequence % SNAPSHOT_INTERVAL === 0;
    const entry: SceneHistoryEntry = {
      id: createId(),
      kind,
      sequence,
      createdAt: Date.now(),
      sessionId,
      parentId: lastEntry?.id ?? null,
      summary:
        kind === "restore"
          ? "Restored previous version"
          : describeStoreDelta(delta),
      thumbnail,
      fileIds: getReferencedFileIds(elements),
      delta: serializeDelta(delta),
      restoreSourceId,
      snapshot: isCheckpoint
        ? createSceneHistorySnapshot({ elements, appState })
        : undefined,
    };
    const nextHistoryData = trimSceneHistoryData({
      ...historyData,
      currentEntryId: entry.id,
      entries: historyData.entries.concat(entry),
      files: {
        ...historyData.files,
        ...collectReferencedFiles(elements, files),
      },
    });

    await SceneHistoryIndexedDBAdapter.save(nextHistoryData);

    return nextHistoryData;
  }

  static async reconstruct(entryId: string, documentId = LOCAL_DOCUMENT_ID) {
    const historyData = await SceneHistoryIndexedDBAdapter.load(documentId);

    return reconstructSceneHistoryData(historyData, entryId);
  }
}
