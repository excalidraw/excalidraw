import polyfill from "../polyfill";
import LanguageDetector from "i18next-browser-languagedetector";
import { TopErrorBoundary } from "../components/TopErrorBoundary";
import { APP_NAME } from "../constants";
import { loadFromBlob } from "../data/blob";
import { t } from "../i18n";
import { Excalidraw, defaultLang } from "../packages/excalidraw/index";
import { ExcalidrawImperativeAPI, ExcalidrawInitialDataState } from "../types";
import {
  FIREBASE_STORAGE_PREFIXES,
  STORAGE_KEYS,
  SYNC_BROWSER_TABS_TIMEOUT,
} from "./app_constants";
import Collab, {
  CollabAPI,
  collabAPIAtom,
  collabDialogShownAtom,
  isCollaboratingAtom,
} from "./collab/Collab";
import { getCollaborationLinkData, loadScene } from "./data";
import {
  getLibraryItemsFromStorage,
  importFromLocalStorage,
  importUsernameFromLocalStorage,
} from "./data/localStorage";

import "./index.scss";
import clsx from "clsx";
import { atom, Provider, useAtom } from "jotai";
import { jotaiStore, useAtomWithInitialValue } from "../jotai";
import { reconcileElements } from "./collab/reconciliation";

polyfill();

window.EXCALIDRAW_THROTTLE_RENDER = true;

const languageDetector = new LanguageDetector();
languageDetector.init({
  languageUtils: {},
});

const currentLangCode = languageDetector.detect() || defaultLang.code;

export const langCodeAtom = atom(
  Array.isArray(currentLangCode) ? currentLangCode[0] : currentLangCode,
);

const ExcalidrawWrapper = () => {
  // const [errorMessage, setErrorMessage] = useState("");
  // const [langCode, setLangCode] = useAtom(langCodeAtom);
  // // initial state
  // // ---------------------------------------------------------------------------

  // const initialStatePromiseRef = useRef<{
  //   promise: ResolvablePromise<ExcalidrawInitialDataState | null>;
  // }>({ promise: null! });
  // if (!initialStatePromiseRef.current.promise) {
  //   initialStatePromiseRef.current.promise =
  //     resolvablePromise<ExcalidrawInitialDataState | null>();
  // }

  // useEffect(() => {
  //   trackEvent("load", "frame", getFrame());
  //   // Delayed so that the app has a time to load the latest SW
  //   setTimeout(() => {
  //     trackEvent("load", "version", getVersion());
  //   }, VERSION_TIMEOUT);
  // }, []);

  // const [excalidrawAPI, excalidrawRefCallback] =
  //   useCallbackRefState<ExcalidrawImperativeAPI>();

  // const [collabAPI] = useAtom(collabAPIAtom);
  // const [, setCollabDialogShown] = useAtom(collabDialogShownAtom);
  // const [isCollaborating] = useAtomWithInitialValue(isCollaboratingAtom, () => {
  //   return isCollaborationLink(window.location.href);
  // });

  // useHandleLibrary({
  //   excalidrawAPI,
  //   getInitialLibraryItems: getLibraryItemsFromStorage,
  // });

  // useEffect(() => {
  //   if (!collabAPI || !excalidrawAPI) {
  //     return;
  //   }

  //   const loadImages = (
  //     data: ResolutionType<typeof initializeScene>,
  //     isInitialLoad = false,
  //   ) => {
  //     if (!data.scene) {
  //       return;
  //     }
  //     if (collabAPI.isCollaborating()) {
  //       if (data.scene.elements) {
  //         collabAPI
  //           .fetchImageFilesFromFirebase({
  //             elements: data.scene.elements,
  //             forceFetchFiles: true,
  //           })
  //           .then(({ loadedFiles, erroredFiles }) => {
  //             excalidrawAPI.addFiles(loadedFiles);
  //             updateStaleImageStatuses({
  //               excalidrawAPI,
  //               erroredFiles,
  //               elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
  //             });
  //           });
  //       }
  //     } else {
  //       const fileIds =
  //         data.scene.elements?.reduce((acc, element) => {
  //           if (isInitializedImageElement(element)) {
  //             return acc.concat(element.fileId);
  //           }
  //           return acc;
  //         }, [] as FileId[]) || [];

  //       if (data.isExternalScene) {
  //         loadFilesFromFirebase(
  //           `${FIREBASE_STORAGE_PREFIXES.shareLinkFiles}/${data.id}`,
  //           data.key,
  //           fileIds,
  //         ).then(({ loadedFiles, erroredFiles }) => {
  //           excalidrawAPI.addFiles(loadedFiles);
  //           updateStaleImageStatuses({
  //             excalidrawAPI,
  //             erroredFiles,
  //             elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
  //           });
  //         });
  //       } else if (isInitialLoad) {
  //         if (fileIds.length) {
  //           LocalData.fileStorage
  //             .getFiles(fileIds)
  //             .then(({ loadedFiles, erroredFiles }) => {
  //               if (loadedFiles.length) {
  //                 excalidrawAPI.addFiles(loadedFiles);
  //               }
  //               updateStaleImageStatuses({
  //                 excalidrawAPI,
  //                 erroredFiles,
  //                 elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
  //               });
  //             });
  //         }
  //         // on fresh load, clear unused files from IDB (from previous
  //         // session)
  //         LocalData.fileStorage.clearObsoleteFiles({ currentFileIds: fileIds });
  //       }
  //     }
  //   };

  //   initializeScene({ collabAPI, excalidrawAPI }).then(async (data) => {
  //     loadImages(data, /* isInitialLoad */ true);
  //     initialStatePromiseRef.current.promise.resolve(data.scene);
  //   });

  //   const onHashChange = async (event: HashChangeEvent) => {
  //     event.preventDefault();
  //     const libraryUrlTokens = parseLibraryTokensFromUrl();
  //     if (!libraryUrlTokens) {
  //       if (
  //         collabAPI.isCollaborating() &&
  //         !isCollaborationLink(window.location.href)
  //       ) {
  //         collabAPI.stopCollaboration(false);
  //       }
  //       excalidrawAPI.updateScene({ appState: { isLoading: true } });

  //       initializeScene({ collabAPI, excalidrawAPI }).then((data) => {
  //         loadImages(data);
  //         if (data.scene) {
  //           excalidrawAPI.updateScene({
  //             ...data.scene,
  //             ...restore(data.scene, null, null),
  //             commitToHistory: true,
  //           });
  //         }
  //       });
  //     }
  //   };

  //   const titleTimeout = setTimeout(
  //     () => (document.title = APP_NAME),
  //     TITLE_TIMEOUT,
  //   );

  //   const syncData = debounce(() => {
  //     if (isTestEnv()) {
  //       return;
  //     }
  //     if (!document.hidden && !collabAPI.isCollaborating()) {
  //       // don't sync if local state is newer or identical to browser state
  //       if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)) {
  //         const localDataState = importFromLocalStorage();
  //         const username = importUsernameFromLocalStorage();
  //         let langCode = languageDetector.detect() || defaultLang.code;
  //         if (Array.isArray(langCode)) {
  //           langCode = langCode[0];
  //         }
  //         setLangCode(langCode);
  //         excalidrawAPI.updateScene({
  //           ...localDataState,
  //         });
  //         excalidrawAPI.updateLibrary({
  //           libraryItems: getLibraryItemsFromStorage(),
  //         });
  //         collabAPI.setUsername(username || "");
  //       }

  //       if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_FILES)) {
  //         const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
  //         const currFiles = excalidrawAPI.getFiles();
  //         const fileIds =
  //           elements?.reduce((acc, element) => {
  //             if (
  //               isInitializedImageElement(element) &&
  //               // only load and update images that aren't already loaded
  //               !currFiles[element.fileId]
  //             ) {
  //               return acc.concat(element.fileId);
  //             }
  //             return acc;
  //           }, [] as FileId[]) || [];
  //         if (fileIds.length) {
  //           LocalData.fileStorage
  //             .getFiles(fileIds)
  //             .then(({ loadedFiles, erroredFiles }) => {
  //               if (loadedFiles.length) {
  //                 excalidrawAPI.addFiles(loadedFiles);
  //               }
  //               updateStaleImageStatuses({
  //                 excalidrawAPI,
  //                 erroredFiles,
  //                 elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
  //               });
  //             });
  //         }
  //       }
  //     }
  //   }, SYNC_BROWSER_TABS_TIMEOUT);

  //   const onUnload = () => {
  //     LocalData.flushSave();
  //   };

  //   const visibilityChange = (event: FocusEvent | Event) => {
  //     if (event.type === EVENT.BLUR || document.hidden) {
  //       LocalData.flushSave();
  //     }
  //     if (
  //       event.type === EVENT.VISIBILITY_CHANGE ||
  //       event.type === EVENT.FOCUS
  //     ) {
  //       syncData();
  //     }
  //   };

  //   window.addEventListener(EVENT.HASHCHANGE, onHashChange, false);
  //   window.addEventListener(EVENT.UNLOAD, onUnload, false);
  //   window.addEventListener(EVENT.BLUR, visibilityChange, false);
  //   document.addEventListener(EVENT.VISIBILITY_CHANGE, visibilityChange, false);
  //   window.addEventListener(EVENT.FOCUS, visibilityChange, false);
  //   return () => {
  //     window.removeEventListener(EVENT.HASHCHANGE, onHashChange, false);
  //     window.removeEventListener(EVENT.UNLOAD, onUnload, false);
  //     window.removeEventListener(EVENT.BLUR, visibilityChange, false);
  //     window.removeEventListener(EVENT.FOCUS, visibilityChange, false);
  //     document.removeEventListener(
  //       EVENT.VISIBILITY_CHANGE,
  //       visibilityChange,
  //       false,
  //     );
  //     clearTimeout(titleTimeout);
  //   };
  // }, [collabAPI, excalidrawAPI, setLangCode]);

  // useEffect(() => {
  //   const unloadHandler = (event: BeforeUnloadEvent) => {
  //     LocalData.flushSave();

  //     if (
  //       excalidrawAPI &&
  //       LocalData.fileStorage.shouldPreventUnload(
  //         excalidrawAPI.getSceneElements(),
  //       )
  //     ) {
  //       preventUnload(event);
  //     }
  //   };
  //   window.addEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
  //   return () => {
  //     window.removeEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
  //   };
  // }, [excalidrawAPI]);

  // useEffect(() => {
  //   languageDetector.cacheUserLanguage(langCode);
  // }, [langCode]);

  // const [theme, setTheme] = useState<Theme>(
  //   () =>
  //     localStorage.getItem(STORAGE_KEYS.LOCAL_STORAGE_THEME) ||
  //     // FIXME migration from old LS scheme. Can be removed later. #5660
  //     importFromLocalStorage().appState?.theme ||
  //     THEME.LIGHT,
  // );

  // useEffect(() => {
  //   localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_THEME, theme);
  //   // currently only used for body styling during init (see public/index.html),
  //   // but may change in the future
  //   document.documentElement.classList.toggle("dark", theme === THEME.DARK);
  // }, [theme]);

  // const onChange = (
  //   elements: readonly ExcalidrawElement[],
  //   appState: AppState,
  //   files: BinaryFiles,
  // ) => {
  //   if (collabAPI?.isCollaborating()) {
  //     collabAPI.syncElements(elements);
  //   }

  //   setTheme(appState.theme);

  //   // this check is redundant, but since this is a hot path, it's best
  //   // not to evaludate the nested expression every time
  //   if (!LocalData.isSavePaused()) {
  //     LocalData.save(elements, appState, files, () => {
  //       if (excalidrawAPI) {
  //         let didChange = false;

  //         const elements = excalidrawAPI
  //           .getSceneElementsIncludingDeleted()
  //           .map((element) => {
  //             if (
  //               LocalData.fileStorage.shouldUpdateImageElementStatus(element)
  //             ) {
  //               const newElement = newElementWith(element, { status: "saved" });
  //               if (newElement !== element) {
  //                 didChange = true;
  //               }
  //               return newElement;
  //             }
  //             return element;
  //           });

  //         if (didChange) {
  //           excalidrawAPI.updateScene({
  //             elements,
  //           });
  //         }
  //       }
  //     });
  //   }
  // };

  // const onExportToBackend = async (
  //   exportedElements: readonly NonDeletedExcalidrawElement[],
  //   appState: AppState,
  //   files: BinaryFiles,
  //   canvas: HTMLCanvasElement | null,
  // ) => {
  //   if (exportedElements.length === 0) {
  //     return window.alert(t("alerts.cannotExportEmptyCanvas"));
  //   }
  //   if (canvas) {
  //     try {
  //       await exportToBackend(
  //         exportedElements,
  //         {
  //           ...appState,
  //           viewBackgroundColor: appState.exportBackground
  //             ? appState.viewBackgroundColor
  //             : getDefaultAppState().viewBackgroundColor,
  //         },
  //         files,
  //       );
  //     } catch (error: any) {
  //       if (error.name !== "AbortError") {
  //         const { width, height } = canvas;
  //         console.error(error, { width, height });
  //         setErrorMessage(error.message);
  //       }
  //     }
  //   }
  // };

  // const renderCustomStats = (
  //   elements: readonly NonDeletedExcalidrawElement[],
  //   appState: AppState,
  // ) => {
  //   return (
  //     <CustomStats
  //       setToast={(message) => excalidrawAPI!.setToast({ message })}
  //       appState={appState}
  //       elements={elements}
  //     />
  //   );
  // };

  // const onLibraryChange = async (items: LibraryItems) => {
  //   if (!items.length) {
  //     localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_LIBRARY);
  //     return;
  //   }
  //   const serializedItems = JSON.stringify(items);
  //   localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_LIBRARY, serializedItems);
  // };

  return (
    <div
      style={{ width: "926px", height: "500px" }}
      className={clsx("excalidraw-app", {})}
    >
      <Excalidraw
        ref={(api) => {
          console.log(api);
        }}
        // onChange={onChange}
        // initialData={initialStatePromiseRef.current.promise}
        // isCollaborating={isCollaborating}
        // onPointerUpdate={collabAPI?.onPointerUpdate}
        // UIOptions={{
        //   canvasActions: {
        //     toggleTheme: true,
        //     export: {
        //       onExportToBackend,
        //       renderCustomUI: (elements, appState, files) => {
        //         return (
        //           <ExportToExcalidrawPlus
        //             elements={elements}
        //             appState={appState}
        //             files={files}
        //             onError={(error) => {
        //               excalidrawAPI?.updateScene({
        //                 appState: {
        //                   errorMessage: error.message,
        //                 },
        //               });
        //             }}
        //           />
        //         );
        //       },
        //     },
        //   },
        // }}
        // langCode={langCode}
        // renderCustomStats={renderCustomStats}
        // detectScroll={false}
        // handleKeyboardGlobally={true}
        // onLibraryChange={onLibraryChange}
        // autoFocus={true}
        // theme={theme}
        // renderTopRightUI={(isMobile) => {
        //   if (isMobile) {
        //     return null;
        //   }
        //   return (
        //     <LiveCollaborationTrigger
        //       isCollaborating={isCollaborating}
        //       onSelect={() => setCollabDialogShown(true)}
        //     />
        //   );
        // }}
      ></Excalidraw>
    </div>
  );
};

const ExcalidrawApp = () => {
  return (
    <TopErrorBoundary>
      <Provider unstable_createStore={() => jotaiStore}>
        <ExcalidrawWrapper />
      </Provider>
    </TopErrorBoundary>
  );
};

export default ExcalidrawApp;
