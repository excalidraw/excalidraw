import React, { useState, useEffect, useCallback, useRef } from "react";

import { getNonDeletedElements } from "@excalidraw/element";
import {
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { STORAGE_KEYS, SESSION_AUTO_SAVE_TIMEOUT } from "../app_constants";
import {
  fetchSessions,
  fetchSession,
  createSession,
  updateSession,
  deleteSession,
  renameSession,
} from "../data/sessions";

import "./SessionsSidebar.scss";

import type { SessionListItem } from "../data/sessions";

const formatTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) {
    return "just now";
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  return date.toLocaleDateString();
};

export const SessionsSidebar: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = ({ excalidrawAPI }) => {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setActiveSession = useCallback((id: string | null) => {
    setActiveSessionId(id);
    if (id) {
      localStorage.setItem(STORAGE_KEYS.LOCAL_STORAGE_ACTIVE_SESSION_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.LOCAL_STORAGE_ACTIVE_SESSION_ID);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const list = await fetchSessions();
      setSessions(list);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    const savedId = localStorage.getItem(
      STORAGE_KEYS.LOCAL_STORAGE_ACTIVE_SESSION_ID,
    );
    if (savedId) {
      setActiveSessionId(savedId);
    }
  }, [loadSessions]);

  // Auto-save active session periodically
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }

    if (!excalidrawAPI || !activeSessionId) {
      return;
    }

    autoSaveTimerRef.current = setInterval(async () => {
      if (!excalidrawAPI || !activeSessionId) {
        return;
      }
      try {
        const elements = getNonDeletedElements(
          excalidrawAPI.getSceneElements(),
        );
        const appState = excalidrawAPI.getAppState();
        await updateSession(activeSessionId, {
          elements,
          app_state: appState,
        });
      } catch (err) {
        // Silently ignore auto-save errors
      }
    }, SESSION_AUTO_SAVE_TIMEOUT);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [excalidrawAPI, activeSessionId]);

  const saveCurrentSession = useCallback(async () => {
    if (!excalidrawAPI) {
      return;
    }
    const elements = getNonDeletedElements(excalidrawAPI.getSceneElements());
    const appState = excalidrawAPI.getAppState();

    if (activeSessionId) {
      await updateSession(activeSessionId, { elements, app_state: appState });
    } else {
      const session = await createSession("Untitled", elements, appState);
      setActiveSession(session.id);
    }
    await loadSessions();
  }, [excalidrawAPI, activeSessionId, setActiveSession, loadSessions]);

  const handleNewSession = useCallback(async () => {
    if (!excalidrawAPI) {
      return;
    }

    // Save current session before creating new
    if (activeSessionId) {
      try {
        const elements = getNonDeletedElements(
          excalidrawAPI.getSceneElements(),
        );
        const appState = excalidrawAPI.getAppState();
        await updateSession(activeSessionId, {
          elements,
          app_state: appState,
        });
      } catch (err) {
        console.error("Failed to auto-save before new session:", err);
      }
    }

    excalidrawAPI.resetScene();

    try {
      const session = await createSession("Untitled", [], {});
      setActiveSession(session.id);
      await loadSessions();
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  }, [excalidrawAPI, activeSessionId, setActiveSession, loadSessions]);

  const handleLoadSession = useCallback(
    async (id: string) => {
      if (!excalidrawAPI || id === activeSessionId) {
        return;
      }

      // Save current session before switching
      if (activeSessionId) {
        try {
          const elements = getNonDeletedElements(
            excalidrawAPI.getSceneElements(),
          );
          const appState = excalidrawAPI.getAppState();
          await updateSession(activeSessionId, {
            elements,
            app_state: appState,
          });
        } catch (err) {
          console.error("Failed to auto-save before switch:", err);
        }
      }

      try {
        const session = await fetchSession(id);
        if (!session) {
          return;
        }

        const restoredElements = restoreElements(session.elements || [], null);
        const restoredAppState = session.app_state
          ? restoreAppState(session.app_state, null)
          : {};

        excalidrawAPI.updateScene({
          elements: restoredElements,
          appState: restoredAppState,
        });

        setActiveSession(id);
      } catch (err) {
        console.error("Failed to load session:", err);
      }
    },
    [excalidrawAPI, activeSessionId, setActiveSession],
  );

  const handleDeleteSession = useCallback(
    async (id: string, name: string) => {
      if (!window.confirm(`Delete session "${name}"?`)) {
        return;
      }
      try {
        await deleteSession(id);
        if (id === activeSessionId) {
          excalidrawAPI?.resetScene();
          setActiveSession(null);
        }
        await loadSessions();
      } catch (err) {
        console.error("Failed to delete session:", err);
      }
    },
    [excalidrawAPI, activeSessionId, setActiveSession, loadSessions],
  );

  const handleRename = useCallback(
    async (id: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed) {
        setEditingId(null);
        return;
      }
      try {
        await renameSession(id, trimmed);
        await loadSessions();
      } catch (err) {
        console.error("Failed to rename session:", err);
      }
      setEditingId(null);
    },
    [loadSessions],
  );

  if (loading) {
    return (
      <div className="sessions-sidebar sessions-sidebar--loading">
        Loading...
      </div>
    );
  }

  return (
    <div className="sessions-sidebar">
      <div className="sessions-sidebar__actions">
        <button className="sessions-sidebar__btn" onClick={handleNewSession}>
          + New
        </button>
        <button className="sessions-sidebar__btn" onClick={saveCurrentSession}>
          Save
        </button>
      </div>

      <div className="sessions-sidebar__list">
        {sessions.length === 0 && (
          <div className="sessions-sidebar__empty">
            No sessions yet. Click &quot;+ New&quot; to create one.
          </div>
        )}
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`session-item ${
              session.id === activeSessionId ? "session-item--active" : ""
            }`}
            onClick={() => handleLoadSession(session.id)}
          >
            <div className="session-item__content">
              {editingId === session.id ? (
                <input
                  className="session-item__rename-input"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => handleRename(session.id, editingName)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleRename(session.id, editingName);
                    } else if (e.key === "Escape") {
                      setEditingId(null);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <span
                  className="session-item__name"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingId(session.id);
                    setEditingName(session.name);
                  }}
                >
                  {session.name}
                </span>
              )}
              <span className="session-item__time">
                {formatTime(session.updated_at)}
              </span>
            </div>
            <button
              className="session-item__delete"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteSession(session.id, session.name);
              }}
              title="Delete session"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
