/**
 * Local persistence for multiple projects (boards).
 *
 * Storage model (see openspec/changes/multiproject-support/design.md):
 * - Each project lives in its own IDB record (`proj_<id>`) inside
 *   `excalidraw-projects-db`, with a lightweight `__index__` entry list
 *   used to render the projects sidebar without loading every scene.
 * - The ACTIVE project additionally keeps being written to the legacy
 *   localStorage keys ("excalidraw" / "excalidraw-state") by LocalData,
 *   so `initializeScene()` and `tabSync` keep working unchanged.
 * - Images stay in the shared `files-db` store (content-addressed by
 *   fileId), so no binary data is duplicated between projects.
 *
 * Known limitation (multi-tab): `tabSync` assumes a single global scene.
 * Two tabs editing DIFFERENT projects concurrently will overwrite each
 * other's localStorage keys on focus, same as any concurrent edit today.
 * See "Open Questions" in the design doc (per-project localStorage
 * namespacing) for the long-term fix.
 */

import { createStore, del, get, set } from "idb-keyval";

import { debounce, randomId } from "@excalidraw/common";
import { getNonDeletedElements } from "@excalidraw/element";
import { clearAppStateForLocalStorage } from "@excalidraw/excalidraw/appState";
import { t } from "@excalidraw/excalidraw/i18n";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { SAVE_TO_LOCAL_STORAGE_TIMEOUT, STORAGE_KEYS } from "../app_constants";
import {
  activeProjectIdAtom,
  appJotaiStore,
  projectsListAtom,
} from "../app-jotai";

import { importFromLocalStorage } from "./localStorage";

// ---------------------------------------------------------------------------
// types
// ---------------------------------------------------------------------------

export type ProjectIndexEntry = {
  id: string;
  title: string;
  updatedAt: number;
};

export type ProjectRecord = ProjectIndexEntry & {
  createdAt: number;
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
};

// ---------------------------------------------------------------------------
// IDB store
// ---------------------------------------------------------------------------

const INDEX_KEY = "__index__";
const projectKey = (id: string) => `proj_${id}`;

const projectsIdbStore = createStore(
  `${STORAGE_KEYS.IDB_PROJECTS}-db`,
  `${STORAGE_KEYS.IDB_PROJECTS}-store`,
);

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export const listProjects = async (): Promise<ProjectIndexEntry[]> => {
  try {
    return (await get<ProjectIndexEntry[]>(INDEX_KEY, projectsIdbStore)) || [];
  } catch (error: any) {
    console.error(error);
    return [];
  }
};

/** sorted (updatedAt desc) and pushed into projectsListAtom */
const saveIndex = async (index: ProjectIndexEntry[]) => {
  index.sort((a, b) => b.updatedAt - a.updatedAt);
  await set(INDEX_KEY, index, projectsIdbStore);
  appJotaiStore.set(projectsListAtom, index);
};

export const getProject = async (id: string): Promise<ProjectRecord | null> => {
  try {
    return (await get<ProjectRecord>(projectKey(id), projectsIdbStore)) || null;
  } catch (error: any) {
    console.error(error);
    return null;
  }
};

export const saveProject = async (record: ProjectRecord): Promise<void> => {
  await set(projectKey(record.id), record, projectsIdbStore);
  const index = await listProjects();
  const entry: ProjectIndexEntry = {
    id: record.id,
    title: record.title,
    updatedAt: record.updatedAt,
  };
  const existingIdx = index.findIndex((p) => p.id === record.id);
  if (existingIdx >= 0) {
    index[existingIdx] = entry;
  } else {
    index.push(entry);
  }
  await saveIndex(index);
};

export const deleteProjectRecord = async (id: string): Promise<void> => {
  await del(projectKey(id), projectsIdbStore);
  await saveIndex((await listProjects()).filter((p) => p.id !== id));
};

// ---------------------------------------------------------------------------
// active project pointer
// ---------------------------------------------------------------------------

export const getActiveProjectId = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_ACTIVE_PROJECT);
  } catch (error: any) {
    console.error(error);
    return null;
  }
};

export const setActiveProjectId = (id: string) => {
  try {
    localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_ACTIVE_PROJECT, id);
  } catch (error: any) {
    console.error(error);
  }
  appJotaiStore.set(activeProjectIdAtom, id);
};

// ---------------------------------------------------------------------------
// migration & snapshots
// ---------------------------------------------------------------------------

/**
 * First-run migration: if no project index exists yet, the current local
 * scene (legacy localStorage keys) becomes the user's first project.
 * Covers the empty-scene case as well (creates an empty default project).
 * Also repairs a missing/stale active-project pointer.
 */
export const migrateLocalSceneToProject = async (): Promise<ProjectRecord> => {
  const index = await listProjects();

  if (index.length > 0) {
    const activeId = getActiveProjectId();
    const activeRecord = activeId ? await getProject(activeId) : null;
    if (activeRecord) {
      appJotaiStore.set(activeProjectIdAtom, activeRecord.id);
      appJotaiStore.set(projectsListAtom, index);
      return activeRecord;
    }
    // pointer missing or stale → fall back to most recently updated project
    const fallback = await getProject(index[0].id);
    if (fallback) {
      setActiveProjectId(fallback.id);
      return fallback;
    }
    // index existed but records are unreadable: rebuild from scratch below
  }

  const localDataState = importFromLocalStorage();
  const now = Date.now();
  const record: ProjectRecord = {
    id: randomId(),
    title: localDataState.appState?.name || t("labels.untitled"),
    createdAt: now,
    updatedAt: now,
    elements: localDataState.elements,
    appState: localDataState.appState || {},
  };
  await saveProject(record);
  setActiveProjectId(record.id);
  return record;
};

/**
 * Serializes the current editor state into the active project record.
 * - filters out deleted elements (same as the localStorage save)
 * - cleans appState for storage and drops `openSidebar`, so restoring a
 *   project never reopens an unexpected sidebar
 * - an explicit scene name (edited via ProjectName) becomes the title
 */
export const saveActiveProject = async (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
): Promise<void> => {
  const activeId =
    appJotaiStore.get(activeProjectIdAtom) ?? getActiveProjectId();
  if (!activeId) {
    return;
  }
  const existing = await getProject(activeId);
  if (!existing) {
    // the active record may have been deleted (see deleteProject fallback)
    return;
  }
  await saveProject({
    ...existing,
    title: appState.name || existing.title,
    updatedAt: Date.now(),
    elements: getNonDeletedElements(elements),
    appState: { ...clearAppStateForLocalStorage(appState), openSidebar: null },
  });
};

export const saveActiveProjectDebounced = debounce(
  (elements: readonly ExcalidrawElement[], appState: AppState) => {
    saveActiveProject(elements, appState);
  },
  SAVE_TO_LOCAL_STORAGE_TIMEOUT,
);

export const flushActiveProjectSave = () => {
  saveActiveProjectDebounced.flush();
};

// ---------------------------------------------------------------------------
// files GC support
// ---------------------------------------------------------------------------

/**
 * Union of every fileId referenced by any stored project. Used by
 * `clearObsoleteFiles` so images used by non-active projects are not
 * garbage-collected.
 */
export const collectAllProjectFileIds = async (): Promise<Set<string>> => {
  const fileIds = new Set<string>();
  const index = await listProjects();
  for (const entry of index) {
    const record = await getProject(entry.id);
    if (!record) {
      continue;
    }
    for (const element of record.elements) {
      if (element.type === "image" && element.fileId) {
        fileIds.add(element.fileId);
      }
    }
  }
  return fileIds;
};
