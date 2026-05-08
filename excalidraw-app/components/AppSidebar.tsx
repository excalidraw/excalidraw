import { useCallback, useEffect, useState } from "react";

import {
  CaptureUpdateAction,
  DefaultSidebar,
  Sidebar,
  THEME,
  restoreAppState,
  restoreElements,
  useExcalidrawAPI,
} from "@excalidraw/excalidraw";
import { isInitializedImageElement } from "@excalidraw/element";
import {
  PlusIcon,
  TrashIcon,
  copyIcon,
  file,
  messageCircleIcon,
  presentationIcon,
} from "@excalidraw/excalidraw/components/icons";
import { LinkButton } from "@excalidraw/excalidraw/components/LinkButton";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";

import type { FileId } from "@excalidraw/element/types";

import {
  createNewLocalScene,
  DEFAULT_LOCAL_SCENE_NAME,
  deleteLocalScene,
  duplicateLocalScene,
  initializeLocalSceneStore,
  persistLocalSceneAsCurrent,
  renameLocalScene,
  saveLocalSceneSnapshot,
  setActiveLocalScene,
  type LocalScene,
  type LocalSceneStore,
  writeLocalSceneStore,
} from "../data/localSceneStorage";

import { LocalData } from "../data/LocalData";
import { updateStaleImageStatuses } from "../data/FileManager";

import "./AppSidebar.scss";

const DRAWINGS_SIDEBAR_TAB = "drawings";

const formatSceneUpdatedAt = (updatedAt: number) => {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(updatedAt);
};

const getNextSceneName = (store: LocalSceneStore | null) => {
  const names = new Set(store?.scenes.map((scene) => scene.name));
  let index = (store?.scenes.length || 0) + 1;
  let name = `${DEFAULT_LOCAL_SCENE_NAME} ${index}`;

  while (names.has(name)) {
    index++;
    name = `${DEFAULT_LOCAL_SCENE_NAME} ${index}`;
  }

  return name;
};

const getCurrentSceneSnapshot = (
  excalidrawAPI: NonNullable<ReturnType<typeof useExcalidrawAPI>>,
) => ({
  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
  appState: excalidrawAPI.getAppState(),
});

const getSceneFileIds = (scene: LocalScene) => {
  const fileIds = new Set<FileId>();

  for (const element of scene.elements) {
    if (isInitializedImageElement(element)) {
      fileIds.add(element.fileId);
    }
  }

  return [...fileIds];
};

const DrawingsSidebarTab = ({
  isCollaborating,
}: {
  isCollaborating: boolean;
}) => {
  const excalidrawAPI = useExcalidrawAPI();
  const [sceneStore, setSceneStore] = useState<LocalSceneStore | null>(null);

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }

    const store = initializeLocalSceneStore(
      getCurrentSceneSnapshot(excalidrawAPI),
    );
    setSceneStore(store);
  }, [excalidrawAPI]);

  const persistStore = useCallback((store: LocalSceneStore) => {
    writeLocalSceneStore(store);
    setSceneStore(store);
    return store;
  }, []);

  const saveCurrentScene = useCallback(() => {
    if (!excalidrawAPI || !sceneStore) {
      return sceneStore;
    }

    const nextStore = saveLocalSceneSnapshot(
      sceneStore,
      sceneStore.activeSceneId,
      getCurrentSceneSnapshot(excalidrawAPI),
    );

    const activeScene = nextStore.scenes.find(
      (scene) => scene.id === nextStore.activeSceneId,
    );

    if (activeScene) {
      persistLocalSceneAsCurrent(activeScene);
    }

    return persistStore(nextStore);
  }, [excalidrawAPI, persistStore, sceneStore]);

  const loadSceneFiles = useCallback(
    (scene: LocalScene) => {
      if (!excalidrawAPI) {
        return;
      }

      const fileIds = getSceneFileIds(scene);
      if (!fileIds.length) {
        return;
      }

      LocalData.fileStorage
        .getFiles(fileIds)
        .then(({ loadedFiles, erroredFiles }) => {
          if (loadedFiles.length) {
            excalidrawAPI.addFiles(loadedFiles);
          }
          if (erroredFiles.size) {
            updateStaleImageStatuses({
              excalidrawAPI,
              erroredFiles,
              elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
            });
          }
        });
    },
    [excalidrawAPI],
  );

  const loadScene = useCallback(
    (scene: LocalScene) => {
      if (!excalidrawAPI) {
        return;
      }

      persistLocalSceneAsCurrent(scene);

      const appState = restoreAppState(
        {
          ...scene.appState,
          name: scene.name,
          openSidebar: { name: "default", tab: DRAWINGS_SIDEBAR_TAB },
        },
        excalidrawAPI.getAppState(),
      );

      excalidrawAPI.updateScene({
        elements: restoreElements(scene.elements, null, {
          repairBindings: true,
          deleteInvisibleElements: true,
        }),
        appState: {
          ...appState,
          isLoading: false,
          openSidebar: { name: "default", tab: DRAWINGS_SIDEBAR_TAB },
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      excalidrawAPI.history.clear();
      loadSceneFiles(scene);
      excalidrawAPI.setToast({ message: `Switched to ${scene.name}` });
    },
    [excalidrawAPI, loadSceneFiles],
  );

  const switchScene = useCallback(
    (sceneId: LocalScene["id"]) => {
      if (
        !sceneStore ||
        !excalidrawAPI ||
        sceneId === sceneStore.activeSceneId
      ) {
        return;
      }

      const savedStore = saveCurrentScene();
      if (!savedStore) {
        return;
      }

      const nextStore = persistStore(setActiveLocalScene(savedStore, sceneId));
      const scene = nextStore.scenes.find((scene) => scene.id === sceneId);

      if (scene) {
        loadScene(scene);
      }
    },
    [excalidrawAPI, loadScene, persistStore, saveCurrentScene, sceneStore],
  );

  const createScene = useCallback(() => {
    if (!sceneStore || !excalidrawAPI) {
      return;
    }

    const savedStore = saveCurrentScene();
    if (!savedStore) {
      return;
    }

    const nextStore = persistStore(
      createNewLocalScene(savedStore, {
        name: getNextSceneName(savedStore),
        appState: {
          theme: excalidrawAPI.getAppState().theme,
          openSidebar: { name: "default", tab: DRAWINGS_SIDEBAR_TAB },
        },
      }),
    );
    const scene = nextStore.scenes.find(
      (scene) => scene.id === nextStore.activeSceneId,
    );

    if (scene) {
      loadScene(scene);
    }
  }, [excalidrawAPI, loadScene, persistStore, saveCurrentScene, sceneStore]);

  const duplicateScene = useCallback(
    (sceneId: LocalScene["id"]) => {
      if (!sceneStore) {
        return;
      }

      const savedStore = saveCurrentScene();
      if (!savedStore) {
        return;
      }

      const nextStore = persistStore(duplicateLocalScene(savedStore, sceneId));
      const scene = nextStore.scenes.find(
        (scene) => scene.id === nextStore.activeSceneId,
      );

      if (scene) {
        loadScene(scene);
      }
    },
    [loadScene, persistStore, saveCurrentScene, sceneStore],
  );

  const renameScene = useCallback(
    (sceneId: LocalScene["id"]) => {
      const scene = sceneStore?.scenes.find((scene) => scene.id === sceneId);
      if (!scene) {
        return;
      }

      const name = window.prompt("Rename drawing", scene.name);
      if (name === null) {
        return;
      }

      const savedStore = saveCurrentScene();
      if (!savedStore) {
        return;
      }

      const nextStore = persistStore(
        renameLocalScene(savedStore, sceneId, name),
      );
      const renamedScene = nextStore.scenes.find(
        (scene) => scene.id === sceneId,
      );

      if (
        renamedScene &&
        sceneId === nextStore.activeSceneId &&
        excalidrawAPI
      ) {
        persistLocalSceneAsCurrent(renamedScene);
        excalidrawAPI.updateScene({
          appState: { name: renamedScene.name },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      }
    },
    [excalidrawAPI, persistStore, saveCurrentScene, sceneStore],
  );

  const removeScene = useCallback(
    (sceneId: LocalScene["id"]) => {
      if (!sceneStore || sceneStore.scenes.length <= 1) {
        return;
      }

      const scene = sceneStore.scenes.find((scene) => scene.id === sceneId);
      if (!scene || !window.confirm(`Delete "${scene.name}"?`)) {
        return;
      }

      const savedStore = saveCurrentScene();
      if (!savedStore) {
        return;
      }

      const nextStore = persistStore(deleteLocalScene(savedStore, sceneId));
      const activeScene = nextStore.scenes.find(
        (scene) => scene.id === nextStore.activeSceneId,
      );

      if (activeScene && sceneId === savedStore.activeSceneId) {
        loadScene(activeScene);
      }
    },
    [loadScene, persistStore, saveCurrentScene, sceneStore],
  );

  return (
    <div className="app-sidebar-drawings">
      <div className="app-sidebar-drawings__toolbar">
        <h3>Drawings</h3>
        <button
          className="app-sidebar-drawings__icon-button"
          type="button"
          title="New drawing"
          aria-label="New drawing"
          onClick={createScene}
          disabled={!sceneStore || isCollaborating}
        >
          {PlusIcon}
        </button>
      </div>

      {isCollaborating && (
        <div className="app-sidebar-drawings__notice">
          Drawing switching is paused during live collaboration.
        </div>
      )}

      <div className="app-sidebar-drawings__list">
        {sceneStore?.scenes.map((scene) => {
          const isActive = scene.id === sceneStore.activeSceneId;

          return (
            <div
              className="app-sidebar-drawings__item"
              data-active={isActive}
              key={scene.id}
            >
              <button
                className="app-sidebar-drawings__item-main"
                type="button"
                onClick={() => switchScene(scene.id)}
                onDoubleClick={() => renameScene(scene.id)}
                disabled={isCollaborating}
                title="Double-click to rename"
              >
                <span className="app-sidebar-drawings__item-icon">{file}</span>
                <span className="app-sidebar-drawings__item-text">
                  <span className="app-sidebar-drawings__item-name">
                    {scene.name}
                  </span>
                  <span className="app-sidebar-drawings__item-meta">
                    {scene.elements.filter((element) => !element.isDeleted)
                      .length || 0}{" "}
                    elements - {formatSceneUpdatedAt(scene.updatedAt)}
                  </span>
                </span>
              </button>
              <div className="app-sidebar-drawings__item-actions">
                <button
                  type="button"
                  className="app-sidebar-drawings__icon-button"
                  title="Duplicate"
                  aria-label="Duplicate"
                  onClick={() => duplicateScene(scene.id)}
                  disabled={isCollaborating}
                >
                  {copyIcon}
                </button>
                <button
                  type="button"
                  className="app-sidebar-drawings__icon-button"
                  title="Delete"
                  aria-label="Delete"
                  onClick={() => removeScene(scene.id)}
                  disabled={isCollaborating || sceneStore.scenes.length <= 1}
                >
                  {TrashIcon}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const AppSidebar = ({
  isCollaborating,
}: {
  isCollaborating: boolean;
}) => {
  const { theme, openSidebar } = useUIAppState();

  return (
    <DefaultSidebar>
      <DefaultSidebar.TabTriggers>
        <Sidebar.TabTrigger
          tab={DRAWINGS_SIDEBAR_TAB}
          style={{
            opacity: openSidebar?.tab === DRAWINGS_SIDEBAR_TAB ? 1 : 0.4,
          }}
          title="Drawings"
        >
          {file}
        </Sidebar.TabTrigger>
        <Sidebar.TabTrigger
          tab="comments"
          style={{ opacity: openSidebar?.tab === "comments" ? 1 : 0.4 }}
        >
          {messageCircleIcon}
        </Sidebar.TabTrigger>
        <Sidebar.TabTrigger
          tab="presentation"
          style={{ opacity: openSidebar?.tab === "presentation" ? 1 : 0.4 }}
        >
          {presentationIcon}
        </Sidebar.TabTrigger>
      </DefaultSidebar.TabTriggers>
      <Sidebar.Tab tab={DRAWINGS_SIDEBAR_TAB}>
        <DrawingsSidebarTab isCollaborating={isCollaborating} />
      </Sidebar.Tab>
      <Sidebar.Tab tab="comments">
        <div className="app-sidebar-promo-container">
          <div
            className="app-sidebar-promo-image"
            style={{
              ["--image-source" as any]: `url(/oss_promo_comments_${
                theme === THEME.DARK ? "dark" : "light"
              }.jpg)`,
              opacity: 0.7,
            }}
          />
          <div className="app-sidebar-promo-text">
            Make comments with Excalidraw+
          </div>
          <LinkButton
            href={`${
              import.meta.env.VITE_APP_PLUS_LP
            }/plus?utm_source=excalidraw&utm_medium=app&utm_content=comments_promo#excalidraw-redirect`}
          >
            Sign up now
          </LinkButton>
        </div>
      </Sidebar.Tab>
      <Sidebar.Tab tab="presentation" className="px-3">
        <div className="app-sidebar-promo-container">
          <div
            className="app-sidebar-promo-image"
            style={{
              ["--image-source" as any]: `url(/oss_promo_presentations_${
                theme === THEME.DARK ? "dark" : "light"
              }.svg)`,
              backgroundSize: "60%",
              opacity: 0.4,
            }}
          />
          <div className="app-sidebar-promo-text">
            Create presentations with Excalidraw+
          </div>
          <LinkButton
            href={`${
              import.meta.env.VITE_APP_PLUS_LP
            }/plus?utm_source=excalidraw&utm_medium=app&utm_content=presentations_promo#excalidraw-redirect`}
          >
            Sign up now
          </LinkButton>
        </div>
      </Sidebar.Tab>
    </DefaultSidebar>
  );
};
