/**
 * Hot-switching between local projects (boards), without a page reload.
 *
 * Implements decision D4 from openspec/changes/multiproject-support/design.md:
 * the scene swap reuses the same battle-tested primitives as the app's
 * `onHashChange` handler (`updateScene` + `CaptureUpdateAction.IMMEDIATELY`
 * + async image loading via `addFiles`).
 */

import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { randomId } from "@excalidraw/common";
import { isInitializedImageElement } from "@excalidraw/element";
import { t } from "@excalidraw/excalidraw/i18n";
import {
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";

import type { FileId } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../app_constants";
import { activeProjectIdAtom, appJotaiStore } from "../app-jotai";

import { LocalData } from "./LocalData";
import {
  deleteProjectRecord,
  getActiveProjectId,
  getProject,
  listProjects,
  saveActiveProject,
  saveActiveProjectDebounced,
  saveProject,
  setActiveProjectId,
} from "./projectsStore";
import { updateBrowserStateVersion } from "./tabSync";

import type { ProjectRecord } from "./projectsStore";

/** structural subset of the editor API needed here (satisfied both by the
 *  imperative API and by the App instance used in tests) */
export type ProjectSwitchEditorAPI = Pick<
  ExcalidrawImperativeAPI,
  | "getSceneElementsIncludingDeleted"
  | "getAppState"
  | "updateScene"
  | "addFiles"
>;

export interface ProjectSwitchCollabAPI {
  isCollaborating: () => boolean;
  stopCollaboration: (keepRemoteState?: boolean) => void;
}

type SwitchOpts = {
  excalidrawAPI: ProjectSwitchEditorAPI;
  collabAPI?: ProjectSwitchCollabAPI | null;
  /** skip persisting the outgoing project (e.g. it was just deleted) */
  saveCurrent?: boolean;
};

/**
 * Switches the editor to another project:
 * 1. no-op when the target is already active
 * 2. stops an ongoing collaboration first (releases the save lock)
 * 3. synchronously persists the outgoing project (pending debounced save
 *    is cancelled, then saved with the latest editor state)
 * 4. moves the active pointer
 * 5. restores elements + appState via updateScene (IMMEDIATELY)
 * 6. loads referenced images from the shared files store
 * 7. bumps the browser state version so other tabs pick up the change
 *
 * Returns whether the switch happened.
 */
export const switchProject = async (
  targetId: string,
  opts: SwitchOpts,
): Promise<boolean> => {
  const { excalidrawAPI, collabAPI, saveCurrent = true } = opts;

  const currentId =
    appJotaiStore.get(activeProjectIdAtom) ?? getActiveProjectId();
  if (currentId === targetId) {
    return false;
  }

  const target = await getProject(targetId);
  if (!target) {
    console.error(`Cannot switch: project "${targetId}" not found`);
    return false;
  }

  if (collabAPI?.isCollaborating()) {
    collabAPI.stopCollaboration(false);
  }

  if (saveCurrent) {
    saveActiveProjectDebounced.cancel();
    await saveActiveProject(
      excalidrawAPI.getSceneElementsIncludingDeleted(),
      excalidrawAPI.getAppState(),
    );
  }

  setActiveProjectId(target.id);

  excalidrawAPI.updateScene({
    elements: restoreElements(target.elements, null, {
      repairBindings: true,
    }),
    appState: restoreAppState(target.appState, null),
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });

  const fileIds = target.elements.reduce((acc, element) => {
    if (isInitializedImageElement(element)) {
      return acc.concat(element.fileId);
    }
    return acc;
  }, [] as FileId[]);
  if (fileIds.length) {
    LocalData.fileStorage.getFiles(fileIds).then(({ loadedFiles }) => {
      if (loadedFiles.length) {
        excalidrawAPI.addFiles(loadedFiles);
      }
    });
  }

  updateBrowserStateVersion(STORAGE_KEYS.VERSION_DATA_STATE);
  return true;
};

/**
 * Creates a new empty project and switches to it. The outgoing project is
 * persisted first (unless `saveCurrent: false`). The new board inherits the
 * current theme so it doesn't flash back to the default one.
 */
export const createProject = async (opts: SwitchOpts & { title?: string }) => {
  const { excalidrawAPI, collabAPI, title, saveCurrent } = opts;

  const now = Date.now();
  const projectTitle = title || t("labels.untitled");
  const record: ProjectRecord = {
    id: randomId(),
    title: projectTitle,
    createdAt: now,
    updatedAt: now,
    elements: [],
    appState: {
      name: projectTitle,
      theme: excalidrawAPI.getAppState().theme,
    },
  };
  await saveProject(record);
  await switchProject(record.id, { excalidrawAPI, collabAPI, saveCurrent });
  return record;
};

/**
 * Renames a project (record + index + stored appState.name so a later
 * switch doesn't resurrect the old title). When renaming the ACTIVE
 * project, the editor's appState.name is updated too (exports and the
 * ProjectName field follow suit).
 */
export const renameProject = async (
  id: string,
  title: string,
  opts: { excalidrawAPI?: ProjectSwitchEditorAPI } = {},
): Promise<void> => {
  const record = await getProject(id);
  if (!record) {
    return;
  }

  await saveProject({
    ...record,
    title,
    appState: { ...record.appState, name: title },
    updatedAt: Date.now(),
  });

  const activeId =
    appJotaiStore.get(activeProjectIdAtom) ?? getActiveProjectId();
  if (id === activeId && opts.excalidrawAPI) {
    opts.excalidrawAPI.updateScene({
      appState: { name: title },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  }
};

/**
 * Deletes a project. When deleting the ACTIVE project, activates the most
 * recently updated remaining one, or creates a fresh empty project when
 * none are left (there must always be exactly one active project).
 */
export const deleteProject = async (
  id: string,
  opts: SwitchOpts,
): Promise<void> => {
  const { excalidrawAPI, collabAPI } = opts;
  const activeId =
    appJotaiStore.get(activeProjectIdAtom) ?? getActiveProjectId();

  // cancel any pending save so the deleted record is not resurrected
  saveActiveProjectDebounced.cancel();
  await deleteProjectRecord(id);

  if (id !== activeId) {
    return;
  }

  const index = await listProjects();
  if (index.length > 0) {
    await switchProject(index[0].id, {
      excalidrawAPI,
      collabAPI,
      // the outgoing scene belongs to the deleted project: do not save it
      saveCurrent: false,
    });
  } else {
    await createProject({ excalidrawAPI, collabAPI, saveCurrent: false });
  }
};
