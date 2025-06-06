import {
  Excalidraw,
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

import { newEmbeddableElement } from "@excalidraw/element/newElement";
import { AutoOrganizer } from "@excalidraw/element/autoOrganizer";
import { getRabbitGroupsFromElements } from "@excalidraw/element/rabbitGroupUtils";
import {
  newRabbitSearchBoxElement,
  newRabbitImageElement,
  newRabbitImageTabsElement,
  newRabbitColorPalette,
} from "@excalidraw/element/newRabbitElement";
import ColorThief from "colorthief";

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

import { getSearchBoxText } from "@excalidraw/element/newRabbitElement";
import { useRabbitSearchBoxHandlers } from "@excalidraw/element/rabbitElementHandlers";
import { RabbitImageWindow } from "@excalidraw/element/RabbitImageWindow";

import { GoogleGenAI } from "@google/genai";

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

import { searchAndSaveImages } from "../scripts/rabbit_scripts/try_again";

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
import { collabErrorIndicatorAtom } from "./collab/CollabError";
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
import type { RabbitSearchBoxElement } from "../packages/element/src/rabbitElement";

const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

async function generateBetterSearchQuery(
  originalSearch: string,
  extension: string,
): Promise<string> {
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
        systemInstruction:
          "You are a helpful assistant that creates natural search queries. Only respond with the optimized search query.",
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
  type ImageResult = {
    link: string;
    title?: string;
    snippet?: string;
    thumbnail?: string;
  };

  type TabImage = {
    id: string;
    src: string;
    alt: string;
    name: string;
  };

  type TabData = {
    name: string;
    images: TabImage[];
    searchQuery?: string;
    loaded?: boolean;
  };

  const [isImageWindowVisible, setImageWindowVisible] = useState(false);
  const [tabData, setTabData] = useState<TabData[]>([]);

  // consts for auto-organizer
  const [currentSearchQuery, setCurrentSearchQuery] = useState("");
  const [autoOrganizer, setAutoOrganizer] = useState<AutoOrganizer | null>(
    null,
  );

  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  const handleImageSelect = (image: any) => {
    setSelectedImages((prev) => [...prev, image.id]);
  };

  const handleImageDeselect = (image: any) => {
    setSelectedImages((prev) => prev.filter((id) => id !== image.id));
  };

  const handleAddToCanvas = async (
    selectedImageIds: string[],
    shouldAutoOrganize: boolean = true,
  ) => {
    if (!excalidrawAPI) return;

    const selectedImageData = selectedImageIds
      .map((id) => {
        for (const tab of tabData) {
          const image = tab.images.find((img) => img.id === id);
          if (image) return image;
        }
        return null;
      })
      .filter(
        (imageData): imageData is NonNullable<typeof imageData> =>
          imageData !== null,
      );

    if (selectedImageData.length === 0) {
      excalidrawAPI.setToast({
        message: "No images selected to add to canvas.",
        duration: 2000,
      });
      return;
    }

    const MAX_WIDTH = 200;
    const MAX_HEIGHT = 200;
    const MARGIN = 30;
    const START_X = 100;
    const START_Y = 100;

    // Calculate grid layout
    const imageCount = selectedImageData.length;
    const cols = Math.ceil(Math.sqrt(imageCount));

    const elementsWithDimensions = await Promise.all(
      selectedImageData.map((imageData, index) => {
        return new Promise<any>((resolve) => {
          // Calculate grid position
          const col = index % cols;
          const row = Math.floor(index / cols);
          const x = START_X + col * (MAX_WIDTH + MARGIN);
          const y = START_Y + row * (MAX_HEIGHT + MARGIN);

          // Check if this is from Internet webpages tab
          if (imageData.id.startsWith("youtube")) {
            // Create embedded YouTube iframe instead of image
            const embedElement = newEmbeddableElement({
              type: "embeddable",
              x: x,
              y: y,
              width: 560,
              height: 315,
              link: imageData.src,
            });
            resolve(embedElement);
          } else if (imageData.id.startsWith("internet webpages")) {
            const element = newRabbitImageElement({
              x: x,
              y: y,
              imageUrl: imageData.src, // Use original URL
              width: MAX_WIDTH * 1.5,
              height: 60,
              label: imageData.name,
            });
            resolve(element);
          } else {
            const img = new Image();
            img.onload = () => {
              let scaledWidth = img.width;
              let scaledHeight = img.height;

              // Scale down if width is too large
              if (scaledWidth > MAX_WIDTH) {
                const ratio = MAX_WIDTH / scaledWidth;
                scaledWidth = MAX_WIDTH;
                scaledHeight = scaledHeight * ratio;
              }

              // Scale down further if height is still too large
              if (scaledHeight > MAX_HEIGHT) {
                const ratio = MAX_HEIGHT / scaledHeight;
                scaledHeight = MAX_HEIGHT;
                scaledWidth = scaledWidth * ratio;
              }

              // Calculate grid position
              const col = index % cols;
              const row = Math.floor(index / cols);

              const x = START_X + col * (MAX_WIDTH + MARGIN);
              const y = START_Y + row * (MAX_HEIGHT + MARGIN);

              // Use original image URL instead of Cloudinary
              const element = newRabbitImageElement({
                x: x,
                y: y,
                imageUrl: imageData.src, // Use original URL directly
                width: scaledWidth,
                height: scaledHeight,
                label: imageData.name,
              });
              resolve(element);
            };

            img.onerror = () => {
              const col = index % cols;
              const row = Math.floor(index / cols);
              const x = START_X + col * (MAX_WIDTH + MARGIN);
              const y = START_Y + row * (MAX_HEIGHT + MARGIN);

              // Use original image URL instead of Cloudinary
              const element = newRabbitImageElement({
                x: x,
                y: y,
                imageUrl: imageData.src, // Use original URL directly
                width: MAX_WIDTH,
                height: MAX_HEIGHT,
                label: imageData.name,
              });
              resolve(element);
            };

            img.src = imageData.src;
          }
        });
      }),
    );

    excalidrawAPI.updateScene({
      elements: [...excalidrawAPI.getSceneElements(), ...elementsWithDimensions],
    });

    // Auto-organization if enabled
    if (shouldAutoOrganize && autoOrganizer && currentSearchQuery) {
      setTimeout(async () => {
        await autoOrganizer.enhanceAddToCanvas(
          selectedImageIds,
          currentSearchQuery,
          tabData,
          () => {}, // Empty since images already added
        );
      }, 100);
    }

    setSelectedImages([]);
  };

  const [errorMessage, setErrorMessage] = useState("");

  const handleTabClick = async (tabName: string, tabIndex: number) => {
    const currentTab = tabData[tabIndex];

    // Only load if not already loaded and has a search query
    if (!currentTab.loaded && currentTab.searchQuery) {
      try {
        let newImages: ImageResult[] = [];

        if (tabName === "Pinterest") {
          // Pinterest-specific search with siteRestrict = true
          newImages = await searchAndSaveImages(currentTab.searchQuery, true);
        } else if (tabName === "YouTube") {
          newImages = await searchAndSaveImages(
            currentTab.searchQuery,
            false,
            true,
            true,
          );
        } else if (tabName === "Internet webpages") {
          // General search for now (you can add YouTube restriction later)
          newImages = await searchAndSaveImages(
            currentTab.searchQuery,
            false,
            true,
          );
        }

        // Update the specific tab with results
        const updatedTabs = [...tabData];
        updatedTabs[tabIndex] = {
          ...currentTab,
          images: newImages.slice(0, 10).map((img: ImageResult, i: number) => {
            return {
              id: `${tabName.toLowerCase()}-${i}`,
              src: img.link,
              displayImage: tabName === "YouTube" ? img.thumbnail : img.link,
              alt: img.title || `${tabName} Result ${i + 1}`,
              name: img.title || `${tabName} ${i + 1}`,
              snippet: img.snippet,
            };
          }),
          loaded: true, // Mark as loaded
        };

        setTabData(updatedTabs);

        excalidrawAPI?.setToast({
          message: `${tabName} results loaded!`,
          duration: 2000,
        });
      } catch (error) {
        console.error(`Error loading ${tabName} results:`, error);
        excalidrawAPI?.setToast({
          message: `Error loading ${tabName} results. Please try again.`,
          duration: 3000,
        });
      }
    }
  };

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
  const [isCollaborating] = useAtomWithInitialValue(
    isCollaboratingAtom,
    () => {
      return isCollaborationLink(window.location.href);
    },
  );
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

  const [showExtendedSearch, setShowExtendedSearch] = useState(false);
  const [extendedSearchInput, setExtendedSearchInput] = useState("");
  const [originalSearchQuery, setOriginalSearchQuery] = useState("");

  const handleRabbitSearch = useCallback(() => {
    if (!excalidrawAPI) return;

    // Create and add search box
    const searchBox = newRabbitSearchBoxElement({
      x: 650,
      y: 350,
      text: "Search...",
      fontSize: 16,
      fontFamily: FONT_FAMILY.Virgil,
      textAlign: "left",
      verticalAlign: "middle",
      hasIcon: true,
    });

    // Add box to scene
    excalidrawAPI.updateScene({
      elements: [...excalidrawAPI.getSceneElements(), searchBox],
    });

    excalidrawAPI.setToast({
      message:
        "Double-click on the search box to edit. Press Enter to confirm and search for images. Press Ctrl+T for extended search.",
      duration: 5000,
    });

    let hasSearched = false;
    let lastSearchQuery = "";

    const handleKeyDown = async (event: KeyboardEvent) => {
      const currentElements = excalidrawAPI.getSceneElements();
      const currentSearchBox = currentElements.find(
        (el) => el.type === "rabbit-searchbox" && el.id === searchBox.id,
      ) as RabbitSearchBoxElement;

      if (!currentSearchBox) return;

      const searchQuery = getSearchBoxText(currentSearchBox);

      // Handle Enter key for regular search
      if (event.key === "Enter") {
        if (
          searchQuery !== "Search..." &&
          searchQuery.trim() !== "" &&
          searchQuery.length > 2 &&
          searchQuery !== lastSearchQuery
        ) {
          lastSearchQuery = searchQuery;
          hasSearched = true;
          setCurrentSearchQuery(searchQuery);
          setOriginalSearchQuery(searchQuery); // Store for extended search

          // Perform initial search
          performSearch(searchQuery);
        }
      }

      // Handle Ctrl+E for extended search
      if (event.ctrlKey && event.key === "t") {
        event.preventDefault();

        if (
          searchQuery !== "Search..." &&
          searchQuery.trim() !== "" &&
          searchQuery.length > 2
        ) {
          setOriginalSearchQuery(searchQuery);
          setShowExtendedSearch(true);
          setExtendedSearchInput("");

          excalidrawAPI.setToast({
            message: `Extended search mode activated for: "${searchQuery}". Add your extension term.`,
            duration: 3000,
          });
        } else {
          excalidrawAPI.setToast({
            message:
              "Please enter a valid search query first, then press Ctrl+T for extended search.",
            duration: 3000,
          });
        }
      }
    };

    // Function to perform the actual search
    const performSearch = (query: string) => {
      searchAndSaveImages(query, false)
        .then((images: ImageResult[]) => {
          const tabs = [
            {
              name: "Google",
              images: images.slice(0, 10).map((img: ImageResult, i: number) => ({
                id: `google-${i}`,
                src: img.link,
                alt: `Google Result ${i + 1}`,
                name: img.title || `Google ${i + 1}`,
              })),
              loaded: true,
            },
            {
              name: "Pinterest",
              images: [],
              searchQuery: query,
              loaded: false,
            },
            {
              name: "YouTube",
              images: [],
              searchQuery: query,
              loaded: false,
            },
            {
              name: "Internet webpages",
              images: [],
              searchQuery: query,
              loaded: false,
            },
          ];

          setTabData(tabs);
          setImageWindowVisible(true);
          setShowExtendedSearch(false); // Hide extended search after successful search
        })
        .catch((error) => {
          console.error("Search error:", error);
          excalidrawAPI.setToast({
            message: "Search failed. Please try again.",
            duration: 3000,
          });
        });
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [excalidrawAPI, setTabData, setImageWindowVisible]);

  const handleExtendedSearchSubmit = async () => {
    if (!extendedSearchInput.trim()) {
      excalidrawAPI?.setToast({
        message: "Please enter an extension term.",
        duration: 2000,
      });
      return;
    }

    try {
      excalidrawAPI?.setToast({
        message: "Generating enhanced search query...",
        duration: 2000,
      });

      // Use the generateBetterSearchQuery function
      const enhancedQuery = await generateBetterSearchQuery(
        originalSearchQuery,
        extendedSearchInput.trim(),
      );

      setCurrentSearchQuery(enhancedQuery);

      excalidrawAPI?.setToast({
        message: `Searching for: "${enhancedQuery}"`,
        duration: 3000,
      });

      // Perform the enhanced search
      searchAndSaveImages(enhancedQuery, false)
        .then((images: ImageResult[]) => {
          const tabs = [
            {
              name: "Google",
              images: images.slice(0, 10).map((img: ImageResult, i: number) => ({
                id: `google-${i}`,
                src: img.link,
                alt: `Google Result ${i + 1}`,
                name: img.title || `Google ${i + 1}`,
              })),
              loaded: true,
            },
            {
              name: "Pinterest",
              images: [],
              searchQuery: enhancedQuery,
              loaded: false,
            },
            {
              name: "YouTube",
              images: [],
              searchQuery: enhancedQuery,
              loaded: false,
            },
            {
              name: "Internet webpages",
              images: [],
              searchQuery: enhancedQuery,
              loaded: false,
            },
          ];

          setTabData(tabs);
          setImageWindowVisible(true);
          setShowExtendedSearch(false);
          setExtendedSearchInput("");
        })
        .catch((error) => {
          console.error("Enhanced search error:", error);
          excalidrawAPI?.setToast({
            message: "Enhanced search failed. Please try again.",
            duration: 3000,
          });
        });
    } catch (error) {
      console.error("Error generating enhanced query:", error);
      excalidrawAPI?.setToast({
        message:
          "Failed to generate enhanced query. Using simple combination instead.",
        duration: 3000,
      });

      // Fallback to simple combination
      const fallbackQuery = `${extendedSearchInput.trim()} ${originalSearchQuery}`;
      setCurrentSearchQuery(fallbackQuery);

      // Perform fallback search
      searchAndSaveImages(fallbackQuery, false).then((images: ImageResult[]) => {
        const tabs = [
          {
            name: "Google",
            images: images.slice(0, 10).map((img: ImageResult, i: number) => ({
              id: `google-${i}`,
              src: img.link,
              alt: `Google Result ${i + 1}`,
              name: img.title || `Google ${i + 1}`,
            })),
            loaded: true,
          },
          {
            name: "Pinterest",
            images: [],
            searchQuery: fallbackQuery,
            loaded: false,
          },
          {
            name: "YouTube",
            images: [],
            searchQuery: fallbackQuery,
            loaded: false,
          },
          {
            name: "Internet webpages",
            images: [],
            searchQuery: fallbackQuery,
            loaded: false,
          },
        ];

        setTabData(tabs);
        setImageWindowVisible(true);
        setShowExtendedSearch(false);
        setExtendedSearchInput("");
      });
    }
  };

  useEffect(() => {
    (window as any).__handleRabbitSearch = handleRabbitSearch;

    return () => {
      delete (window as any).__handleRabbitSearch;
    };
  }, [handleRabbitSearch]);

  const uploadToImgur = useCallback(async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "rabbithole");

    try {
      const response = await fetch(
        "https://api.cloudinary.com/v1_1/dnv3yidzc/image/upload",
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`);
      }

      const data = await response.json();

      return data.secure_url;
    } catch (error) {
      console.error("Upload error:", error);
      throw new Error("Failed to upload image");
    }
  }, []);

  useEffect(() => {
    (window as any).__uploadToImgur = uploadToImgur;

    return () => {
      delete (window as any).__uploadToImgur;
    };
  }, [uploadToImgur]);

  const predictSearchQueryFromCloudinaryImage = useCallback(
    async (cloudinaryUrl: string): Promise<string> => {
      try {
        const response = await fetch(cloudinaryUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }

        const blob = await response.blob();
        const base64 = await blobToBase64(blob);

        const base64Data = base64.split(",")[1];

        const geminiResponse = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [
            {
              parts: [
                {
                  text: `Analyze this image and predict what search query someone likely used to find it. Consider:

                      1. The main subject or object in the image
                      2. Visual style, colors, or artistic elements
                      3. Context clues like setting, background, or composition
                      4. Any text visible in the image
                      5. The general mood or theme

                      Respond with only the most likely search query that would return this image - be concise and natural, like what someone would actually type into a search engine. Avoid overly descriptive or technical language.

                      Examples of good responses:
                      - "cute golden retriever puppy"
                      - "modern minimalist kitchen"
                      - "sunset mountain landscape"
                      - "vintage red sports car"

                      What search query likely resulted in this image?`,
                },
                {
                  inlineData: {
                    mimeType: blob.type,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          config: {
            systemInstruction: "What is the search query that found this simage?",
          },
        });

        const predictedQuery = geminiResponse.text?.trim() || "";
        return predictedQuery;
      } catch (error) {
        console.error(
          "Error predicting search query from Cloudinary image:",
          error,
        );
        return "image search";
      }
    },
    [],
  );

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
        } else {
          reject(new Error("Failed to convert blob to base64"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  useEffect(() => {
    (window as any).__predictSearchQueryFromCloudinaryImage =
      predictSearchQueryFromCloudinaryImage;

    return () => {
      delete (window as any).__predictSearchQueryFromCloudinaryImage;
    };
  }, [predictSearchQueryFromCloudinaryImage]);

  // color palette handler for color palette button with smart positioning
const handleColorPalette = useCallback(async () => {
  if (!excalidrawAPI) return;

  const selectedElements = excalidrawAPI.getSceneElements().filter(
    element => excalidrawAPI.getAppState().selectedElementIds[element.id]
  );

  const selectedImages = selectedElements.filter(
    element => element.type === 'image' || element.type === 'rabbit-image'
  );

  console.log("Selected elements:", selectedElements.length);
  console.log("Selected images:", selectedImages.length);

  if (selectedImages.length === 0) {
    excalidrawAPI.setToast({
      message: "Please select at least one image",
      duration: 3000
    });
    return;
  }

  excalidrawAPI.setToast({
    message: `Generating color palette for \n${selectedImages.length} selected image(s)...`,
    duration: 3000
  });

  try {
    const allColors: string[] = [];
    const colorThief = new ColorThief();
    const imageColorArrays: string[][] = [];

    //collect colors from all images
    for (const imageElement of selectedImages) {
      try {
        const colors = await extractColorsFromImageElement(imageElement, colorThief, excalidrawAPI);
        imageColorArrays.push(colors);
      } catch (error) {
        console.warn(`Failed to extract colors from image ${imageElement.id}:`, error);
      }
    }

    const finalPalette: string[] = [];
    const maxColors = 5;
    let colorIndex = 0;

    while (finalPalette.length < maxColors && colorIndex < 6) {
      for (const imageColors of imageColorArrays) {
        if (finalPalette.length >= maxColors) break;

        if (imageColors[colorIndex] && !finalPalette.includes(imageColors[colorIndex])) {
          finalPalette.push(imageColors[colorIndex]);
        }
      }
      colorIndex++;
    }

    console.log("Extracted colors from multiple images:", finalPalette);

    // Calculate smart positioning based on selected images
    const { x: paletteX, y: paletteY } = calculatePalettePositionWithCollisionDetection(selectedImages, excalidrawAPI);

    // Create color palette element with calculated position
    const colorPalette = newRabbitColorPalette({
      x: paletteX,
      y: paletteY,
      colors: finalPalette
    });

    excalidrawAPI.updateScene({
      elements: [...excalidrawAPI.getSceneElements(), colorPalette]
    });

    excalidrawAPI.setToast({
      message: `Color palette created near selected images`,
      duration: 3000
    });

  } catch (error) {
    console.error("Error extracting colors:", error);
    excalidrawAPI.setToast({
      message: "Error extracting colors from images",
      duration: 3000
    });
  }
  console.log("Images to process:", selectedImages);
}, [excalidrawAPI]);

//calculate optimal palette position
const calculatePalettePosition = (selectedImages: any[]) => {
  if (selectedImages.length === 0) {
    return { x: 100, y: 100 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  selectedImages.forEach(image => {
    minX = Math.min(minX, image.x);
    minY = Math.min(minY, image.y);
    maxX = Math.max(maxX, image.x + image.width);
    maxY = Math.max(maxY, image.y + image.height);
  });

  const PALETTE_WIDTH = 200; 
  const PALETTE_HEIGHT = 50; 
  const MARGIN = 20; 

  //trying different positions in order of preference
  const positions = [
    // Right of images
    { 
      x: maxX + MARGIN, 
      y: minY,
      description: "right"
    },
    // Below images (centered)
    { 
      x: (minX + maxX) / 2 - PALETTE_WIDTH / 2, 
      y: maxY + MARGIN,
      description: "below-center"
    },
    // Left of images
    { 
      x: minX - PALETTE_WIDTH - MARGIN, 
      y: minY,
      description: "left"
    },
    // Above images (centered)
    { 
      x: (minX + maxX) / 2 - PALETTE_WIDTH / 2, 
      y: minY - PALETTE_HEIGHT - MARGIN,
      description: "above-center"
    },
    // Bottom-right of images
    { 
      x: maxX + MARGIN, 
      y: maxY + MARGIN,
      description: "bottom-right"
    }
  ];

  const chosenPosition = positions[0];
  
  console.log(`Positioning palette ${chosenPosition.description} of selected images at (${Math.round(chosenPosition.x)}, ${Math.round(chosenPosition.y)})`);
  
  return { 
    x: Math.round(chosenPosition.x), 
    y: Math.round(chosenPosition.y) 
  };
};

//collision detection for palette position
const calculatePalettePositionWithCollisionDetection = (selectedImages: any[], excalidrawAPI: any) => {
  if (selectedImages.length === 0) {
    return { x: 100, y: 100 };
  }

  const allElements = excalidrawAPI.getSceneElements();
  
  // Calculate bounding box of selected images
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  selectedImages.forEach(image => {
    minX = Math.min(minX, image.x);
    minY = Math.min(minY, image.y);
    maxX = Math.max(maxX, image.x + image.width);
    maxY = Math.max(maxY, image.y + image.height);
  });

  const PALETTE_WIDTH = 200;
  const PALETTE_HEIGHT = 50;
  const MARGIN = 20;

  const testPositions = [
    { x: maxX + MARGIN, y: minY }, // right
    { x: (minX + maxX) / 2 - PALETTE_WIDTH / 2, y: maxY + MARGIN }, // below
    { x: minX - PALETTE_WIDTH - MARGIN, y: minY }, // left  
    { x: (minX + maxX) / 2 - PALETTE_WIDTH / 2, y: minY - PALETTE_HEIGHT - MARGIN }, // above
  ];

  for (const pos of testPositions) {
    const paletteRect = {
      x: pos.x,
      y: pos.y,
      width: PALETTE_WIDTH,
      height: PALETTE_HEIGHT
    };

    // Check if this position collides with existing elements
    const hasCollision = allElements.some((element: any) => {
      if (selectedImages.includes(element)) return false; // ignore selected images
      
      return (
        element.x < paletteRect.x + paletteRect.width &&
        element.x + element.width > paletteRect.x &&
        element.y < paletteRect.y + paletteRect.height &&
        element.y + element.height > paletteRect.y
      );
    });

    if (!hasCollision) {
      return { x: Math.round(pos.x), y: Math.round(pos.y) };
    }
  }

  //if all positions have collisions, use the first one anyway
  return { x: Math.round(testPositions[0].x), y: Math.round(testPositions[0].y) };
};

  useEffect(() => {
    (window as any).__handleColorPalette = handleColorPalette;

    return () => {
      delete (window as any).__handleColorPalette;
    };
  }, [handleColorPalette]);

  // processes multiple color extractions in parallel
  async function extractColorsFromMultipleImages(
    imageElements: any[],
    colorThief: ColorThief,
    excalidrawAPI: any,
  ): Promise<string[][]> {
    const promises = imageElements.map((imageElement) =>
      extractColorsFromImageElement(imageElement, colorThief, excalidrawAPI),
    );

    const allColors = await Promise.all(promises);
    return allColors;
  }

  const getCloudinaryUrl = (
    originalUrl: string,
    width: number,
    height: number,
  ) => {
    const cloudName = "your-cloud-name";
    const encodedUrl = encodeURIComponent(originalUrl);
    return `https://res.cloudinary.com/${cloudName}/image/fetch/w_${Math.round(
      width,
    )},h_${Math.round(height)},c_fit,f_auto,q_auto/${encodedUrl}`;
  };

  // Helper function to extract colors from an image element
  const extractColorsFromImageElement = async (
    imageElement: any,
    colorThief: ColorThief,
    excalidrawAPI: any,
  ): Promise<string[]> => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    // First, set up the image source
    try {
      if (imageElement.type === "image") {
        const files = excalidrawAPI.getFiles();
        const file = files[imageElement.fileId];

        if (file) {
          if (file.dataURL) {
            img.src = file.dataURL;
          } else {
            throw new Error("No image source found for image");
          }
        }
      } else if (imageElement.type === "rabbit-image") {
        // Use Cloudinary URL for color extraction to ensure CORS compatibility
        const cloudinaryUrl = getCloudinaryUrl(imageElement.imageUrl, 300, 300);
        img.src = cloudinaryUrl;
      }
    } catch (error) {
      throw new Error("Failed to load rabbit image");
    }

    // Then wait for the image to load
    return new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          const dominantColor = colorThief.getColor(img);
          const palette = colorThief.getPalette(img, 5);

          const hexColors = [dominantColor, ...palette].map(
            (rgb) =>
              "#" +
              rgb
                .map((x: number) => x.toString(16).padStart(2, "0"))
                .join(""),
          );

          resolve(hexColors);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error("Failed to load image"));
    });
  };

  useEffect(() => {
    if (excalidrawAPI) {
      setAutoOrganizer(new AutoOrganizer(excalidrawAPI));
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
        `${
          import.meta.env.VITE_APP_PLUS_LP
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
        `${
          import.meta.env.VITE_APP_PLUS_APP
        }?utm_source=excalidraw&utm_medium=app&utm_content=command_palette`,
        "_blank",
      );
    },
  };

  const ExtendedSearchUI = () => {
    if (!showExtendedSearch) return null;

    return (
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "white",
          padding: "20px",
          borderRadius: "12px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          zIndex: 1001,
          minWidth: "400px",
          border: "1px solid #e0e0e0",
          fontFamily:
            "Assistant, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif",
        }}
      >
        <h3
          style={{
            margin: "0 0 15px 0",
            color: "#333",
            fontFamily:
              "Assistant, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif",
          }}
        >
          Extended Search
        </h3>

        <div style={{ marginBottom: "15px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "5px",
              fontWeight: "500",
              color: "#555",
              fontFamily:
                "Assistant, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif",
            }}
          >
            Original Search:
          </label>
          <div
            style={{
              padding: "8px 12px",
              background: "#f5f5f5",
              borderRadius: "6px",
              color: "#666",
              fontStyle: "italic",
              fontFamily:
                "Assistant, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif",
            }}
          >
            {originalSearchQuery}
          </div>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "5px",
              fontWeight: "500",
              color: "#555",
              fontFamily:
                "Assistant, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif",
            }}
          >
            Add Extension:
          </label>
          <input
            type="text"
            value={extendedSearchInput}
            onChange={(e) => setExtendedSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleExtendedSearchSubmit();
              } else if (e.key === "Escape") {
                setShowExtendedSearch(false);
                setExtendedSearchInput("");
              }
            }}
            placeholder="e.g., brown, vintage, modern..."
            style={{
              width: "93%",
              padding: "10px 12px",
              border: "2px solid #ddd",
              borderRadius: "6px",
              fontSize: "14px",
              outline: "none",
              transition: "border-color 0.2s",
              fontFamily:
                "Assistant, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif",
            }}
            autoFocus
          />
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={() => {
              setShowExtendedSearch(false);
              setExtendedSearchInput("");
            }}
            style={{
              padding: "8px 16px",
              border: "1px solid #ddd",
              borderRadius: "6px",
              background: "white",
              cursor: "pointer",
              fontSize: "14px",
              fontFamily:
                "Assistant, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleExtendedSearchSubmit}
            style={{
              padding: "8px 16px",
              border: "none",
              borderRadius: "6px",
              background: "#007bff",
              color: "white",
              cursor: "pointer",
              fontSize: "14px",
              fontFamily:
                "Assistant, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif",
            }}
          >
            Search
          </button>
        </div>

        <div
          style={{
            marginTop: "10px",
            fontSize: "12px",
            color: "#666",
            fontFamily:
              "Assistant, -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif",
          }}
        >
          Press Enter to search, Escape to cancel
        </div>
      </div>
    );
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
          src="https://imgur.com/KttcKbd"
          alt="logo"
          style={{ height: 30, marginRight: 10 }}
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
              {/* {collabError.message && <CollabError collabError={collabError} />}
              <LiveCollaborationTrigger
                isCollaborating={isCollaborating}
                onSelect={() =>
                  setShareDialogState({ isOpen: true, type: "share" })
                }
              /> */}
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
        <AppHeader
          onChange={() => excalidrawAPI?.refresh()}
          excalidrawAPI={excalidrawAPI}
        />
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

                const placeholderImageUrl =
                  "https://vetsonparker.com.au/wp-content/uploads/2015/04/Rabbit-Facts.jpg";

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
                    images, // shorthand for images: images,
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

                  excalidrawAPI.updateScene({
                    elements: [...excalidrawAPI.getSceneElements(), searchBox],
                  });
                  excalidrawAPI.setToast({
                    message:
                      "Double-click on the search box to edit. Press Enter to confirm and log text to console.",
                    duration: 5000,
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
                    message:
                      "Double-click on the search box to edit. Press Enter to confirm and search for images.",
                    duration: 5000,
                  });

                  let hasSearched = false;
                  let lastSearchQuery = ""; //preventing duplicate searches

                  const handleEnterKey = (event: KeyboardEvent) => {
                    if (event.key !== "Enter") return;

                    const currentElements = excalidrawAPI.getSceneElements();
                    const currentSearchBox = currentElements.find(
                      (el) =>
                        el.type === "rabbit-searchbox" && el.id === searchBox.id,
                    ) as RabbitSearchBoxElement;

                    if (currentSearchBox) {
                      const searchQuery = getSearchBoxText(currentSearchBox);

                      // valid and different search query
                      if (
                        searchQuery !== "Search..." &&
                        searchQuery.trim() !== "" &&
                        searchQuery.length > 2 &&
                        searchQuery !== lastSearchQuery
                      ) {
                        lastSearchQuery = searchQuery; // Update last search query
                        hasSearched = true;
                        setCurrentSearchQuery(searchQuery);

                        searchAndSaveImages(searchQuery, false).then(
                          (images: ImageResult[]) => {
                            const tabs = [
                              {
                                name: "Google",
                                images: images
                                  .slice(0, 10)
                                  .map((img: ImageResult, i: number) => ({
                                    id: `google-${i}`,
                                    src: img.link,
                                    alt: `Google Result ${i + 1}`,
                                    name: img.title || `Google ${i + 1}`,
                                  })),
                                loaded: true,
                              },
                              {
                                name: "Pinterest",
                                images: [], // Empty initially will be lazily loaded upon onclick
                                searchQuery: searchQuery, // Store query for later
                                loaded: false, // Mark as not loaded
                              },
                              {
                                name: "YouTube",
                                images: [], // Empty initially will be lazily loaded upon onclick
                                searchQuery: searchQuery, // Store query for later
                                loaded: false, // Mark as not loaded
                              },
                              {
                                name: "Internet webpages",
                                images: [], // Empty initially will be lazily loaded upon onclick
                                searchQuery: searchQuery, // Store query for later
                                loaded: false, // Mark as not loaded
                              },
                            ];
                            setTabData(tabs);
                            setImageWindowVisible(true);
                          },
                        );
                      }
                    }
                  };

                  document.addEventListener("keydown", handleEnterKey);
                }
              },
            },
            {
              label: "Add Rabbit Image",
              category: DEFAULT_CATEGORIES.app,
              predicate: () => true,
              keywords: ["rabbit", "image", "rabbitimage"],

              perform: () => {
                const customQuer = "naruto";
                searchAndSaveImages(customQuer)
                  .then((images) => {
                    // Use the search result here, inside the .then()
                    const searchQuer = images[0]["link"];

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
                        const totalHeight =
                          imageHeight + padding * 2 + labelHeight;

                        const image = newRabbitImageElement({
                          x: 100,
                          y: 300,
                          label,
                          imageUrl,
                          width: totalWidth,
                          height: totalHeight,
                        });

                        excalidrawAPI.updateScene({
                          elements: [
                            ...excalidrawAPI.getSceneElements(),
                            image,
                          ],
                        });
                      };

                      img.onerror = () => {
                        console.error(
                          "Failed to load image for RabbitImageElement",
                        );
                      };

                      img.src = imageUrl;
                    }
                  })
                  .catch((error) => {
                    console.error("Error in image search:", error);
                  });
              },
            },

            {
              label: "Add Rabbit Color Palette",
              category: DEFAULT_CATEGORIES.app,
              keywords: ["palette", "colors", "color-palette", "hex"],
              perform: () => {
                if (excalidrawAPI) {
                  const colorPalette = newRabbitColorPalette({
                    x: 100,
                    y: 100,
                    colors: [
                      "#FF6B6B",
                      "#4ECDC4",
                      "#45B7D1",
                      "#96CEB4",
                      "#FECA57",
                    ],
                  });

                  excalidrawAPI.updateScene({
                    elements: [...excalidrawAPI.getSceneElements(), colorPalette],
                  });
                }
              },
            },

            {
              label: "Add Rabbit Color Palette",
              category: DEFAULT_CATEGORIES.app,
              keywords: ["palette", "colors", "color-palette", "hex"],
              perform: () => {
                if (excalidrawAPI) {
                  const colorPalette = newRabbitColorPalette({
                    x: 100,
                    y: 100,
                    colors: [
                      "#FF6B6B",
                      "#4ECDC4",
                      "#45B7D1",
                      "#96CEB4",
                      "#FECA57",
                    ],
                  });

                  excalidrawAPI.updateScene({
                    elements: [...excalidrawAPI.getSceneElements(), colorPalette],
                  });
                }
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
            {
              label: "Auto-organize: Hierarchical Layout",
              category: DEFAULT_CATEGORIES.app,
              predicate: () => true,
              keywords: ["organize", "layout", "hierarchy", "tree", "dagre"],
              perform: () => {
                if (autoOrganizer) {
                  autoOrganizer.organizeHierarchical();
                  excalidrawAPI?.setToast({
                    message: "Applied hierarchical layout",
                    duration: 2000,
                  });
                }
              },
            },
            {
              label: "Auto-organize: Grid Layout",
              category: DEFAULT_CATEGORIES.app,
              predicate: () => true,
              keywords: ["organize", "layout", "grid", "rows", "columns"],
              perform: () => {
                if (autoOrganizer) {
                  autoOrganizer.organizeGrid();
                  excalidrawAPI?.setToast({
                    message: "Applied grid layout",
                    duration: 2000,
                  });
                }
              },
            },
            {
              label: "Auto-organize: Circular Layout",
              category: DEFAULT_CATEGORIES.app,
              predicate: () => true,
              keywords: ["organize", "layout", "circle", "radial"],
              perform: () => {
                if (autoOrganizer) {
                  autoOrganizer.organizeCircular();
                  excalidrawAPI?.setToast({
                    message: "Applied circular layout",
                    duration: 2000,
                  });
                }
              },
            },
            {
              label: "Auto-organize: Breadth First",
              category: DEFAULT_CATEGORIES.app,
              predicate: () => true,
              keywords: ["organize", "layout", "breadth", "tree"],
              perform: () => {
                if (autoOrganizer) {
                  autoOrganizer.organizeBreadthFirst();
                  excalidrawAPI?.setToast({
                    message: "Applied breadth-first layout",
                    duration: 2000,
                  });
                }
              },
            },
            {
              label: "Remove All Rabbit Groups",
              category: DEFAULT_CATEGORIES.app,
              predicate: () => true,
              keywords: ["ungroup", "remove", "clear", "groups"],
              perform: () => {
                if (excalidrawAPI) {
                  const elements = excalidrawAPI.getSceneElements();
                  const groups = getRabbitGroupsFromElements(elements);

                  const updatedElements = elements.map((element) => {
                    if (element.customData?.rabbitGroup) {
                      const newCustomData = { ...element.customData };
                      delete newCustomData.rabbitGroup;
                      return {
                        ...element,
                        customData:
                          Object.keys(newCustomData).length > 0
                            ? newCustomData
                            : undefined,
                      };
                    }
                    return element;
                  });

                  excalidrawAPI.updateScene({ elements: updatedElements });
                  excalidrawAPI?.setToast({
                    message: `Removed ${groups.size} rabbit groups`,
                    duration: 2000,
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
      {/* Where the rabbit image window shows up*/}
      {excalidrawAPI && isImageWindowVisible && (
        <RabbitImageWindow
          appState={excalidrawAPI.getAppState()}
          selectedImages={selectedImages}
          onImageSelect={handleImageSelect}
          onImageDeselect={handleImageDeselect}
          onToggleVisibility={() => setImageWindowVisible(false)}
          onTabClick={handleTabClick}
          onAddToCanvas={handleAddToCanvas}
          tabData={tabData}
        />
      )}
      <ExtendedSearchUI />

      {excalidrawAPI &&
        (() => {
          const appState = excalidrawAPI.getAppState();
          const elements = excalidrawAPI.getSceneElements();
          const selected = elements.find(
            (el) => appState.selectedElementIds[el.id] && el.type === "text",
          );

          if (selected && !appState.editingTextElement) {
            const { scrollX, scrollY, zoom } = excalidrawAPI.getAppState();
            const x = (selected.x + selected.width / 2) * zoom.value + scrollX;
            const y =
              (selected.y + selected.height + 10) * zoom.value + scrollY;
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
                <button>Internet Webpages</button>
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
