import LanguageDetector from "i18next-browser-languagedetector";
import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { trackEvent } from "../analytics";
import { getDefaultAppState } from "../appState";
import { ExcalidrawImperativeAPI } from "../components/App";
import { ErrorDialog } from "../components/ErrorDialog";
import { TopErrorBoundary } from "../components/TopErrorBoundary";
import { APP_NAME, EVENT, TITLE_TIMEOUT, VERSION_TIMEOUT } from "../constants";
import { DataState, ImportedDataState } from "../data/types";
import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "../element/types";
import { useCallbackRefState } from "../hooks/useCallbackRefState";
import { Language, t } from "../i18n";
import Excalidraw, {
  defaultLang,
  languages,
} from "../packages/excalidraw/index";
import { AppState } from "../types";
import {
  debounce,
  getVersion,
  ResolvablePromise,
  resolvablePromise,
} from "../utils";
import { SAVE_TO_LOCAL_STORAGE_TIMEOUT } from "./app_constants";
import CollabWrapper, {
  CollabAPI,
  CollabContext,
  CollabContextConsumer,
} from "./collab/CollabWrapper";
import { LanguageList } from "./components/LanguageList";
import { exportToBackend, getCollaborationLinkData, loadScene } from "./data";
import {
  importFromLocalStorage,
  saveToLocalStorage,
} from "./data/localStorage";

const languageDetector = new LanguageDetector();
languageDetector.init({
  languageUtils: {
    formatLanguageCode: (langCode: Language["code"]) => langCode,
    isWhitelisted: () => true,
  },
  checkWhitelist: false,
});

const saveDebounced = debounce(
  (elements: readonly ExcalidrawElement[], state: AppState) => {
    saveToLocalStorage(elements, state);
  },
  SAVE_TO_LOCAL_STORAGE_TIMEOUT,
);

const onBlur = () => {
  saveDebounced.flush();
};

const initializeScene = async (opts: {
  collabAPI: CollabAPI;
}): Promise<ImportedDataState | null> => {
  const searchParams = new URLSearchParams(window.location.search);
  const id = searchParams.get("id");
  const jsonMatch = window.location.hash.match(
    /^#json=([0-9]+),([a-zA-Z0-9_-]+)$/,
  );

  const initialData = importFromLocalStorage();

  let scene: DataState & { scrollToCenter?: boolean } = await loadScene(
    null,
    null,
    initialData,
  );

  let roomLinkData = getCollaborationLinkData(window.location.href);
  const isExternalScene = !!(id || jsonMatch || roomLinkData);
  if (isExternalScene) {
    if (
      // don't prompt if scene is empty
      !scene.elements.length ||
      // don't prompt for collab scenes because we don't override local storage
      roomLinkData ||
      // otherwise, prompt whether user wants to override current scene
      window.confirm(t("alerts.loadSceneOverridePrompt"))
    ) {
      // Backwards compatibility with legacy url format
      if (id) {
        scene = await loadScene(id, null, initialData);
      } else if (jsonMatch) {
        scene = await loadScene(jsonMatch[1], jsonMatch[2], initialData);
      }
      scene.scrollToCenter = true;
      if (!roomLinkData) {
        window.history.replaceState({}, APP_NAME, window.location.origin);
      }
    } else {
      // https://github.com/excalidraw/excalidraw/issues/1919
      if (document.hidden) {
        return new Promise((resolve, reject) => {
          window.addEventListener(
            "focus",
            () => initializeScene(opts).then(resolve).catch(reject),
            {
              once: true,
            },
          );
        });
      }

      roomLinkData = null;
      window.history.replaceState({}, APP_NAME, window.location.origin);
    }
  }
  if (roomLinkData) {
    return opts.collabAPI.initializeSocketClient(roomLinkData);
  } else if (scene) {
    return scene;
  }
  return null;
};

function ExcalidrawWrapper() {
  // dimensions
  // ---------------------------------------------------------------------------

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [errorMessage, setErrorMessage] = useState("");
  const currentLangCode = languageDetector.detect() || defaultLang.code;
  const [langCode, setLangCode] = useState(currentLangCode);

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

  useEffect(() => {
    // Delayed so that the app has a time to load the latest SW
    setTimeout(() => {
      trackEvent("load", "version", getVersion());
    }, VERSION_TIMEOUT);
  }, []);

  const [
    excalidrawAPI,
    excalidrawRefCallback,
  ] = useCallbackRefState<ExcalidrawImperativeAPI>();

  const collabAPI = useContext(CollabContext)?.api;

  useEffect(() => {
    if (!collabAPI || !excalidrawAPI) {
      return;
    }

    initializeScene({ collabAPI }).then((scene) => {
      initialStatePromiseRef.current.promise.resolve(scene);
    });

    const onHashChange = (_: HashChangeEvent) => {
      initializeScene({ collabAPI }).then((scene) => {
        if (scene) {
          excalidrawAPI.updateScene(scene);
        }
      });
    };

    const titleTimeout = setTimeout(
      () => (document.title = APP_NAME),
      TITLE_TIMEOUT,
    );
    window.addEventListener(EVENT.HASHCHANGE, onHashChange, false);
    window.addEventListener(EVENT.UNLOAD, onBlur, false);
    window.addEventListener(EVENT.BLUR, onBlur, false);
    return () => {
      window.removeEventListener(EVENT.HASHCHANGE, onHashChange, false);
      window.removeEventListener(EVENT.UNLOAD, onBlur, false);
      window.removeEventListener(EVENT.BLUR, onBlur, false);
      clearTimeout(titleTimeout);
    };
  }, [collabAPI, excalidrawAPI]);

  useEffect(() => {
    languageDetector.cacheUserLanguage(langCode);
  }, [langCode]);

  const onChange = (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
  ) => {
    if (collabAPI?.isCollaborating()) {
      collabAPI.broadcastElements(elements);
    } else {
      // collab scenes are persisted to the server, so we don't have to persist
      // them locally, which has the added benefit of not overwriting whatever
      // the user was working on before joining
      saveDebounced(elements, appState);
    }
  };

  const onExportToBackend = async (
    exportedElements: readonly NonDeletedExcalidrawElement[],
    appState: AppState,
    canvas: HTMLCanvasElement | null,
  ) => {
    if (exportedElements.length === 0) {
      return window.alert(t("alerts.cannotExportEmptyCanvas"));
    }
    if (canvas) {
      try {
        await exportToBackend(exportedElements, {
          ...appState,
          viewBackgroundColor: appState.exportBackground
            ? appState.viewBackgroundColor
            : getDefaultAppState().viewBackgroundColor,
        });
      } catch (error) {
        if (error.name !== "AbortError") {
          const { width, height } = canvas;
          console.error(error, { width, height });
          setErrorMessage(error.message);
        }
      }
    }
  };

  const renderFooter = useCallback(
    (isMobile: boolean) => {
      const renderLanguageList = () => (
        <LanguageList
          onChange={(langCode) => {
            setLangCode(langCode);
          }}
          languages={languages}
          floating={!isMobile}
          currentLangCode={langCode}
        />
      );
      if (isMobile) {
        return (
          <fieldset>
            <legend>{t("labels.language")}</legend>
            {renderLanguageList()}
          </fieldset>
        );
      }
      return renderLanguageList();
    },
    [langCode],
  );

  return (
    <>
      <Excalidraw
        ref={excalidrawRefCallback}
        onChange={onChange}
        width={dimensions.width}
        height={dimensions.height}
        initialData={initialStatePromiseRef.current.promise}
        onCollabButtonClick={collabAPI?.onCollabButtonClick}
        isCollaborating={collabAPI?.isCollaborating()}
        onPointerUpdate={collabAPI?.onPointerUpdate}
        onExportToBackend={onExportToBackend}
        renderFooter={renderFooter}
        langCode={langCode}
      />
      {excalidrawAPI && <CollabWrapper excalidrawAPI={excalidrawAPI} />}
      {errorMessage && (
        <ErrorDialog
          message={errorMessage}
          onClose={() => setErrorMessage("")}
        />
      )}
    </>
  );
}

export default function ExcalidrawApp() {
  return (
    <TopErrorBoundary>
      <CollabContextConsumer>
        <ExcalidrawWrapper />
      </CollabContextConsumer>
    </TopErrorBoundary>
  );
}
