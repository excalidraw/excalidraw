import { CANVAS_SEARCH_TAB, DEFAULT_SIDEBAR } from "@excalidraw/common";
import { newElementWith } from "@excalidraw/element";
import {
  clearAppStateForLocalStorage,
  getDefaultAppState,
} from "@excalidraw/excalidraw/appState";
import { reconcileElements } from "@excalidraw/excalidraw/data/reconcile";
import { restoreElements } from "@excalidraw/excalidraw/data/restore";

import type { OrderedExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";

import { getSyncableElements } from ".";

import type { importFromLocalStorage } from "./localStorage";

type StoredScene = ReturnType<typeof importFromLocalStorage>;

export type LocalSceneSnapshot = {
  elements: readonly OrderedExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
};

const getStoredAppState = (appState: Partial<AppState>) => {
  const state = clearAppStateForLocalStorage(appState);
  if (
    state.openSidebar?.name === DEFAULT_SIDEBAR.name &&
    state.openSidebar.tab === CANVAS_SEARCH_TAB
  ) {
    state.openSidebar = null;
  }
  return state;
};

export class LocalScene {
  private baselineIds = new Set<string>();
  private baselineElements = "[]";
  private baselineAppState: Partial<AppState> = {};

  load(data: StoredScene) {
    this.accept(
      data.elements,
      getStoredAppState(data.appState ?? getDefaultAppState()),
    );
    return data;
  }

  accept(
    elements: StoredScene["elements"] | readonly OrderedExcalidrawElement[],
    appState: Partial<AppState>,
  ) {
    this.baselineIds = new Set(
      elements
        .filter((element) => !element.isDeleted)
        .map((element) => element.id),
    );
    this.baselineElements = JSON.stringify(elements);
    this.baselineAppState = JSON.parse(JSON.stringify(appState));
  }

  reconcile(local: LocalSceneSnapshot, stored: StoredScene, replace: boolean) {
    const localIds = new Set(local.elements.map((element) => element.id));
    const replacesScene =
      replace || [...this.baselineIds].some((id) => !localIds.has(id));
    let elements = local.elements;
    const remoteElements = JSON.stringify(stored.elements);
    if (
      !replacesScene &&
      stored.elementsValid &&
      remoteElements !== this.baselineElements
    ) {
      const remoteIds = new Set(stored.elements.map((element) => element.id));
      const localElements = local.elements.map((element) =>
        !element.isDeleted &&
        this.baselineIds.has(element.id) &&
        !remoteIds.has(element.id)
          ? newElementWith(element, { isDeleted: true })
          : element,
      );
      const restored = restoreElements(stored.elements, localElements);
      elements = reconcileElements(
        localElements,
        restored as RemoteExcalidrawElement[],
        local.appState,
      );
    }

    const localState = getStoredAppState(local.appState);
    const appState = replacesScene
      ? localState
      : {
          ...getStoredAppState(stored.appState ?? local.appState),
          ...Object.fromEntries(
            Object.entries(localState).filter(
              ([key, value]) =>
                JSON.stringify(value) !==
                JSON.stringify(this.baselineAppState[key as keyof AppState]),
            ),
          ),
        };
    const appStateUpdates = Object.fromEntries(
      Object.entries(appState).filter(
        ([key, value]) =>
          JSON.stringify(value) !==
          JSON.stringify(localState[key as keyof typeof localState]),
      ),
    );
    const elementsChanged =
      elements.length !== local.elements.length ||
      elements.some((element, index) => element !== local.elements[index]);

    return {
      elements,
      persistedElements: getSyncableElements(elements),
      appState,
      updates: {
        ...(elementsChanged ? { elements } : {}),
        ...(Object.keys(appStateUpdates).length
          ? { appState: appStateUpdates as Partial<AppState> }
          : {}),
      },
    };
  }
}
