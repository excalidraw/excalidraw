import React, { useState, useLayoutEffect, useEffect, useRef } from "react";

import Excalidraw from "../packages/excalidraw/index";

import {
  getTotalStorageSize,
  importFromLocalStorage,
  saveToLocalStorage,
  STORAGE_KEYS,
} from "./data/localStorage";

import { ImportedDataState } from "../data/types";
import CollabWrapper, { CollabAPI } from "./collab/CollabWrapper";
import { TopErrorBoundary } from "../components/TopErrorBoundary";
import { t } from "../i18n";
import { loadScene } from "./data";
import { getCollaborationLinkData } from "./data";
import { EVENT } from "../constants";
import { loadFromFirebase } from "./data/firebase";
import { ExcalidrawImperativeAPI } from "../components/App";
import { debounce, ResolvablePromise, resolvablePromise } from "../utils";
import { AppState, ExcalidrawAPIRefValue } from "../types";
import { ExcalidrawElement } from "../element/types";
import { SAVE_TO_LOCAL_STORAGE_TIMEOUT } from "./app_constants";
import { EVENT_LOAD, EVENT_SHARE, trackEvent } from "../analytics";

const excalidrawRef: React.MutableRefObject<ExcalidrawAPIRefValue> = {
  current: {
    readyPromise: resolvablePromise(),
    ready: false,
  },
};

const saveDebounced = debounce(
  (elements: readonly ExcalidrawElement[], state: AppState) => {
    saveToLocalStorage(elements, state);
  },
  SAVE_TO_LOCAL_STORAGE_TIMEOUT,
);

const onBlur = () => {
  saveDebounced.flush();
};

const shouldForceLoadScene = (
  scene: ResolutionType<typeof loadScene>,
): boolean => {
  if (!scene.elements.length) {
    return true;
  }

  const roomMatch = getCollaborationLinkData(window.location.href);

  if (!roomMatch) {
    return false;
  }

  const roomId = roomMatch[1];

  let collabForceLoadFlag;
  try {
    collabForceLoadFlag = localStorage?.getItem(
      STORAGE_KEYS.LOCAL_STORAGE_KEY_COLLAB_FORCE_FLAG,
    );
  } catch {}

  if (collabForceLoadFlag) {
    try {
      const {
        room: previousRoom,
        timestamp,
      }: { room: string; timestamp: number } = JSON.parse(collabForceLoadFlag);
      // if loading same room as the one previously unloaded within 15sec
      //  force reload without prompting
      if (previousRoom === roomId && Date.now() - timestamp < 15000) {
        return true;
      }
    } catch {}
  }
  return false;
};

type Scene = ImportedDataState & { commitToHistory: boolean };

const initializeScene = async (opts: {
  resetScene: ExcalidrawImperativeAPI["resetScene"];
  initializeSocketClient: CollabAPI["initializeSocketClient"];
  onLateInitialization?: (scene: Scene) => void;
}): Promise<Scene | null> => {
  const searchParams = new URLSearchParams(window.location.search);
  const id = searchParams.get("id");
  const jsonMatch = window.location.hash.match(
    /^#json=([0-9]+),([a-zA-Z0-9_-]+)$/,
  );

  const initialData = importFromLocalStorage();

  let scene = await loadScene(null, null, initialData);

  let isCollabScene = !!getCollaborationLinkData(window.location.href);
  const isExternalScene = !!(id || jsonMatch || isCollabScene);
  if (isExternalScene) {
    if (
      shouldForceLoadScene(scene) ||
      window.confirm(t("alerts.loadSceneOverridePrompt"))
    ) {
      // Backwards compatibility with legacy url format
      if (id) {
        scene = await loadScene(id, null, initialData);
      } else if (jsonMatch) {
        scene = await loadScene(jsonMatch[1], jsonMatch[2], initialData);
      }
      if (!isCollabScene) {
        window.history.replaceState({}, "Excalidraw", window.location.origin);
      }
    } else {
      // https://github.com/excalidraw/excalidraw/issues/1919
      if (document.hidden) {
        window.addEventListener(
          "focus",
          () =>
            initializeScene(opts).then((_scene) => {
              opts?.onLateInitialization?.(_scene || scene);
            }),
          {
            once: true,
          },
        );
        return null;
      }

      isCollabScene = false;
      window.history.replaceState({}, "Excalidraw", window.location.origin);
    }
  }
  if (isCollabScene) {
    // when joining a room we don't want user's local scene data to be merged
    // into the remote scene
    opts.resetScene();
    const scenePromise = opts.initializeSocketClient();
    trackEvent(EVENT_SHARE, "session join");

    try {
      const [, roomId, roomKey] = getCollaborationLinkData(
        window.location.href,
      )!;
      const elements = await loadFromFirebase(roomId, roomKey);
      if (elements) {
        return {
          elements,
          commitToHistory: true,
        };
      }

      return {
        ...(await scenePromise),
        commitToHistory: true,
      };
    } catch (error) {
      // log the error and move on. other peers will sync us the scene.
      console.error(error);
    }

    return null;
  } else if (scene) {
    return scene;
  }
  return null;
};

function ExcalidrawWrapper(props: { collab: CollabAPI }) {
  // dimensions
  // ---------------------------------------------------------------------------

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useLayoutEffect(() => {
    const onResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);

  // initial state
  // ---------------------------------------------------------------------------

  const initialStatePromiseRef = useRef<{
    promise: ResolvablePromise<ImportedDataState | null>;
  }>({ promise: null! });
  if (!initialStatePromiseRef.current.promise) {
    initialStatePromiseRef.current.promise = resolvablePromise<ImportedDataState | null>();
  }

  const { collab } = props;

  useEffect(() => {
    const storageSize = getTotalStorageSize();
    if (storageSize) {
      trackEvent(EVENT_LOAD, "storage", "size", storageSize);
    } else {
      trackEvent(EVENT_LOAD, "first time");
    }
    excalidrawRef.current!.readyPromise.then((excalidrawApi) => {
      initializeScene({
        resetScene: excalidrawApi.resetScene,
        initializeSocketClient: collab.initializeSocketClient,
        onLateInitialization: (scene) => {
          initialStatePromiseRef.current.promise.resolve(scene);
        },
      }).then((scene) => {
        initialStatePromiseRef.current.promise.resolve(scene);
      });
    });

    const onHashChange = (_: HashChangeEvent) => {
      const api = excalidrawRef.current!;
      if (!api.ready) {
        return;
      }
      if (window.location.hash.length > 1) {
        initializeScene({
          resetScene: api.resetScene,
          initializeSocketClient: collab.initializeSocketClient,
        }).then((scene) => {
          if (scene) {
            api.updateScene(scene);
          }
        });
      }
    };

    window.addEventListener(EVENT.HASHCHANGE, onHashChange, false);
    window.addEventListener(EVENT.UNLOAD, onBlur, false);
    window.addEventListener(EVENT.BLUR, onBlur, false);
    return () => {
      window.removeEventListener(EVENT.HASHCHANGE, onHashChange, false);
      window.removeEventListener(EVENT.UNLOAD, onBlur, false);
      window.removeEventListener(EVENT.BLUR, onBlur, false);
    };
  }, [collab.initializeSocketClient]);

  const onChange = (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
  ) => {
    saveDebounced(elements, appState);
    if (collab.isCollaborating) {
      collab.broadcastElements(elements, appState);
    }
  };

  return (
    <Excalidraw
      ref={excalidrawRef}
      onChange={onChange}
      width={dimensions.width}
      height={dimensions.height}
      initialData={initialStatePromiseRef.current.promise}
      user={{ name: collab.username }}
      onCollabButtonClick={collab.onCollabButtonClick}
      isCollaborating={collab.isCollaborating}
      onPointerUpdate={collab.onPointerUpdate}
    />
  );
}

export default function ExcalidrawApp() {
  return (
    <TopErrorBoundary>
      <CollabWrapper
        excalidrawRef={
          excalidrawRef as React.MutableRefObject<ExcalidrawImperativeAPI>
        }
      >
        {(collab) => <ExcalidrawWrapper collab={collab} />}
      </CollabWrapper>
    </TopErrorBoundary>
  );
}
