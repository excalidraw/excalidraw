import {
  clearAppStateForLocalStorage,
  getDefaultAppState,
} from "@excalidraw/excalidraw/appState";
import { randomId } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS } from "../app_constants";

import { updateBrowserStateVersion } from "./tabSync";

export const DEFAULT_LOCAL_SCENE_NAME = "Untitled";

export type LocalScene = {
  id: string;
  name: string;
  elements: ExcalidrawElement[];
  appState: Partial<AppState>;
  createdAt: number;
  updatedAt: number;
};

export type LocalSceneStore = {
  version: 1;
  activeSceneId: string;
  scenes: LocalScene[];
};

type SceneSnapshot = {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
};

const createSceneId = () => `scene_${randomId()}`;

const normalizeSceneName = (name: string | null | undefined) => {
  return name?.trim() || DEFAULT_LOCAL_SCENE_NAME;
};

const createLocalScene = ({
  name,
  elements,
  appState,
}: {
  name?: string | null;
} & SceneSnapshot): LocalScene => {
  const now = Date.now();

  return {
    id: createSceneId(),
    name: normalizeSceneName(name || appState.name),
    elements: [...elements],
    appState: clearAppStateForLocalStorage(appState),
    createdAt: now,
    updatedAt: now,
  };
};

const normalizeStore = (value: unknown): LocalSceneStore | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const rawStore = value as Partial<LocalSceneStore>;
  if (!Array.isArray(rawStore.scenes)) {
    return null;
  }

  const scenes = rawStore.scenes
    .filter((scene): scene is LocalScene => {
      return (
        !!scene &&
        typeof scene.id === "string" &&
        typeof scene.name === "string" &&
        Array.isArray(scene.elements) &&
        !!scene.appState &&
        typeof scene.appState === "object"
      );
    })
    .map((scene) => ({
      ...scene,
      name: normalizeSceneName(scene.name),
      createdAt:
        typeof scene.createdAt === "number" ? scene.createdAt : Date.now(),
      updatedAt:
        typeof scene.updatedAt === "number" ? scene.updatedAt : Date.now(),
    }));

  if (!scenes.length) {
    return null;
  }

  const activeSceneId = scenes.some(
    (scene) => scene.id === rawStore.activeSceneId,
  )
    ? rawStore.activeSceneId!
    : scenes[0].id;

  return {
    version: 1,
    activeSceneId,
    scenes,
  };
};

export const readLocalSceneStore = (): LocalSceneStore | null => {
  try {
    const serialized = localStorage.getItem(
      STORAGE_KEYS.LOCAL_STORAGE_SCENE_LIST,
    );
    return serialized ? normalizeStore(JSON.parse(serialized)) : null;
  } catch (error: any) {
    console.error(error);
    return null;
  }
};

export const writeLocalSceneStore = (store: LocalSceneStore) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_SCENE_LIST,
      JSON.stringify(store),
    );
  } catch (error: any) {
    console.error(error);
  }
};

export const persistLocalSceneAsCurrent = (scene: LocalScene) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_ELEMENTS,
      JSON.stringify(scene.elements),
    );
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_APP_STATE,
      JSON.stringify(
        clearAppStateForLocalStorage({
          ...scene.appState,
          name: scene.name,
        }),
      ),
    );
    updateBrowserStateVersion(STORAGE_KEYS.VERSION_DATA_STATE);
  } catch (error: any) {
    console.error(error);
  }
};

export const initializeLocalSceneStore = (
  currentScene: SceneSnapshot,
): LocalSceneStore => {
  const existingStore = readLocalSceneStore();
  const store: LocalSceneStore = existingStore || {
    version: 1,
    scenes: [
      createLocalScene({
        name: currentScene.appState.name,
        ...currentScene,
      }),
    ],
    activeSceneId: "",
  };

  if (!store.activeSceneId) {
    store.activeSceneId = store.scenes[0].id;
  }

  const nextStore = saveLocalSceneSnapshot(
    store,
    store.activeSceneId,
    currentScene,
  );
  writeLocalSceneStore(nextStore);

  return nextStore;
};

export const saveLocalSceneSnapshot = (
  store: LocalSceneStore,
  sceneId: LocalScene["id"],
  snapshot: SceneSnapshot,
): LocalSceneStore => {
  const now = Date.now();
  return {
    ...store,
    scenes: store.scenes.map((scene) => {
      if (scene.id !== sceneId) {
        return scene;
      }

      return {
        ...scene,
        name: normalizeSceneName(scene.name || snapshot.appState.name),
        elements: [...snapshot.elements],
        appState: clearAppStateForLocalStorage({
          ...snapshot.appState,
          name: scene.name,
        }),
        updatedAt: now,
      };
    }),
  };
};

export const createNewLocalScene = (
  store: LocalSceneStore,
  opts: {
    name?: string;
    appState?: Partial<AppState>;
  } = {},
): LocalSceneStore => {
  const scene = createLocalScene({
    name: opts.name,
    elements: [],
    appState: {
      ...getDefaultAppState(),
      ...opts.appState,
      name: normalizeSceneName(opts.name),
    },
  });

  return {
    ...store,
    activeSceneId: scene.id,
    scenes: [scene, ...store.scenes],
  };
};

export const duplicateLocalScene = (
  store: LocalSceneStore,
  sceneId: LocalScene["id"],
): LocalSceneStore => {
  const scene = store.scenes.find((scene) => scene.id === sceneId);

  if (!scene) {
    return store;
  }

  const nextScene = createLocalScene({
    name: `${scene.name} copy`,
    elements: scene.elements,
    appState: {
      ...scene.appState,
      name: `${scene.name} copy`,
    },
  });

  return {
    ...store,
    activeSceneId: nextScene.id,
    scenes: [nextScene, ...store.scenes],
  };
};

export const renameLocalScene = (
  store: LocalSceneStore,
  sceneId: LocalScene["id"],
  name: string,
): LocalSceneStore => {
  const nextName = normalizeSceneName(name);
  return {
    ...store,
    scenes: store.scenes.map((scene) =>
      scene.id === sceneId
        ? {
            ...scene,
            name: nextName,
            appState: clearAppStateForLocalStorage({
              ...scene.appState,
              name: nextName,
            }),
            updatedAt: Date.now(),
          }
        : scene,
    ),
  };
};

export const deleteLocalScene = (
  store: LocalSceneStore,
  sceneId: LocalScene["id"],
): LocalSceneStore => {
  if (store.scenes.length <= 1) {
    return store;
  }

  const deletedSceneIndex = store.scenes.findIndex(
    (scene) => scene.id === sceneId,
  );
  const scenes = store.scenes.filter((scene) => scene.id !== sceneId);

  const activeSceneId =
    store.activeSceneId === sceneId
      ? scenes[Math.max(0, deletedSceneIndex - 1)]?.id || scenes[0].id
      : store.activeSceneId;

  return {
    ...store,
    activeSceneId,
    scenes,
  };
};

export const setActiveLocalScene = (
  store: LocalSceneStore,
  sceneId: LocalScene["id"],
): LocalSceneStore => {
  if (!store.scenes.some((scene) => scene.id === sceneId)) {
    return store;
  }

  return {
    ...store,
    activeSceneId: sceneId,
  };
};
