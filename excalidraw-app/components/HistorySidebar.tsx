import clsx from "clsx";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { Button } from "@excalidraw/excalidraw/components/Button";
import { getNonDeletedElements } from "@excalidraw/element";
import { exportToCanvas } from "@excalidraw/utils/export";
import { isTestEnv } from "@excalidraw/common";

import type { OrderedExcalidrawElement } from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import { LocalData } from "../data/LocalData";
import { getCollaborationLinkData } from "../data";
import {
  createCollabRestoreElements,
  isSceneHistoryDeltaRecordable,
  reconstructSceneHistoryData,
  SceneHistory,
} from "../data/SceneHistory";
import { subscribeSceneHistoryFromFirebase } from "../data/firebase";

import "./HistorySidebar.scss";

import type { CollabAPI } from "../collab/Collab";
import type { SceneHistoryData, SceneHistoryEntry } from "../data/SceneHistory";

type HistorySidebarProps = {
  collabAPI: CollabAPI | null;
  excalidrawAPI: ExcalidrawImperativeAPI;
  isCollaborating: boolean;
};

type SceneHistoryProviderProps = {
  collabAPI: CollabAPI | null;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  isCollaborating: boolean;
  children: React.ReactNode;
};

type SceneHistoryContextValue = {
  historyData: SceneHistoryData | null;
  isLoading: boolean;
  errorMessage: string | null;
  isSharedHistory: boolean;
  sessionId: string;
  markNextChangeAsRestore: (sourceEntryId: string) => void;
  reconstructEntry: (entryId: string) => Promise<{
    entry: SceneHistoryEntry;
    elements: OrderedExcalidrawElement[];
    appState: Partial<AppState>;
    files: BinaryFiles;
  } | null>;
};

type PreviewOrigin = {
  elements: readonly OrderedExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
};

const THUMBNAIL_MAX_WIDTH = 160;
const THUMBNAIL_MAX_HEIGHT = 96;
const SCENE_HISTORY_PREVIEW_LOCK = "scene-history-preview";

const SceneHistoryContext = createContext<SceneHistoryContextValue | null>(
  null,
);

type CollabHistorySource = {
  roomId: string;
  roomKey: string;
};

const createSessionId = () => {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
};

const getCollabHistorySource = (
  collabAPI: CollabAPI | null,
  isCollaborating: boolean,
): CollabHistorySource | null => {
  if (!collabAPI || !isCollaborating) {
    return null;
  }

  const activeRoomLink = collabAPI.getActiveRoomLink();
  if (!activeRoomLink) {
    return null;
  }

  return getCollaborationLinkData(activeRoomLink);
};

const createHistoryThumbnail = async (
  elements: readonly OrderedExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
) => {
  const nonDeletedElements = getNonDeletedElements(elements);

  if (!nonDeletedElements.length || isTestEnv()) {
    return null;
  }

  try {
    const canvas = await exportToCanvas({
      elements: nonDeletedElements,
      appState: {
        exportBackground: true,
        exportScale: 1,
        exportWithDarkMode: appState.exportWithDarkMode,
        viewBackgroundColor: appState.viewBackgroundColor,
      },
      files,
      exportPadding: 12,
      getDimensions: (width, height) => {
        const scale = Math.min(
          THUMBNAIL_MAX_WIDTH / width,
          THUMBNAIL_MAX_HEIGHT / height,
          1,
        );

        return {
          width: Math.max(1, Math.round(width * scale)),
          height: Math.max(1, Math.round(height * scale)),
          scale,
        };
      },
    });

    return canvas.toDataURL("image/png");
  } catch (error) {
    console.warn("Failed to render scene history thumbnail:", error);
    return null;
  }
};

const getCurrentScene = (
  excalidrawAPI: ExcalidrawImperativeAPI,
): PreviewOrigin => ({
  elements:
    excalidrawAPI.getSceneElementsIncludingDeleted() as readonly OrderedExcalidrawElement[],
  appState: excalidrawAPI.getAppState(),
  files: excalidrawAPI.getFiles(),
});

const addFilesToScene = (
  excalidrawAPI: ExcalidrawImperativeAPI,
  files: BinaryFiles,
) => {
  const fileData = Object.values(files);

  if (fileData.length) {
    excalidrawAPI.addFiles(fileData);
  }
};

const formatEntryTime = (timestamp: number) => {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
};

const getEntryTitle = (entry: SceneHistoryEntry) => {
  if (entry.kind === "initial") {
    return "Initial version";
  }

  if (entry.kind === "restore") {
    return "Restore";
  }

  return `Version ${entry.sequence}`;
};

const useSceneHistoryContext = () => {
  const context = useContext(SceneHistoryContext);

  if (!context) {
    throw new Error("SceneHistoryProvider is missing");
  }

  return context;
};

export const SceneHistoryProvider = ({
  collabAPI,
  excalidrawAPI,
  isCollaborating,
  children,
}: SceneHistoryProviderProps) => {
  const sessionIdRef = useRef(createSessionId());
  const recordQueueRef = useRef(Promise.resolve());
  const isMountedRef = useRef(false);
  const pendingRestoreRef = useRef<{ sourceEntryId: string } | null>(null);
  const [historyData, setHistoryData] = useState<SceneHistoryData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const collabHistorySource = getCollabHistorySource(
    collabAPI,
    isCollaborating,
  );
  const collabRoomId = collabHistorySource?.roomId ?? null;
  const collabRoomKey = collabHistorySource?.roomKey ?? null;
  const isSharedHistory = !!collabHistorySource;

  const setHistoryState = useCallback((nextHistoryData: SceneHistoryData) => {
    setHistoryData(nextHistoryData);
  }, []);

  const markNextChangeAsRestore = useCallback(
    (sourceEntryId: string) => {
      if (isSharedHistory) {
        collabAPI?.markNextHistorySaveAsRestore(sourceEntryId);
        return;
      }

      pendingRestoreRef.current = { sourceEntryId };
      window.setTimeout(() => {
        if (pendingRestoreRef.current?.sourceEntryId === sourceEntryId) {
          pendingRestoreRef.current = null;
        }
      }, 500);
    },
    [collabAPI, isSharedHistory],
  );

  const reconstructEntry = useCallback(
    async (entryId: string) => {
      if (isSharedHistory) {
        return historyData
          ? reconstructSceneHistoryData(historyData, entryId)
          : null;
      }

      return SceneHistory.reconstruct(entryId);
    },
    [historyData, isSharedHistory],
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!excalidrawAPI || isSharedHistory) {
      setHistoryData(null);
      setIsLoading(false);
      return;
    }

    let isActive = true;

    setIsLoading(true);
    recordQueueRef.current = recordQueueRef.current
      .then(async () => {
        const scene = getCurrentScene(excalidrawAPI);
        const thumbnail = await createHistoryThumbnail(
          scene.elements,
          scene.appState,
          scene.files,
        );
        const nextHistoryData = await SceneHistory.ensureInitialized({
          sessionId: sessionIdRef.current,
          elements: scene.elements,
          appState: scene.appState,
          files: scene.files,
          thumbnail,
        });

        if (isActive && isMountedRef.current) {
          setHistoryState(nextHistoryData);
          setErrorMessage(null);
        }
      })
      .catch((error) => {
        console.error(error);

        if (isActive && isMountedRef.current) {
          setErrorMessage("History is unavailable");
        }
      })
      .finally(() => {
        if (isActive && isMountedRef.current) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [excalidrawAPI, isSharedHistory, setHistoryState]);

  useEffect(() => {
    if (!excalidrawAPI || !collabRoomId || !collabRoomKey) {
      return;
    }

    let isActive = true;

    setHistoryData(null);
    setIsLoading(true);

    const unsubscribe = subscribeSceneHistoryFromFirebase({
      roomId: collabRoomId,
      roomKey: collabRoomKey,
      onChange: (nextHistoryData) => {
        if (isActive && isMountedRef.current) {
          setHistoryState(nextHistoryData);
          setErrorMessage(null);
          setIsLoading(false);
        }
      },
      onError: (error) => {
        console.error(error);

        if (isActive && isMountedRef.current) {
          setErrorMessage("Shared history is unavailable");
          setIsLoading(false);
        }
      },
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [collabRoomId, collabRoomKey, excalidrawAPI, setHistoryState]);

  useEffect(() => {
    if (!excalidrawAPI || isSharedHistory) {
      return;
    }

    let isActive = true;
    const unsubscribe = excalidrawAPI.onIncrement((increment) => {
      if (increment.type !== "durable" || !("delta" in increment)) {
        return;
      }

      const restoreMetadata = pendingRestoreRef.current;
      if (!isSceneHistoryDeltaRecordable(increment.delta)) {
        if (restoreMetadata) {
          pendingRestoreRef.current = null;
        }
        return;
      }

      const scene = getCurrentScene(excalidrawAPI);
      pendingRestoreRef.current = null;
      recordQueueRef.current = recordQueueRef.current
        .then(async () => {
          const thumbnail = await createHistoryThumbnail(
            scene.elements,
            scene.appState,
            scene.files,
          );
          const nextHistoryData = await SceneHistory.append({
            sessionId: sessionIdRef.current,
            elements: scene.elements,
            appState: scene.appState,
            files: scene.files,
            thumbnail,
            delta: increment.delta,
            kind: restoreMetadata ? "restore" : "change",
            restoreSourceId: restoreMetadata?.sourceEntryId,
          });

          if (isActive && isMountedRef.current) {
            setHistoryState(nextHistoryData);
            setErrorMessage(null);
          }
        })
        .catch((error) => {
          console.error(error);
          if (isActive && isMountedRef.current) {
            setErrorMessage("History was not saved");
          }
        });
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [excalidrawAPI, isSharedHistory, setHistoryState]);

  const value = useMemo(
    () => ({
      historyData,
      isLoading,
      errorMessage,
      isSharedHistory,
      sessionId: sessionIdRef.current,
      markNextChangeAsRestore,
      reconstructEntry,
    }),
    [
      errorMessage,
      historyData,
      isLoading,
      isSharedHistory,
      markNextChangeAsRestore,
      reconstructEntry,
    ],
  );

  return (
    <SceneHistoryContext.Provider value={value}>
      {children}
    </SceneHistoryContext.Provider>
  );
};

export const HistorySidebar = ({
  collabAPI,
  excalidrawAPI,
  isCollaborating,
}: HistorySidebarProps) => {
  const {
    historyData,
    isLoading,
    errorMessage: historyErrorMessage,
    isSharedHistory,
    sessionId,
    markNextChangeAsRestore,
    reconstructEntry,
  } = useSceneHistoryContext();
  const previewOriginRef = useRef<PreviewOrigin | null>(null);
  const previewRequestIdRef = useRef(0);
  const isMountedRef = useRef(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [previewEntryId, setPreviewEntryId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const entries = useMemo(
    () => [...(historyData?.entries ?? [])].reverse(),
    [historyData],
  );

  const selectedEntry = historyData?.entries.find(
    (entry) => entry.id === selectedEntryId,
  );
  const isPreviewing = !!previewEntryId;
  const visibleErrorMessage = errorMessage || historyErrorMessage;

  const addTargetFilesToScene = useCallback(
    async (target: {
      elements: readonly OrderedExcalidrawElement[];
      files: BinaryFiles;
    }) => {
      addFilesToScene(excalidrawAPI, target.files);

      if (isSharedHistory && collabAPI) {
        const { loadedFiles } = await collabAPI.fetchImageFilesFromFirebase({
          elements: target.elements,
          forceFetchFiles: true,
        });

        if (loadedFiles.length) {
          excalidrawAPI.addFiles(loadedFiles);
        }
      }
    },
    [collabAPI, excalidrawAPI, isSharedHistory],
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isPreviewing) {
      setSelectedEntryId(historyData?.currentEntryId ?? null);
    }
  }, [historyData?.currentEntryId, isPreviewing]);

  const cancelPreview = useCallback(() => {
    previewRequestIdRef.current++;
    const origin = previewOriginRef.current;

    if (!origin) {
      return;
    }

    addFilesToScene(excalidrawAPI, origin.files);
    excalidrawAPI.updateScene({
      elements: origin.elements,
      appState: origin.appState,
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    LocalData.resumeSave(SCENE_HISTORY_PREVIEW_LOCK);
    collabAPI?.resumeSync(SCENE_HISTORY_PREVIEW_LOCK);
    previewOriginRef.current = null;
    setPreviewEntryId(null);
    setSelectedEntryId(historyData?.currentEntryId ?? null);
  }, [collabAPI, excalidrawAPI, historyData?.currentEntryId]);

  useEffect(() => {
    return () => {
      const origin = previewOriginRef.current;

      if (!origin || excalidrawAPI.isDestroyed) {
        LocalData.resumeSave(SCENE_HISTORY_PREVIEW_LOCK);
        collabAPI?.resumeSync(SCENE_HISTORY_PREVIEW_LOCK);
        return;
      }

      addFilesToScene(excalidrawAPI, origin.files);
      excalidrawAPI.updateScene({
        elements: origin.elements,
        appState: origin.appState,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      LocalData.resumeSave(SCENE_HISTORY_PREVIEW_LOCK);
      collabAPI?.resumeSync(SCENE_HISTORY_PREVIEW_LOCK);
      previewOriginRef.current = null;
    };
  }, [collabAPI, excalidrawAPI]);

  const previewEntry = async (entry: SceneHistoryEntry) => {
    if (isRestoring) {
      return;
    }

    if (entry.id === historyData?.currentEntryId) {
      cancelPreview();
      return;
    }

    const requestId = ++previewRequestIdRef.current;

    try {
      if (!previewOriginRef.current) {
        previewOriginRef.current = getCurrentScene(excalidrawAPI);
        LocalData.pauseSave(SCENE_HISTORY_PREVIEW_LOCK);
        if (isSharedHistory && isCollaborating) {
          collabAPI?.pauseSync(SCENE_HISTORY_PREVIEW_LOCK);
        }
      }

      const target = await reconstructEntry(entry.id);

      if (!isMountedRef.current || previewRequestIdRef.current !== requestId) {
        return;
      }

      if (!target) {
        cancelPreview();
        setErrorMessage("Version could not be restored");
        return;
      }

      await addTargetFilesToScene(target);
      excalidrawAPI.updateScene({
        elements: target.elements,
        appState: {
          ...excalidrawAPI.getAppState(),
          ...target.appState,
          viewModeEnabled: true,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      setSelectedEntryId(entry.id);
      setPreviewEntryId(entry.id);
      setErrorMessage(null);
    } catch (error) {
      if (!isMountedRef.current || previewRequestIdRef.current !== requestId) {
        return;
      }

      console.error(error);
      cancelPreview();
      setErrorMessage("Version could not be previewed");
    }
  };

  const restoreSelectedEntry = async () => {
    if (!selectedEntry || selectedEntry.id === historyData?.currentEntryId) {
      return;
    }

    setIsRestoring(true);
    previewRequestIdRef.current++;

    try {
      const target = await reconstructEntry(selectedEntry.id);
      const origin = previewOriginRef.current;

      if (!target) {
        setErrorMessage("Version could not be restored");
        return;
      }

      if (origin) {
        addFilesToScene(excalidrawAPI, origin.files);
        excalidrawAPI.updateScene({
          elements: origin.elements,
          appState: origin.appState,
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      }

      LocalData.resumeSave(SCENE_HISTORY_PREVIEW_LOCK);
      collabAPI?.resumeSync(SCENE_HISTORY_PREVIEW_LOCK);
      previewOriginRef.current = null;
      markNextChangeAsRestore(selectedEntry.id);
      await addTargetFilesToScene(target);
      const restoredElements =
        isSharedHistory && isCollaborating
          ? createCollabRestoreElements(
              target.elements,
              excalidrawAPI.getSceneElementsIncludingDeleted() as readonly OrderedExcalidrawElement[],
            )
          : target.elements;
      excalidrawAPI.updateScene({
        elements: restoredElements,
        appState: {
          ...excalidrawAPI.getAppState(),
          ...target.appState,
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
      if (isSharedHistory && isCollaborating) {
        collabAPI?.syncElements(restoredElements);
      }
      excalidrawAPI.setToast({ message: "Version restored" });
      setPreviewEntryId(null);
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage("Version could not be restored");
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="history-sidebar">
      <div className="history-sidebar__header">
        <h2>History</h2>
        {historyData && (
          <div className="history-sidebar__count">
            {historyData.entries.length} versions
          </div>
        )}
      </div>

      {isCollaborating && isSharedHistory && (
        <div className="history-sidebar__notice">
          Shared history is synced for this room.
        </div>
      )}

      {visibleErrorMessage && (
        <div className="history-sidebar__notice history-sidebar__notice--error">
          {visibleErrorMessage}
        </div>
      )}

      <div className="history-sidebar__timeline" role="list">
        {isLoading ? (
          <div className="history-sidebar__empty">Loading history...</div>
        ) : entries.length ? (
          entries.map((entry) => {
            const isSelected = entry.id === selectedEntryId;
            const isCurrent = entry.id === historyData?.currentEntryId;

            return (
              <button
                className={clsx("history-sidebar__entry", {
                  "history-sidebar__entry--selected": isSelected,
                  "history-sidebar__entry--current": isCurrent,
                })}
                disabled={isRestoring}
                key={entry.id}
                onClick={() => previewEntry(entry)}
                role="listitem"
                type="button"
              >
                <span className="history-sidebar__marker" />
                <span className="history-sidebar__thumbnail">
                  {entry.thumbnail ? (
                    <img alt="" src={entry.thumbnail} />
                  ) : (
                    <span>
                      {entry.kind === "initial" ? "Start" : entry.sequence}
                    </span>
                  )}
                </span>
                <span className="history-sidebar__entry-body">
                  <span className="history-sidebar__entry-title">
                    {getEntryTitle(entry)}
                    {isCurrent && (
                      <span className="history-sidebar__current-label">
                        Current
                      </span>
                    )}
                  </span>
                  <span className="history-sidebar__entry-summary">
                    {entry.summary}
                  </span>
                  <span className="history-sidebar__entry-meta">
                    <time dateTime={new Date(entry.createdAt).toISOString()}>
                      {formatEntryTime(entry.createdAt)}
                    </time>
                    <span>
                      {entry.sessionId === sessionId
                        ? "This session"
                        : "Previous session"}
                    </span>
                  </span>
                </span>
              </button>
            );
          })
        ) : (
          <div className="history-sidebar__empty">No history yet</div>
        )}
      </div>

      {isPreviewing && (
        <div className="history-sidebar__actions">
          <Button
            className="history-sidebar__cancel-button"
            onSelect={cancelPreview}
            disabled={isRestoring}
          >
            Cancel
          </Button>
          <Button
            className="history-sidebar__restore-button"
            onSelect={restoreSelectedEntry}
            disabled={isRestoring}
          >
            Restore
          </Button>
        </div>
      )}
    </div>
  );
};
