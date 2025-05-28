
import {
  Excalidraw,
  LiveCollaborationTrigger,
  TTDDialogTrigger,
  CaptureUpdateAction,
  reconcileElements,
} from "@excalidraw/excalidraw";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import {
  CommandPalette,
  DEFAULT_CATEGORIES,
} from "@excalidraw/excalidraw/components/CommandPalette/CommandPalette";
import { ErrorDialog } from "@excalidraw/excalidraw/components/ErrorDialog";
import { OverwriteConfirmDialog } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirm";
import { openConfirmModal } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";
import { ShareableLinkDialog } from "@excalidraw/excalidraw/components/ShareableLinkDialog";
import Trans from "@excalidraw/excalidraw/components/Trans";
import {
  APP_NAME,
  EVENT,
  THEME,
  TITLE_TIMEOUT,
  VERSION_TIMEOUT,
  debounce,
  getVersion,
  getFrame,
  isTestEnv,
  preventUnload,
  resolvablePromise,
  isRunningInIframe,
  isDevEnv,
  FONT_FAMILY,
} from "@excalidraw/common";
import polyfill from "@excalidraw/excalidraw/polyfill";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { useCallbackRefState } from "@excalidraw/excalidraw/hooks/useCallbackRefState";
import { t } from "@excalidraw/excalidraw/i18n";

import { newRabbitSearchBoxElement, newRabbitImageElement, newRabbitImageTabsElement } from "@excalidraw/element/newRabbitElement";

import {
  GithubIcon,
  XBrandIcon,
  DiscordIcon,
  ExcalLogo,
  usersIcon,
  exportToPlus,
  share,
  youtubeIcon,
} from "@excalidraw/excalidraw/components/icons";
import { isElementLink } from "@excalidraw/element";
import { restore, restoreAppState } from "@excalidraw/excalidraw/data/restore";
import { newElementWith } from "@excalidraw/element";
import { isInitializedImageElement } from "@excalidraw/element";
import clsx from "clsx";
import {
  parseLibraryTokensFromUrl,
  useHandleLibrary,
} from "@excalidraw/excalidraw/data/library";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type { RestoredDataState } from "@excalidraw/excalidraw/data/restore";
import type {
  FileId,
  NonDeletedExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  ExcalidrawImperativeAPI,
  BinaryFiles,
  ExcalidrawInitialDataState,
  UIAppState,
} from "@excalidraw/excalidraw/types";
import type { ResolutionType } from "@excalidraw/common/utility-types";
import type { ResolvablePromise } from "@excalidraw/common/utils";
// import { 
//   handleRabbitSearchBoxClick, 
//   handleRabbitSearchBoxKeyDown 
// } from "@excalidraw/element/rabbitElementHandlers";
import { isRabbitSearchBoxElement } from "@excalidraw/element/rabbitElement";
import { getSearchBoxText } from "@excalidraw/element/newRabbitElement";
import { useRabbitSearchBoxHandlers } from "@excalidraw/element/rabbitElementHandlers";

import CustomStats from "./CustomStats";
import {
  Provider,
  useAtom,
  useAtomValue,
  useAtomWithInitialValue,
  appJotaiStore,
} from "./app-jotai";
import {
  FIREBASE_STORAGE_PREFIXES,
  isExcalidrawPlusSignedUser,
  STORAGE_KEYS,
  SYNC_BROWSER_TABS_TIMEOUT,
} from "./app_constants";
import Collab, {
  collabAPIAtom,
  isCollaboratingAtom,
  isOfflineAtom,
} from "./collab/Collab";
import { AppFooter } from "./components/AppFooter";
import { AppHeader } from "./components/AppHeader";
import { AppMainMenu } from "./components/AppMainMenu";
import { AppWelcomeScreen } from "./components/AppWelcomeScreen";
import {
  ExportToExcalidrawPlus,
  exportToExcalidrawPlus,
} from "./components/ExportToExcalidrawPlus";
import { TopErrorBoundary } from "./components/TopErrorBoundary";

import {
  exportToBackend,
  getCollaborationLinkData,
  isCollaborationLink,
  loadScene,
} from "./data";

import { updateStaleImageStatuses } from "./data/FileManager";
import {
  importFromLocalStorage,
  importUsernameFromLocalStorage,
} from "./data/localStorage";

import { loadFilesFromFirebase } from "./data/firebase";
import {
  LibraryIndexedDBAdapter,
  LibraryLocalStorageMigrationAdapter,
  LocalData,
} from "./data/LocalData";
import { isBrowserStorageStateNewer } from "./data/tabSync";
import { ShareDialog, shareDialogStateAtom } from "./share/ShareDialog";
import CollabError, { collabErrorIndicatorAtom } from "./collab/CollabError";
import { useHandleAppTheme } from "./useHandleAppTheme";
import { getPreferredLanguage } from "./app-language/language-detector";
import { useAppLangCode } from "./app-language/language-state";
import DebugCanvas, {
  debugRenderer,
  isVisualDebuggerEnabled,
  loadSavedDebugState,
} from "./components/DebugCanvas";
import { AIComponents } from "./components/AI";
import { ExcalidrawPlusIframeExport } from "./ExcalidrawPlusIframeExport";

import "./index.scss";

import type { CollabAPI } from "./collab/Collab";

import { searchAndSaveImages } from '../scripts/rabbit_scripts/try_again';
import type { RabbitSearchBoxElement } from "../packages/element/src/rabbitElement";
import { RabbitElementBase, RabbitImageElement } from "../packages/element/src/rabbitElement";

import { RabbitImageWindow } from "@excalidraw/element/RabbitImageWindow";
// for rabbit image window





import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY
});
async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: "Hello there",
    config: {
      systemInstruction: "You are a cat. Your name is Neko.",
    },
  });
  console.log(response.text);
}

async function generateBetterSearchQuery(originalSearch: string, extension: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `You are a search query optimizer. I will give you two strings:
1. An initial search query
2. An extension/modifier for that search

Your job is to combine them into a single, natural-sounding search query that makes grammatical sense and captures the user's intent.

Rules:
- Adjectives (colors, styles, sizes) usually go BEFORE nouns
- Be concise - avoid redundant words
- Maintain the core meaning of both inputs
- Make it sound like something a human would actually search for

Examples:
Initial: "house" + Extension: "modern" → "modern house"
Initial: "cute kitty" + Extension: "brown" → "cute brown kitty"
Initial: "car" + Extension: "red sports" → "red sports car"
Initial: "pizza recipe" + Extension: "vegetarian" → "vegetarian pizza recipe"
Initial: "dog training" + Extension: "puppy" → "puppy training"

Now combine these:
Initial: "${originalSearch}"
Extension: "${extension}"

Output only the combined search query, nothing else.`,
      config: {
        systemInstruction: "You are a helpful assistant that creates natural search queries. Only respond with the optimized search query.",
      },
    });

    const rawText = response.text ?? "";
    return rawText.trim();
  } catch (error) {
    console.error("Error generating better search query:", error);
    return `${extension} ${originalSearch}`;
  }
}


polyfill();

window.EXCALIDRAW_THROTTLE_RENDER = true;

declare global {
  interface BeforeInstallPromptEventChoiceResult {
    outcome: "accepted" | "dismissed";
  }

  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<BeforeInstallPromptEventChoiceResult>;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

let pwaEvent: BeforeInstallPromptEvent | null = null;

// Adding a listener outside of the component as it may (?) need to be
// subscribed early to catch the event.
//
// Also note that it will fire only if certain heuristics are met (user has
// used the app for some time, etc.)
window.addEventListener(
  "beforeinstallprompt",
  (event: BeforeInstallPromptEvent) => {
    // prevent Chrome <= 67 from automatically showing the prompt
    event.preventDefault();
    // cache for later use
    pwaEvent = event;
  },
);

let isSelfEmbedding = false;

if (window.self !== window.top) {
  try {
    const parentUrl = new URL(document.referrer);
    const currentUrl = new URL(window.location.href);
    if (parentUrl.origin === currentUrl.origin) {
      isSelfEmbedding = true;
    }
  } catch (error) {
    // ignore
  }
}

const shareableLinkConfirmDialog = {
  title: t("overwriteConfirm.modal.shareableLink.title"),
  description: (
    <Trans
      i18nKey="overwriteConfirm.modal.shareableLink.description"
      bold={(text) => <strong>{text}</strong>}
      br={() => <br />}
    />
  ),
  actionLabel: t("overwriteConfirm.modal.shareableLink.button"),
  color: "danger",
} as const;

const initializeScene = async (opts: {
  collabAPI: CollabAPI | null;
  excalidrawAPI: ExcalidrawImperativeAPI;
}): Promise<
  { scene: ExcalidrawInitialDataState | null } & (
    | { isExternalScene: true; id: string; key: string }
    | { isExternalScene: false; id?: null; key?: null }
  )
> => {
  const searchParams = new URLSearchParams(window.location.search);
  const id = searchParams.get("id");
  const jsonBackendMatch = window.location.hash.match(
    /^#json=([a-zA-Z0-9_-]+),([a-zA-Z0-9_-]+)$/,
  );
  const externalUrlMatch = window.location.hash.match(/^#url=(.*)$/);

  const localDataState = importFromLocalStorage();

  let scene: RestoredDataState & {
    scrollToContent?: boolean;
  } = await loadScene(null, null, localDataState);

  let roomLinkData = getCollaborationLinkData(window.location.href);
  const isExternalScene = !!(id || jsonBackendMatch || roomLinkData);
  if (isExternalScene) {
    if (
      // don't prompt if scene is empty
      !scene.elements.length ||
      // don't prompt for collab scenes because we don't override local storage
      roomLinkData ||
      // otherwise, prompt whether user wants to override current scene
      (await openConfirmModal(shareableLinkConfirmDialog))
    ) {
      if (jsonBackendMatch) {
        scene = await loadScene(
          jsonBackendMatch[1],
          jsonBackendMatch[2],
          localDataState,
        );
      }
      scene.scrollToContent = true;
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
  } else if (externalUrlMatch) {
    window.history.replaceState({}, APP_NAME, window.location.origin);

    const url = externalUrlMatch[1];
    try {
      const request = await fetch(window.decodeURIComponent(url));
      const data = await loadFromBlob(await request.blob(), null, null);
      if (
        !scene.elements.length ||
        (await openConfirmModal(shareableLinkConfirmDialog))
      ) {
        return { scene: data, isExternalScene };
      }
    } catch (error: any) {
      return {
        scene: {
          appState: {
            errorMessage: t("alerts.invalidSceneUrl"),
          },
        },
        isExternalScene,
      };
    }
  }

  if (roomLinkData && opts.collabAPI) {
    const { excalidrawAPI } = opts;

    const scene = await opts.collabAPI.startCollaboration(roomLinkData);

    return {
      // when collaborating, the state may have already been updated at this
      // point (we may have received updates from other clients), so reconcile
      // elements and appState with existing state
      scene: {
        ...scene,
        appState: {
          ...restoreAppState(
            {
              ...scene?.appState,
              theme: localDataState?.appState?.theme || scene?.appState?.theme,
            },
            excalidrawAPI.getAppState(),
          ),
          // necessary if we're invoking from a hashchange handler which doesn't
          // go through App.initializeScene() that resets this flag
          isLoading: false,
        },
        elements: reconcileElements(
          scene?.elements || [],
          excalidrawAPI.getSceneElementsIncludingDeleted() as RemoteExcalidrawElement[],
          excalidrawAPI.getAppState(),
        ),
      },
      isExternalScene: true,
      id: roomLinkData.roomId,
      key: roomLinkData.roomKey,
    };
  } else if (scene) {
    return isExternalScene && jsonBackendMatch
      ? {
        scene,
        isExternalScene,
        id: jsonBackendMatch[1],
        key: jsonBackendMatch[2],
      }
      : { scene, isExternalScene: false };
  }
  return { scene: null, isExternalScene: false };
};

const ExcalidrawWrapper = () => {

  const [selectedImages, setSelectedImages] = useState<string[]>([]);

const handleImageSelect = (image: any) => {
  setSelectedImages((prev) => [...prev, image.id]);
};

const handleImageDeselect = (image: any) => {
  setSelectedImages((prev) => prev.filter((id) => id !== image.id));
};

  const [errorMessage, setErrorMessage] = useState("");
  const isCollabDisabled = isRunningInIframe();


  const { editorTheme, appTheme, setAppTheme } = useHandleAppTheme();

  const [langCode, setLangCode] = useAppLangCode();

  // initial state
  // ---------------------------------------------------------------------------

  const initialStatePromiseRef = useRef<{
    promise: ResolvablePromise<ExcalidrawInitialDataState | null>;
  }>({ promise: null! });
  if (!initialStatePromiseRef.current.promise) {
    initialStatePromiseRef.current.promise =
      resolvablePromise<ExcalidrawInitialDataState | null>();
  }

  const debugCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    trackEvent("load", "frame", getFrame());
    // Delayed so that the app has a time to load the latest SW
    setTimeout(() => {
      trackEvent("load", "version", getVersion());
    }, VERSION_TIMEOUT);
  }, []);

  const [excalidrawAPI, excalidrawRefCallback] =
    useCallbackRefState<ExcalidrawImperativeAPI>();
  useRabbitSearchBoxHandlers(excalidrawAPI);

  const [, setShareDialogState] = useAtom(shareDialogStateAtom);
  const [collabAPI] = useAtom(collabAPIAtom);
  const [isCollaborating] = useAtomWithInitialValue(isCollaboratingAtom, () => {
    return isCollaborationLink(window.location.href);
  });
  const collabError = useAtomValue(collabErrorIndicatorAtom);

  useHandleLibrary({
    excalidrawAPI,
    adapter: LibraryIndexedDBAdapter,
    // TODO maybe remove this in several months (shipped: 24-03-11)
    migrationAdapter: LibraryLocalStorageMigrationAdapter,
  });

  const [, forceRefresh] = useState(false);

  useEffect(() => {
    if (isDevEnv()) {
      const debugState = loadSavedDebugState();

      if (debugState.enabled && !window.visualDebug) {
        window.visualDebug = {
          data: [],
        };
      } else {
        delete window.visualDebug;
      }
      forceRefresh((prev) => !prev);
    }
  }, [excalidrawAPI]);

  useEffect(() => {
    if (!excalidrawAPI || (!isCollabDisabled && !collabAPI)) {
      return;
    }

    const loadImages = (
      data: ResolutionType<typeof initializeScene>,
      isInitialLoad = false,
    ) => {
      if (!data.scene) {
        return;
      }
      if (collabAPI?.isCollaborating()) {
        if (data.scene.elements) {
          collabAPI
            .fetchImageFilesFromFirebase({
              elements: data.scene.elements,
              forceFetchFiles: true,
            })
            .then(({ loadedFiles, erroredFiles }) => {
              excalidrawAPI.addFiles(loadedFiles);
              updateStaleImageStatuses({
                excalidrawAPI,
                erroredFiles,
                elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
              });
            });
        }
      } else {
        const fileIds =
          data.scene.elements?.reduce((acc, element) => {
            if (isInitializedImageElement(element)) {
              return acc.concat(element.fileId);
            }
            return acc;
          }, [] as FileId[]) || [];

        if (data.isExternalScene) {
          loadFilesFromFirebase(
            `${FIREBASE_STORAGE_PREFIXES.shareLinkFiles}/${data.id}`,
            data.key,
            fileIds,
          ).then(({ loadedFiles, erroredFiles }) => {
            excalidrawAPI.addFiles(loadedFiles);
            updateStaleImageStatuses({
              excalidrawAPI,
              erroredFiles,
              elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
            });
          });
        } else if (isInitialLoad) {
          if (fileIds.length) {
            LocalData.fileStorage
              .getFiles(fileIds)
              .then(({ loadedFiles, erroredFiles }) => {
                if (loadedFiles.length) {
                  excalidrawAPI.addFiles(loadedFiles);
                }
                updateStaleImageStatuses({
                  excalidrawAPI,
                  erroredFiles,
                  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
                });
              });
          }
          // on fresh load, clear unused files from IDB (from previous
          // session)
          LocalData.fileStorage.clearObsoleteFiles({ currentFileIds: fileIds });
        }
      }
    };

    initializeScene({ collabAPI, excalidrawAPI }).then(async (data) => {
      loadImages(data, /* isInitialLoad */ true);
      initialStatePromiseRef.current.promise.resolve(data.scene);
    });

    const onHashChange = async (event: HashChangeEvent) => {
      event.preventDefault();
      const libraryUrlTokens = parseLibraryTokensFromUrl();
      if (!libraryUrlTokens) {
        if (
          collabAPI?.isCollaborating() &&
          !isCollaborationLink(window.location.href)
        ) {
          collabAPI.stopCollaboration(false);
        }
        excalidrawAPI.updateScene({ appState: { isLoading: true } });

        initializeScene({ collabAPI, excalidrawAPI }).then((data) => {
          loadImages(data);
          if (data.scene) {
            excalidrawAPI.updateScene({
              ...data.scene,
              ...restore(data.scene, null, null, { repairBindings: true }),
              captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
          }
        });
      }
    };

    const titleTimeout = setTimeout(
      () => (document.title = "Rabbit Hole"),
      TITLE_TIMEOUT,
    );

    const syncData = debounce(() => {
      if (isTestEnv()) {
        return;
      }
      if (
        !document.hidden &&
        ((collabAPI && !collabAPI.isCollaborating()) || isCollabDisabled)
      ) {
        // don't sync if local state is newer or identical to browser state
        if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)) {
          const localDataState = importFromLocalStorage();
          const username = importUsernameFromLocalStorage();
          setLangCode(getPreferredLanguage());
          excalidrawAPI.updateScene({
            ...localDataState,
            captureUpdate: CaptureUpdateAction.NEVER,
          });
          LibraryIndexedDBAdapter.load().then((data) => {
            if (data) {
              excalidrawAPI.updateLibrary({
                libraryItems: data.libraryItems,
              });
            }
          });
          collabAPI?.setUsername(username || "");
        }

        if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_FILES)) {
          const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
          const currFiles = excalidrawAPI.getFiles();
          const fileIds =
            elements?.reduce((acc, element) => {
              if (
                isInitializedImageElement(element) &&
                // only load and update images that aren't already loaded
                !currFiles[element.fileId]
              ) {
                return acc.concat(element.fileId);
              }
              return acc;
            }, [] as FileId[]) || [];
          if (fileIds.length) {
            LocalData.fileStorage
              .getFiles(fileIds)
              .then(({ loadedFiles, erroredFiles }) => {
                if (loadedFiles.length) {
                  excalidrawAPI.addFiles(loadedFiles);
                }
                updateStaleImageStatuses({
                  excalidrawAPI,
                  erroredFiles,
                  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
                });
              });
          }
        }
      }
    }, SYNC_BROWSER_TABS_TIMEOUT);

    const onUnload = () => {
      LocalData.flushSave();
    };

    const visibilityChange = (event: FocusEvent | Event) => {
      if (event.type === EVENT.BLUR || document.hidden) {
        LocalData.flushSave();
      }
      if (
        event.type === EVENT.VISIBILITY_CHANGE ||
        event.type === EVENT.FOCUS
      ) {
        syncData();
      }
    };

    window.addEventListener(EVENT.HASHCHANGE, onHashChange, false);
    window.addEventListener(EVENT.UNLOAD, onUnload, false);
    window.addEventListener(EVENT.BLUR, visibilityChange, false);
    document.addEventListener(EVENT.VISIBILITY_CHANGE, visibilityChange, false);
    window.addEventListener(EVENT.FOCUS, visibilityChange, false);
    return () => {
      window.removeEventListener(EVENT.HASHCHANGE, onHashChange, false);
      window.removeEventListener(EVENT.UNLOAD, onUnload, false);
      window.removeEventListener(EVENT.BLUR, visibilityChange, false);
      window.removeEventListener(EVENT.FOCUS, visibilityChange, false);
      document.removeEventListener(
        EVENT.VISIBILITY_CHANGE,
        visibilityChange,
        false,
      );
      clearTimeout(titleTimeout);
    };
  }, [isCollabDisabled, collabAPI, excalidrawAPI, setLangCode]);

  useEffect(() => {
    const unloadHandler = (event: BeforeUnloadEvent) => {
      LocalData.flushSave();

      if (
        excalidrawAPI &&
        LocalData.fileStorage.shouldPreventUnload(
          excalidrawAPI.getSceneElements(),
        )
      ) {
        if (import.meta.env.VITE_APP_DISABLE_PREVENT_UNLOAD !== "true") {
          preventUnload(event);
        } else {
          console.warn(
            "preventing unload disabled (VITE_APP_DISABLE_PREVENT_UNLOAD)",
          );
        }
      }
    };
    window.addEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    return () => {
      window.removeEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    };
  }, [excalidrawAPI]);

  const onChange = (
    elements: readonly OrderedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    if (collabAPI?.isCollaborating()) {
      collabAPI.syncElements(elements);
    }

    // this check is redundant, but since this is a hot path, it's best
    // not to evaludate the nested expression every time
    if (!LocalData.isSavePaused()) {
      LocalData.save(elements, appState, files, () => {
        if (excalidrawAPI) {
          let didChange = false;

          const elements = excalidrawAPI
            .getSceneElementsIncludingDeleted()
            .map((element) => {
              if (
                LocalData.fileStorage.shouldUpdateImageElementStatus(element)
              ) {
                const newElement = newElementWith(element, { status: "saved" });
                if (newElement !== element) {
                  didChange = true;
                }
                return newElement;
              }
              return element;
            });

          if (didChange) {
            excalidrawAPI.updateScene({
              elements,
              captureUpdate: CaptureUpdateAction.NEVER,
            });
          }
        }
      });
    }

    // Render the debug scene if the debug canvas is available
    if (debugCanvasRef.current && excalidrawAPI) {
      debugRenderer(
        debugCanvasRef.current,
        appState,
        window.devicePixelRatio,
        () => forceRefresh((prev) => !prev),
      );
    }
  };

  const [latestShareableLink, setLatestShareableLink] = useState<string | null>(
    null,
  );

  const onExportToBackend = async (
    exportedElements: readonly NonDeletedExcalidrawElement[],
    appState: Partial<AppState>,
    files: BinaryFiles,
  ) => {
    if (exportedElements.length === 0) {
      throw new Error(t("alerts.cannotExportEmptyCanvas"));
    }
    try {
      const { url, errorMessage } = await exportToBackend(
        exportedElements,
        {
          ...appState,
          viewBackgroundColor: appState.exportBackground
            ? appState.viewBackgroundColor
            : getDefaultAppState().viewBackgroundColor,
        },
        files,
      );

      if (errorMessage) {
        throw new Error(errorMessage);
      }

      if (url) {
        setLatestShareableLink(url);
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        const { width, height } = appState;
        console.error(error, {
          width,
          height,
          devicePixelRatio: window.devicePixelRatio,
        });
        throw new Error(error.message);
      }
    }
  };

  const renderCustomStats = (
    elements: readonly NonDeletedExcalidrawElement[],
    appState: UIAppState,
  ) => {
    return (
      <CustomStats
        setToast={(message) => excalidrawAPI!.setToast({ message })}
        appState={appState}
        elements={elements}
      />
    );
  };

  const isOffline = useAtomValue(isOfflineAtom);

  const onCollabDialogOpen = useCallback(
    () => setShareDialogState({ isOpen: true, type: "collaborationOnly" }),
    [setShareDialogState],
  );

  // browsers generally prevent infinite self-embedding, there are
  // cases where it still happens, and while we disallow self-embedding
  // by not whitelisting our own origin, this serves as an additional guard
  if (isSelfEmbedding) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          height: "100%",
        }}
      >
        <h1>I'm not a pretzel!</h1>
      </div>
    );
  }

  const ExcalidrawPlusCommand = {
    label: "Excalidraw+",
    category: DEFAULT_CATEGORIES.links,
    predicate: true,
    icon: <div style={{ width: 14 }}>{ExcalLogo}</div>,
    keywords: ["plus", "cloud", "server"],
    perform: () => {
      window.open(
        `${import.meta.env.VITE_APP_PLUS_LP
        }/plus?utm_source=excalidraw&utm_medium=app&utm_content=command_palette`,
        "_blank",
      );
    },
  };
  const ExcalidrawPlusAppCommand = {
    label: "Sign up",
    category: DEFAULT_CATEGORIES.links,
    predicate: true,
    icon: <div style={{ width: 14 }}>{ExcalLogo}</div>,
    keywords: [
      "excalidraw",
      "plus",
      "cloud",
      "server",
      "signin",
      "login",
      "signup",
    ],
    perform: () => {
      window.open(
        `${import.meta.env.VITE_APP_PLUS_APP
        }?utm_source=excalidraw&utm_medium=app&utm_content=command_palette`,
        "_blank",
      );
    },
  };

  return (
    <div
      style={{ height: "100%" }}
      className={clsx("excalidraw-app", {
        "is-collaborating": isCollaborating,
      })}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 16px",
          backgroundColor: "#2c2c2c",
          color: "white",
          fontSize: "18px",
          fontWeight: "bold",
          borderBottom: "1px solid #444",
        }}
      >
        <img
          src="https://i.imgur.com/KttcKbd.png"
          alt="logo"
          style={{ height: 28, marginRight: 12 }}
        />
        <input
          type="text"
          placeholder="Untitled Drawing"
          style={{
            background: "transparent",
            border: "none",
            borderBottom: "1px solid white",
            color: "white",
            fontSize: "18px",
            flex: 1,
            outline: "none",
          }}
        />
      </div>
      <Excalidraw
        excalidrawAPI={excalidrawRefCallback}
        onChange={onChange}
        initialData={initialStatePromiseRef.current.promise}
        isCollaborating={isCollaborating}
        onPointerUpdate={collabAPI?.onPointerUpdate}
        UIOptions={{
          canvasActions: {
            toggleTheme: true,
            export: {
              onExportToBackend,
              renderCustomUI: excalidrawAPI
                ? (elements, appState, files) => {
                  return (
                    <ExportToExcalidrawPlus
                      elements={elements}
                      appState={appState}
                      files={files}
                      name={excalidrawAPI.getName()}
                      onError={(error) => {
                        excalidrawAPI?.updateScene({
                          appState: {
                            errorMessage: error.message,
                          },
                        });
                      }}
                      onSuccess={() => {
                        excalidrawAPI.updateScene({
                          appState: { openDialog: null },
                        });
                      }}
                    />
                  );
                }
                : undefined,
            },
          },
        }}
        langCode={langCode}
        renderCustomStats={renderCustomStats}
        detectScroll={false}
        handleKeyboardGlobally={true}
        autoFocus={true}
        theme={editorTheme}
        renderTopRightUI={(isMobile) => {
          if (isMobile || !collabAPI || isCollabDisabled) {
            return null;
          }
          return (
            <div className="top-right-ui">
              {collabError.message && <CollabError collabError={collabError} />}
              <LiveCollaborationTrigger
                isCollaborating={isCollaborating}
                onSelect={() =>
                  setShareDialogState({ isOpen: true, type: "share" })
                }
              />
            </div>
          );
        }}
        onLinkOpen={(element, event) => {
          if (element.link && isElementLink(element.link)) {
            event.preventDefault();
            excalidrawAPI?.scrollToContent(element.link, { animate: true });
          }
        }}
      >
        <AppMainMenu
          onCollabDialogOpen={onCollabDialogOpen}
          isCollaborating={isCollaborating}
          isCollabEnabled={!isCollabDisabled}
          theme={appTheme}
          setTheme={(theme) => setAppTheme(theme)}
          refresh={() => forceRefresh((prev) => !prev)}
        />
        <AppWelcomeScreen
        // onCollabDialogOpen={onCollabDialogOpen}
        // isCollabEnabled={!isCollabDisabled}
        />
        <OverwriteConfirmDialog>
          <OverwriteConfirmDialog.Actions.ExportToImage />
          <OverwriteConfirmDialog.Actions.SaveToDisk />
          {excalidrawAPI && (
            <OverwriteConfirmDialog.Action
              title={t("overwriteConfirm.action.excalidrawPlus.title")}
              actionLabel={t("overwriteConfirm.action.excalidrawPlus.button")}
              onClick={() => {
                exportToExcalidrawPlus(
                  excalidrawAPI.getSceneElements(),
                  excalidrawAPI.getAppState(),
                  excalidrawAPI.getFiles(),
                  excalidrawAPI.getName(),
                );
              }}
            >
              {t("overwriteConfirm.action.excalidrawPlus.description")}
            </OverwriteConfirmDialog.Action>
          )}
        </OverwriteConfirmDialog>
        <AppHeader onChange={() => excalidrawAPI?.refresh()} excalidrawAPI={excalidrawAPI} />
        {/* <AppFooter onChange={() => excalidrawAPI?.refresh()} /> */}
        {excalidrawAPI && <AIComponents excalidrawAPI={excalidrawAPI} />}

        <TTDDialogTrigger />
        {isCollaborating && isOffline && (
          <div className="collab-offline-warning">
            {t("alerts.collabOfflineWarning")}
          </div>
        )}
        {latestShareableLink && (
          <ShareableLinkDialog
            link={latestShareableLink}
            onCloseRequest={() => setLatestShareableLink(null)}
            setErrorMessage={setErrorMessage}
          />
        )}
        {excalidrawAPI && !isCollabDisabled && (
          <Collab excalidrawAPI={excalidrawAPI} />
        )}

        <ShareDialog
          collabAPI={collabAPI}
          onExportToBackend={async () => {
            if (excalidrawAPI) {
              try {
                await onExportToBackend(
                  excalidrawAPI.getSceneElements(),
                  excalidrawAPI.getAppState(),
                  excalidrawAPI.getFiles(),
                );
              } catch (error: any) {
                setErrorMessage(error.message);
              }
            }
          }}
        />

        {errorMessage && (
          <ErrorDialog onClose={() => setErrorMessage("")}>
            {errorMessage}
          </ErrorDialog>
        )}

        <CommandPalette
          customCommandPaletteItems={[
            // Testing rabbit hole search box
            {
              label: "Add Rabbit Image Tabs",
              category: DEFAULT_CATEGORIES.app,
              predicate: () => true,
              keywords: ["rabbit", "tabs", "images", "gallery", "rabbittabs"],

              perform: () => {
                // const placeholderImageUrl = "https://vetsonparker.com.au/wp-content/uploads/2015/04/Rabbit-Facts.jpg";

                // // Generate 10 placeholder images
                // const images = Array.from({ length: 10 }).map((_, index) => ({
                //   id: `placeholder-${index + 1}`,
                //   url: placeholderImageUrl,
                //   title: `Placeholder Image ${index + 1}`,
                // }));

                const placeholderImageUrl = "https://vetsonparker.com.au/wp-content/uploads/2015/04/Rabbit-Facts.jpg";

                // Create 3 tabs, each with 10 subImages using the placeholder URL
                const images = [
                  {
                    id: "tab-1",
                    title: "Google",
                    subImages: Array.from({ length: 10 }).map((_, index) => ({
                      id: `1-${index + 1}`,
                      url: placeholderImageUrl,
                      title: `Tab 1 Image ${index + 1}`,
                    })),
                  },
                  {
                    id: "tab-2",
                    title: "Pinterest",
                    subImages: Array.from({ length: 10 }).map((_, index) => ({
                      id: `2-${index + 1}`,
                      url: placeholderImageUrl,
                      title: `Tab 2 Image ${index + 1}`,
                    })),
                  },
                  {
                    id: "tab-3",
                    title: "YouTube",
                    subImages: Array.from({ length: 10 }).map((_, index) => ({
                      id: `3-${index + 1}`,
                      url: placeholderImageUrl,
                      title: `Tab 3 Image ${index + 1}`,
                    })),
                  },
                ];



                if (excalidrawAPI) {
                  // Create the tabbed image element using your factory function
                  const tabsElement = newRabbitImageTabsElement({
                    x: 100,
                    y: 100,
                    width: 400,
                    height: 350,
                    images,             // shorthand for images: images,
                    activeTabIndex: 0,
                    tabHeight: 40,
                  });

                  // Add the new element to the current scene elements
                  excalidrawAPI.updateScene({
                    elements: [...excalidrawAPI.getSceneElements(), tabsElement],
                  });
                }
              },
            },

            {
              label: "Add Rabbit SearchBox",
              category: DEFAULT_CATEGORIES.app,
              predicate: () => true,
              keywords: ["rabbit", "search", "box", "searchbox"],
              perform: () => {
                if (excalidrawAPI) {
                  const searchBox = newRabbitSearchBoxElement({
                    x: 100,
                    y: 100,
                    text: "Search...",
                    fontSize: 16,
                    fontFamily: FONT_FAMILY.Virgil,
                    textAlign: "left",
                    verticalAlign: "middle",
                    hasIcon: true,
                  });
                  console.log(getSearchBoxText(searchBox));

                  excalidrawAPI.updateScene({
                    elements: [...excalidrawAPI.getSceneElements(), searchBox],
                  });
                  excalidrawAPI.setToast({
                    message: "Double-click on the search box to edit. Press Enter to confirm and log text to console.",
                    duration: 5000
                  });
                }
              },
            },
            {
              label: "Do Everything",
              category: DEFAULT_CATEGORIES.app,
              predicate: () => true,
              keywords: ["rabbit", "search", "box", "searchbox", "everything"],
              perform: () => {
                if (excalidrawAPI) {
                  //create and add search box
                  const searchBox = newRabbitSearchBoxElement({
                    x: 100,
                    y: 100,
                    text: "Search...",
                    fontSize: 16,
                    fontFamily: FONT_FAMILY.Virgil,
                    textAlign: "left",
                    verticalAlign: "middle",
                    hasIcon: true,
                  });

                  //add box to scene
                  excalidrawAPI.updateScene({
                    elements: [...excalidrawAPI.getSceneElements(), searchBox],
                  });

                  excalidrawAPI.setToast({
                    message: "Double-click on the search box to edit. Press Enter to confirm and search for images.",
                    duration: 5000
                  });

                  let hasSearched = false;
                  let lastSearchQuery = ""; //preventing duplicate searches

                  const handleEnterKey = (event: KeyboardEvent) => {
                    if (event.key !== 'Enter') return;


                    const currentElements = excalidrawAPI.getSceneElements();
                    const currentSearchBox = currentElements.find(el =>
                      el.type === 'rabbit-searchbox' && el.id === searchBox.id
                    ) as RabbitSearchBoxElement;

                    if (currentSearchBox) {
                      const searchQuery = getSearchBoxText(currentSearchBox);

                      // valid and different search query
                      if (searchQuery !== "Search..." &&
                        searchQuery.trim() !== "" &&
                        searchQuery.length > 2 &&
                        searchQuery !== lastSearchQuery) {

                        console.log("Search query detected:", searchQuery);
                        lastSearchQuery = searchQuery; // Update last search query
                        hasSearched = true;

                        searchAndSaveImages(searchQuery)
                          .then(images => {
                            console.log("Search completed, results:", images);

                            if (images && images.length > 0) {
                              console.log("Look at first", images[0]['link']);

                              const imageUrl = images[0]['link'];
                              const label = searchQuery + "";
                              const padding = 10;
                              const labelHeight = 20;
                              const fixedImageHeight = 200;


                              const searchBarHeight = 40;
                              const searchBarSpacing = 2;
                              const imageY = 200;
                              const searchBarY = imageY - searchBarSpacing - searchBarHeight;

                              const img = new Image();
                              img.crossOrigin = "anonymous";

                              img.onload = () => {
                                const aspectRatio = img.naturalWidth / img.naturalHeight;
                                const imageHeight = fixedImageHeight;
                                const imageWidth = imageHeight * aspectRatio;

                                const totalWidth = imageWidth + padding * 2;
                                const totalHeight = imageHeight + padding * 2 + labelHeight;

                                const imageSearchBox = newRabbitSearchBoxElement({
                                  x: 100,
                                  y: searchBarY,
                                  text: "Search...",
                                  fontSize: 14,
                                  fontFamily: FONT_FAMILY.Virgil,
                                  textAlign: "left",
                                  verticalAlign: "middle",
                                  hasIcon: true,
                                  width: Math.max(totalWidth, 200),
                                  height: searchBarHeight,
                                });

                                const image = newRabbitImageElement({
                                  x: 100,
                                  y: imageY,
                                  label,
                                  imageUrl,
                                  width: totalWidth,
                                  height: totalHeight,
                                });

                                //bind elements together
                                const groupId = `rabbit-group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                                const groupedSearchBox = { ...imageSearchBox, groupIds: [groupId] };
                                const groupedImage = { ...image, groupIds: [groupId] };

                                //to extend the search
                                const handleExtendedSearch = async (event: KeyboardEvent) => {
                                  if (event.key !== 'Enter') return;

                                  const currentElements = excalidrawAPI.getSceneElements();
                                  const currentImageSearchBox = currentElements.find(el =>
                                    el.type === 'rabbit-searchbox' && el.id === imageSearchBox.id
                                  ) as RabbitSearchBoxElement;

                                  if (currentImageSearchBox) {
                                    const extendedSearchText = getSearchBoxText(currentImageSearchBox);

                                    if (extendedSearchText &&
                                      extendedSearchText !== "Search..." &&
                                      extendedSearchText.trim() !== "" &&
                                      extendedSearchText.length > 2) {

                                      //combine with new input and call gemini
                                      const finalSearchQuery = await generateBetterSearchQuery(searchQuery, extendedSearchText);
                                      console.log("Extended search query:", finalSearchQuery);

                                      //search w/ the extended query
                                      searchAndSaveImages(finalSearchQuery)
                                        .then(newImages => {
                                          if (newImages && newImages.length > 0) {
                                            const newImageUrl = newImages[0]['link'];

                                            const newImg = new Image();
                                            newImg.crossOrigin = "anonymous";

                                            newImg.onload = () => {
                                              const newAspectRatio = newImg.naturalWidth / newImg.naturalHeight;
                                              const newImageHeight = fixedImageHeight;
                                              const newImageWidth = newImageHeight * newAspectRatio;
                                              const newTotalWidth = newImageWidth + padding * 2;
                                              const newTotalHeight = newImageHeight + padding * 2 + labelHeight;


                                              const newImage = newRabbitImageElement({
                                                x: 100 + totalWidth + 50, //to the right of the original image
                                                y: imageY,
                                                label: finalSearchQuery,
                                                imageUrl: newImageUrl,
                                                width: newTotalWidth,
                                                height: newTotalHeight,
                                              });

                                              //new search bar for new image
                                              const newSearchBox = newRabbitSearchBoxElement({
                                                x: 100 + totalWidth + 50,
                                                y: imageY - 2 - searchBarHeight,
                                                text: "Search...",
                                                fontSize: 14,
                                                fontFamily: FONT_FAMILY.Virgil,
                                                textAlign: "left",
                                                verticalAlign: "middle",
                                                hasIcon: true,
                                                width: Math.max(newTotalWidth, 200),
                                                height: searchBarHeight,
                                              });

                                              const newGroupId = `rabbit-group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                                              const newGroupedSearchBox = { ...newSearchBox, groupIds: [newGroupId] };
                                              const newGroupedImage = { ...newImage, groupIds: [newGroupId] };

                                              excalidrawAPI.updateScene({
                                                elements: [...excalidrawAPI.getSceneElements(), newGroupedSearchBox, newGroupedImage],
                                              });

                                              excalidrawAPI.setToast({
                                                message: `Extended search "${finalSearchQuery}" completed!`,
                                                duration: 3000
                                              });
                                            };

                                            newImg.src = newImageUrl;
                                          } else {
                                            excalidrawAPI.setToast({
                                              message: "No results found for extended search.",
                                              duration: 3000
                                            });
                                          }
                                        })
                                        .catch(error => {
                                          console.error("Error in extended search:", error);
                                          excalidrawAPI.setToast({
                                            message: "Error in extended search. Please try again.",
                                            duration: 3000
                                          });
                                        });
                                    }
                                  }
                                };

                                document.addEventListener('keydown', handleExtendedSearch);

                                excalidrawAPI.updateScene({
                                  elements: [...excalidrawAPI.getSceneElements(), groupedSearchBox, groupedImage],
                                });

                                excalidrawAPI.setToast({
                                  message: `Image for "${searchQuery}" added with search bar!`,
                                  duration: 3000
                                });
                              };

                              img.onerror = () => {
                                console.error("Failed to load image for RabbitImageElement");
                                excalidrawAPI.setToast({
                                  message: "Failed to load image. Please try a different search term.",
                                  duration: 3000
                                });
                              };

                              img.src = imageUrl;
                            } else {
                              excalidrawAPI.setToast({
                                message: "No images found. Please try a different search term.",
                                duration: 3000
                              });
                            }
                          })
                          .catch(error => {
                            console.error("Error in image search:", error);
                            excalidrawAPI.setToast({
                              message: "Error searching for images. Please try again.",
                              duration: 3000
                            });
                          });
                      }
                    }
                  };

                  document.addEventListener('keydown', handleEnterKey);
                }
              },
            },
            {
              label: "Add Rabbit Image",
              category: DEFAULT_CATEGORIES.app,
              predicate: () => true,
              keywords: ["rabbit", "image", "rabbitimage"],

              perform: () => {
                const customQuer = "naruto"
                searchAndSaveImages(customQuer)
                  .then(images => {
                    console.log("Search completed, results:", images);
                    console.log("Look at first", images[0]['link']);

                    // Use the search result here, inside the .then()
                    const searchQuer = images[0]['link'];

                    if (excalidrawAPI) {
                      const imageUrl = searchQuer;

                      // Put all your image creation code here
                      const label = customQuer + "Image";
                      const padding = 10;
                      const labelHeight = 20;
                      const fixedImageHeight = 200;

                      const img = new Image();
                      img.crossOrigin = "anonymous";

                      img.onload = () => {
                        const aspectRatio = img.naturalWidth / img.naturalHeight;
                        const imageHeight = fixedImageHeight;
                        const imageWidth = imageHeight * aspectRatio;

                        const totalWidth = imageWidth + padding * 2;
                        const totalHeight = imageHeight + padding * 2 + labelHeight;

                        const image = newRabbitImageElement({
                          x: 100,
                          y: 300,
                          label,
                          imageUrl,
                          width: totalWidth,
                          height: totalHeight,
                        });

                        excalidrawAPI.updateScene({
                          elements: [...excalidrawAPI.getSceneElements(), image],
                        });
                      };

                      img.onerror = () => {
                        console.error("Failed to load image for RabbitImageElement");
                      };

                      img.src = imageUrl;
                    }
                  })
                  .catch(error => {
                    console.error("Error in image search:", error);
                  });
              },
            },
            {
              label: t("labels.liveCollaboration"),
              category: DEFAULT_CATEGORIES.app,
              keywords: [
                "team",
                "multiplayer",
                "share",
                "public",
                "session",
                "invite",
              ],
              icon: usersIcon,
              perform: () => {
                setShareDialogState({
                  isOpen: true,
                  type: "collaborationOnly",
                });
              },
            },
            {
              label: t("roomDialog.button_stopSession"),
              category: DEFAULT_CATEGORIES.app,
              predicate: () => !!collabAPI?.isCollaborating(),
              keywords: [
                "stop",
                "session",
                "end",
                "leave",
                "close",
                "exit",
                "collaboration",
              ],
              perform: () => {
                if (collabAPI) {
                  collabAPI.stopCollaboration();
                  if (!collabAPI.isCollaborating()) {
                    setShareDialogState({ isOpen: false });
                  }
                }
              },
            },
            {
              label: t("labels.share"),
              category: DEFAULT_CATEGORIES.app,
              predicate: true,
              icon: share,
              keywords: [
                "link",
                "shareable",
                "readonly",
                "export",
                "publish",
                "snapshot",
                "url",
                "collaborate",
                "invite",
              ],
              perform: async () => {
                setShareDialogState({ isOpen: true, type: "share" });
              },
            },
            {
              label: "GitHub",
              icon: GithubIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: [
                "issues",
                "bugs",
                "requests",
                "report",
                "features",
                "social",
                "community",
              ],
              perform: () => {
                window.open(
                  "https://github.com/excalidraw/excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: t("labels.followUs"),
              icon: XBrandIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: ["twitter", "contact", "social", "community"],
              perform: () => {
                window.open(
                  "https://x.com/excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: t("labels.discordChat"),
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              icon: DiscordIcon,
              keywords: [
                "chat",
                "talk",
                "contact",
                "bugs",
                "requests",
                "report",
                "feedback",
                "suggestions",
                "social",
                "community",
              ],
              perform: () => {
                window.open(
                  "https://discord.gg/UexuTaE",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            {
              label: "YouTube",
              icon: youtubeIcon,
              category: DEFAULT_CATEGORIES.links,
              predicate: true,
              keywords: ["features", "tutorials", "howto", "help", "community"],
              perform: () => {
                window.open(
                  "https://youtube.com/@excalidraw",
                  "_blank",
                  "noopener noreferrer",
                );
              },
            },
            ...(isExcalidrawPlusSignedUser
              ? [
                {
                  ...ExcalidrawPlusAppCommand,
                  label: "Sign in / Go to Excalidraw+",
                },
              ]
              : [ExcalidrawPlusCommand, ExcalidrawPlusAppCommand]),

            {
              label: t("overwriteConfirm.action.excalidrawPlus.button"),
              category: DEFAULT_CATEGORIES.export,
              icon: exportToPlus,
              predicate: true,
              keywords: ["plus", "export", "save", "backup"],
              perform: () => {
                if (excalidrawAPI) {
                  exportToExcalidrawPlus(
                    excalidrawAPI.getSceneElements(),
                    excalidrawAPI.getAppState(),
                    excalidrawAPI.getFiles(),
                    excalidrawAPI.getName(),
                  );
                }
              },
            },
            {
              ...CommandPalette.defaultItems.toggleTheme,
              perform: () => {
                setAppTheme(
                  editorTheme === THEME.DARK ? THEME.LIGHT : THEME.DARK,
                );
              },
            },
            {
              label: t("labels.installPWA"),
              category: DEFAULT_CATEGORIES.app,
              predicate: () => !!pwaEvent,
              perform: () => {
                if (pwaEvent) {
                  pwaEvent.prompt();
                  pwaEvent.userChoice.then(() => {
                    // event cannot be reused, but we'll hopefully
                    // grab new one as the event should be fired again
                    pwaEvent = null;
                  });
                }
              },
            },
          ]}
        />
        {isVisualDebuggerEnabled() && excalidrawAPI && (
          <DebugCanvas
            appState={excalidrawAPI.getAppState()}
            scale={window.devicePixelRatio}
            ref={debugCanvasRef}
          />
        )}
      </Excalidraw>

      {excalidrawAPI && (() => {
        const appState = excalidrawAPI.getAppState();
        const elements = excalidrawAPI.getSceneElements();

        // Find any 'rabbit-searchbox' element (first one)
        const searchbox = elements.find(el => el.type === "rabbit-searchbox");

        console.log('is this happening');

        if (searchbox) {
          const { scrollX, scrollY, zoom } = appState;
          const x = (searchbox.x + searchbox.width / 2) * zoom.value + scrollX;
          const y = (searchbox.y + searchbox.height + 10) * zoom.value + scrollY;

          console.log("Showing RabbitImageWindow below rabbit-searchbox");

          return (
            <div
              style={{
                // position: "absolute",
                // top: y,
                // left: x - 160, // adjust horizontal centering as needed
                // zIndex: 1000,
                position: "absolute",
                top: y - 200,
                left: x + 300,
                zIndex: 1000,
              }}
            >
              <RabbitImageWindow
                appState={appState}
                onImageSelect={handleImageSelect}
                onImageDeselect={handleImageDeselect}
                selectedImages={selectedImages}
                onToggleVisibility={() => {
                  // do something here, e.g. toggle visibility state
                }}
              />
            </div>
          );
        }
        return null;
      })()}


      {excalidrawAPI && (() => {
        const appState = excalidrawAPI.getAppState();
        const elements = excalidrawAPI.getSceneElements();
        const selected = elements.find(
          (el) => appState.selectedElementIds[el.id] && el.type === "text"
        );

        if (selected && !appState.editingTextElement) {
          const { scrollX, scrollY, zoom } = excalidrawAPI.getAppState();
          const x = (selected.x + selected.width / 2) * zoom.value + scrollX;
          const y = (selected.y + selected.height + 10) * zoom.value + scrollY;
          return (
            <div
              style={{
                position: "absolute",
                top: y - 5,
                left: x - 111,
                display: "flex",
                gap: "8px",
                background: "#fff",
                padding: "4px 8px",
                borderRadius: "8px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                zIndex: 1000,
              }}
            >
              <button>YouTube</button>
              <button>Google</button>
              <button>Pinterest</button>
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
};

const ExcalidrawApp = () => {




  const isCloudExportWindow =
    window.location.pathname === "/excalidraw-plus-export";
  if (isCloudExportWindow) {
    return <ExcalidrawPlusIframeExport />;
  }

  return (
    <TopErrorBoundary>
      <Provider store={appJotaiStore}>
        <ExcalidrawWrapper />
      </Provider>
    </TopErrorBoundary>
  );
};

export default ExcalidrawApp;
