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

import type { OrderedExcalidrawElement } from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import { LocalData } from "../data/LocalData";
import { SceneHistory } from "../data/SceneHistory";

import "./HistorySidebar.scss";

import type { SceneHistoryData, SceneHistoryEntry } from "../data/SceneHistory";

type HistorySidebarProps = {
  excalidrawAPI: ExcalidrawImperativeAPI;
  isCollaborating: boolean;
};

type SceneHistoryProviderProps = {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  children: React.ReactNode;
};

type SceneHistoryContextValue = {
  historyData: SceneHistoryData | null;
  isLoading: boolean;
  errorMessage: string | null;
  sessionId: string;
  markNextChangeAsRestore: (sourceEntryId: string) => void;
};

type PreviewOrigin = {
  elements: readonly OrderedExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
};

const THUMBNAIL_MAX_WIDTH = 160;
const THUMBNAIL_MAX_HEIGHT = 96;

const SceneHistoryContext = createContext<SceneHistoryContextValue | null>(
  null,
);

const createSessionId = () => {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
};

const createHistoryThumbnail = async (
  elements: readonly OrderedExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
) => {
  const nonDeletedElements = getNonDeletedElements(elements);

  if (!nonDeletedElements.length) {
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
  excalidrawAPI,
  children,
}: SceneHistoryProviderProps) => {
  const sessionIdRef = useRef(createSessionId());
  const recordQueueRef = useRef(Promise.resolve());
  const pendingRestoreRef = useRef<{ sourceEntryId: string } | null>(null);
  const [historyData, setHistoryData] = useState<SceneHistoryData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const setHistoryState = useCallback((nextHistoryData: SceneHistoryData) => {
    setHistoryData(nextHistoryData);
  }, []);

  const markNextChangeAsRestore = useCallback((sourceEntryId: string) => {
    pendingRestoreRef.current = { sourceEntryId };
    window.setTimeout(() => {
      if (pendingRestoreRef.current?.sourceEntryId === sourceEntryId) {
        pendingRestoreRef.current = null;
      }
    }, 500);
  }, []);

  useEffect(() => {
    if (!excalidrawAPI) {
      setHistoryData(null);
      setIsLoading(false);
      return;
    }

    let isActive = true;

    const initializeHistory = async () => {
      setIsLoading(true);

      try {
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

        if (isActive) {
          setHistoryState(nextHistoryData);
          setErrorMessage(null);
        }
      } catch (error) {
        console.error(error);

        if (isActive) {
          setErrorMessage("History is unavailable");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    initializeHistory();

    return () => {
      isActive = false;
    };
  }, [excalidrawAPI, setHistoryState]);

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }

    return excalidrawAPI.onIncrement((increment) => {
      if (increment.type !== "durable" || !("delta" in increment)) {
        return;
      }

      const restoreMetadata = pendingRestoreRef.current;
      pendingRestoreRef.current = null;
      recordQueueRef.current = recordQueueRef.current
        .then(async () => {
          const scene = getCurrentScene(excalidrawAPI);
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

          setHistoryState(nextHistoryData);
          setErrorMessage(null);
        })
        .catch((error) => {
          console.error(error);
          setErrorMessage("History was not saved");
        });
    });
  }, [excalidrawAPI, setHistoryState]);

  const value = useMemo(
    () => ({
      historyData,
      isLoading,
      errorMessage,
      sessionId: sessionIdRef.current,
      markNextChangeAsRestore,
    }),
    [errorMessage, historyData, isLoading, markNextChangeAsRestore],
  );

  return (
    <SceneHistoryContext.Provider value={value}>
      {children}
    </SceneHistoryContext.Provider>
  );
};

export const HistorySidebar = ({
  excalidrawAPI,
  isCollaborating,
}: HistorySidebarProps) => {
  const {
    historyData,
    isLoading,
    errorMessage: historyErrorMessage,
    sessionId,
    markNextChangeAsRestore,
  } = useSceneHistoryContext();
  const previewOriginRef = useRef<PreviewOrigin | null>(null);
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

  useEffect(() => {
    if (!isPreviewing) {
      setSelectedEntryId(historyData?.currentEntryId ?? null);
    }
  }, [historyData?.currentEntryId, isPreviewing]);

  const cancelPreview = useCallback(() => {
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
    LocalData.resumeSave("scene-history-preview");
    previewOriginRef.current = null;
    setPreviewEntryId(null);
    setSelectedEntryId(historyData?.currentEntryId ?? null);
  }, [excalidrawAPI, historyData?.currentEntryId]);

  useEffect(() => {
    if (isCollaborating && previewOriginRef.current) {
      cancelPreview();
    }
  }, [cancelPreview, isCollaborating]);

  useEffect(() => {
    return () => {
      const origin = previewOriginRef.current;

      if (!origin || excalidrawAPI.isDestroyed) {
        LocalData.resumeSave("scene-history-preview");
        return;
      }

      addFilesToScene(excalidrawAPI, origin.files);
      excalidrawAPI.updateScene({
        elements: origin.elements,
        appState: origin.appState,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      LocalData.resumeSave("scene-history-preview");
      previewOriginRef.current = null;
    };
  }, [excalidrawAPI]);

  const previewEntry = async (entry: SceneHistoryEntry) => {
    if (isCollaborating || isRestoring) {
      return;
    }

    if (entry.id === historyData?.currentEntryId) {
      cancelPreview();
      return;
    }

    try {
      if (!previewOriginRef.current) {
        previewOriginRef.current = getCurrentScene(excalidrawAPI);
        LocalData.pauseSave("scene-history-preview");
      }

      const target = await SceneHistory.reconstruct(entry.id);

      if (!target) {
        setErrorMessage("Version could not be restored");
        return;
      }

      addFilesToScene(excalidrawAPI, target.files);
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
      console.error(error);
      setErrorMessage("Version could not be previewed");
    }
  };

  const restoreSelectedEntry = async () => {
    if (!selectedEntry || selectedEntry.id === historyData?.currentEntryId) {
      return;
    }

    setIsRestoring(true);

    try {
      const target = await SceneHistory.reconstruct(selectedEntry.id);
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

      LocalData.resumeSave("scene-history-preview");
      previewOriginRef.current = null;
      markNextChangeAsRestore(selectedEntry.id);
      addFilesToScene(excalidrawAPI, target.files);
      excalidrawAPI.updateScene({
        elements: target.elements,
        appState: {
          ...excalidrawAPI.getAppState(),
          ...target.appState,
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      });
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

      {isCollaborating && (
        <div className="history-sidebar__notice">
          Restore is paused during live collaboration.
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
                disabled={isCollaborating || isRestoring}
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
            disabled={isCollaborating || isRestoring}
          >
            Restore
          </Button>
        </div>
      )}
    </div>
  );
};
