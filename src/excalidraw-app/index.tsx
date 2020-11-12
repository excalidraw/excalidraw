import React, {
  useState,
  useLayoutEffect,
  useEffect,
  useContext,
  useRef,
} from "react";

import Excalidraw from "../packages/excalidraw/index";

import {
  importFromLocalStorage,
  saveToLocalStorage,
} from "../data/localStorage";

import { ImportedDataState } from "../data/types";
import CollabWrapper, { CollabContext } from "./collab/CollabWrapper";
import { TopErrorBoundary } from "../components/TopErrorBoundary";
import { t } from "../i18n";
import { loadScene } from "../data";
import { getCollaborationLinkData } from "./data";
import { EVENT, LOCAL_STORAGE_KEY_COLLAB_FORCE_FLAG } from "../constants";
import { SAVE_TO_LOCAL_STORAGE_TIMEOUT } from "../time_constants";
import { loadFromFirebase } from "./data/firebase";
import { restore } from "../data/restore";
import { ExcalidrawImperativeAPI } from "../components/App";
import { debounce, resolvablePromise, withBatchedUpdates } from "../utils";
import { AppState, ExcalidrawAPIRefValue, ExcalidrawProps } from "../types";
import { ExcalidrawElement } from "../element/types";

const excalidrawRef: ExcalidrawAPIRefValue = {
  readyPromise: resolvablePromise(),
  ready: false,
};

const context = React.createContext(excalidrawRef);

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

  const roomID = roomMatch[1];

  let collabForceLoadFlag;
  try {
    collabForceLoadFlag = localStorage?.getItem(
      LOCAL_STORAGE_KEY_COLLAB_FORCE_FLAG,
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
      if (previousRoom === roomID && Date.now() - timestamp < 15000) {
        return true;
      }
    } catch {}
  }
  return false;
};

type Scene = ResolutionType<typeof loadScene>;

const initializeScene = async (opts: {
  resetScene: ExcalidrawImperativeAPI["resetScene"];
  initializeSocketClient: (opts: any) => Promise<ImportedDataState | null>;
  onLateInitialization?: (data: { scene: Scene }) => void;
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
              opts?.onLateInitialization?.({ scene: _scene || scene });
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
    //  into the remote scene
    opts.resetScene();
    const scenePromise = opts.initializeSocketClient({
      showLoadingState: true,
    });

    try {
      const [, roomID, roomKey] = getCollaborationLinkData(
        window.location.href,
      )!;
      const elements = await loadFromFirebase(roomID, roomKey);
      if (elements) {
        return {
          ...restore({ elements }, scene.appState),
          commitToHistory: true,
        };
      }

      return {
        ...restore(
          {
            ...(await scenePromise),
          },
          scene.appState,
        ),
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

function ExcalidrawApp(props: {
  collab: CollabContext;
  testProps?: Partial<ExcalidrawProps>;
}) {
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

  const initialStatePromiseRef = useRef(
    resolvablePromise<ImportedDataState | null>(),
  );

  const excalidrawRef = useContext(context) as ExcalidrawAPIRefValue;
  const { collab } = props;

  useEffect(() => {
    excalidrawRef.readyPromise.then((excalidrawApi) => {
      initializeScene({
        resetScene: excalidrawApi.resetScene,
        initializeSocketClient: collab.initializeSocketClient,
        onLateInitialization: ({ scene }) => {
          initialStatePromiseRef.current.resolve(scene);
        },
      }).then((scene) => {
        initialStatePromiseRef.current.resolve(scene);
      });
    });

    const onHashChange = (_: HashChangeEvent) => {
      const api = excalidrawRef;
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

    const beforeUnload = withBatchedUpdates(() => {
      if (collab.isCollaborating || collab.roomId) {
        try {
          localStorage?.setItem(
            LOCAL_STORAGE_KEY_COLLAB_FORCE_FLAG,
            JSON.stringify({
              timestamp: Date.now(),
              room: collab.roomId,
            }),
          );
        } catch {}
      }
    });

    window.addEventListener(EVENT.HASHCHANGE, onHashChange, false);
    window.addEventListener(EVENT.BEFORE_UNLOAD, beforeUnload);
    window.addEventListener(EVENT.UNLOAD, onBlur, false);
    window.addEventListener(EVENT.BLUR, onBlur, false);
    return () => {
      window.removeEventListener(EVENT.HASHCHANGE, onHashChange, false);
      window.removeEventListener(EVENT.BEFORE_UNLOAD, beforeUnload);
      window.removeEventListener(EVENT.UNLOAD, onBlur, false);
      window.removeEventListener(EVENT.BLUR, onBlur, false);
    };
  }, [
    excalidrawRef,
    collab.initializeSocketClient,
    collab.isCollaborating,
    collab.roomId,
  ]);

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
      excalidrawRef={excalidrawRef}
      onChange={onChange}
      width={dimensions.width}
      height={dimensions.height}
      initialData={initialStatePromiseRef.current}
      user={{ name: collab.username }}
      onCollabButtonClick={collab.onCollabButtonClick}
      isCollaborating={collab.isCollaborating}
      onPointerUpdate={collab.onPointerUpdate}
      {...props.testProps}
    />
  );
}

const AppWithCollab = (Component: typeof ExcalidrawApp) => {
  return <K extends keyof ExcalidrawProps>(props: {
    /** for testing purposes */
    testProps?: Pick<ExcalidrawProps, K>;
  }) => {
    return (
      <TopErrorBoundary>
        <context.Provider value={excalidrawRef}>
          <CollabWrapper excalidrawRef={excalidrawRef}>
            {(collab: CollabContext) => {
              return <Component collab={collab} testProps={props.testProps} />;
            }}
          </CollabWrapper>
        </context.Provider>
        ;
      </TopErrorBoundary>
    );
  };
};

export default AppWithCollab(ExcalidrawApp);
