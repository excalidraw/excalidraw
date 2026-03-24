import React, { useState, useCallback } from "react";
import { useAtom } from "../app-jotai";

import {
  getDrawings,
  createDrawing,
  deleteDrawing,
  updateDrawingMeta,
  loadScene,
  saveScene,
} from "../data/firebase";
import {
  clientsAtom,
  currentClientIdAtom,
  currentDrawingIdAtom,
  drawingsAtom,
  isSavingAtom,
  isLoadingAtom,
} from "../store/drawingState";
import { useExcalidrawAPI } from "@excalidraw/excalidraw";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import {
  restoreElements,
  restoreAppState,
} from "@excalidraw/excalidraw/data/restore";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";

export const DrawingList: React.FC = () => {
  const excalidrawAPI = useExcalidrawAPI();
  const [clients] = useAtom(clientsAtom);
  const [currentClientId, setCurrentClientId] = useAtom(currentClientIdAtom);
  const [currentDrawingId, setCurrentDrawingId] = useAtom(currentDrawingIdAtom);
  const [drawings, setDrawings] = useAtom(drawingsAtom);
  const [isSaving] = useAtom(isSavingAtom);
  const [isLoading, setIsLoading] = useAtom(isLoadingAtom);
  const [newDrawingName, setNewDrawingName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const currentClient = clients.find((c) => c.id === currentClientId);

  const refreshDrawings = useCallback(async () => {
    if (!currentClientId) {
      return;
    }
    try {
      const loaded = await getDrawings(currentClientId);
      setDrawings(loaded);
    } catch (error) {
      console.error("Error loading drawings:", error);
    }
  }, [currentClientId, setDrawings]);

  const saveCurrentDrawing = useCallback(
    async (api: ExcalidrawImperativeAPI) => {
      if (!currentClientId || !currentDrawingId) {
        return;
      }
      try {
        await saveScene(
          currentClientId,
          currentDrawingId,
          api.getSceneElements(),
          api.getAppState(),
          api.getFiles(),
        );
      } catch (error) {
        console.error("Error saving current drawing:", error);
      }
    },
    [currentClientId, currentDrawingId],
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDrawingName.trim() || !currentClientId) {
      return;
    }
    setIsCreating(true);
    try {
      // Save current drawing first
      if (excalidrawAPI && currentDrawingId) {
        await saveCurrentDrawing(excalidrawAPI);
      }

      const drawing = await createDrawing(
        currentClientId,
        newDrawingName.trim(),
      );
      setNewDrawingName("");
      setCurrentDrawingId(drawing.id);

      // Reset the canvas for the new drawing
      if (excalidrawAPI) {
        excalidrawAPI.resetScene();
        excalidrawAPI.updateScene({
          appState: { name: drawing.name },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      }

      await refreshDrawings();
    } catch (error) {
      console.error("Error creating drawing:", error);
    }
    setIsCreating(false);
  };

  const handleDelete = async (drawingId: string, name: string) => {
    if (!currentClientId) {
      return;
    }
    if (!window.confirm(`Delete drawing "${name}"?`)) {
      return;
    }
    try {
      await deleteDrawing(currentClientId, drawingId);
      if (currentDrawingId === drawingId) {
        setCurrentDrawingId(null);
        if (excalidrawAPI) {
          excalidrawAPI.resetScene();
        }
      }
      await refreshDrawings();
    } catch (error) {
      console.error("Error deleting drawing:", error);
    }
  };

  const handleRename = async (drawingId: string) => {
    if (!editName.trim() || !currentClientId) {
      setEditingId(null);
      return;
    }
    try {
      await updateDrawingMeta(currentClientId, drawingId, editName.trim());
      setEditingId(null);
      await refreshDrawings();
    } catch (error) {
      console.error("Error renaming drawing:", error);
    }
  };

  const handleSelectDrawing = async (drawingId: string) => {
    if (!currentClientId || !excalidrawAPI || drawingId === currentDrawingId) {
      return;
    }

    setIsLoading(true);
    try {
      // Save current drawing first
      if (currentDrawingId) {
        await saveCurrentDrawing(excalidrawAPI);
      }

      // Load the selected drawing
      const scene = await loadScene(currentClientId, drawingId);
      setCurrentDrawingId(drawingId);

      if (scene) {
        const elements = restoreElements(scene.elements, null, {
          repairBindings: true,
        });
        const appState = restoreAppState(scene.appState, null);

        excalidrawAPI.updateScene({
          elements,
          appState: {
            ...appState,
            name:
              drawings.find((d) => d.id === drawingId)?.name || appState.name,
          },
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });

        if (scene.files && Object.keys(scene.files).length) {
          excalidrawAPI.addFiles(Object.values(scene.files));
        }
      } else {
        // New empty drawing
        excalidrawAPI.resetScene();
        const drawing = drawings.find((d) => d.id === drawingId);
        if (drawing) {
          excalidrawAPI.updateScene({
            appState: { name: drawing.name },
            captureUpdate: CaptureUpdateAction.NEVER,
          });
        }
      }
    } catch (error) {
      console.error("Error loading drawing:", error);
    }
    setIsLoading(false);
  };

  const handleBack = () => {
    setCurrentClientId(null);
    setCurrentDrawingId(null);
    setDrawings([]);
  };

  return (
    <div style={{ padding: "0.5rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.75rem",
        }}
      >
        <button
          onClick={handleBack}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "1rem",
            padding: "0.2rem",
            color: "var(--color-on-surface, #333)",
          }}
          title="Back to clients"
        >
          ←
        </button>
        <div
          style={{
            fontWeight: 600,
            fontSize: "0.9rem",
            color: "var(--color-on-surface, #333)",
          }}
        >
          {currentClient?.name || "Drawings"}
        </div>
        {(isSaving || isLoading) && (
          <span
            style={{
              fontSize: "0.7rem",
              color: "#6965db",
              marginLeft: "auto",
            }}
          >
            {isLoading ? "Loading..." : "Saving..."}
          </span>
        )}
      </div>

      <form
        onSubmit={handleCreate}
        style={{ display: "flex", gap: "0.25rem", marginBottom: "0.75rem" }}
      >
        <input
          type="text"
          value={newDrawingName}
          onChange={(e) => setNewDrawingName(e.target.value)}
          placeholder="New drawing name..."
          disabled={isCreating}
          style={{
            flex: 1,
            padding: "0.4rem 0.5rem",
            fontSize: "0.8rem",
            border: "1px solid var(--color-border-outline, #ddd)",
            borderRadius: "4px",
            background: "var(--color-surface-high, #fff)",
            color: "var(--color-on-surface, #333)",
          }}
        />
        <button
          type="submit"
          disabled={isCreating || !newDrawingName.trim()}
          style={{
            padding: "0.4rem 0.6rem",
            fontSize: "0.8rem",
            background: "#6965db",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            opacity: isCreating || !newDrawingName.trim() ? 0.5 : 1,
          }}
        >
          +
        </button>
      </form>

      {drawings.length === 0 && (
        <div
          style={{
            textAlign: "center",
            color: "var(--color-on-surface, #999)",
            fontSize: "0.8rem",
            padding: "1rem 0",
          }}
        >
          No drawings yet. Create one above.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {drawings.map((drawing) => (
          <div
            key={drawing.id}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "0.5rem",
              borderRadius: "6px",
              cursor: "pointer",
              background:
                drawing.id === currentDrawingId
                  ? "var(--color-primary-light, #e8e7fc)"
                  : "var(--color-surface-high, transparent)",
              fontSize: "0.85rem",
              borderLeft:
                drawing.id === currentDrawingId
                  ? "3px solid #6965db"
                  : "3px solid transparent",
            }}
            onClick={() => handleSelectDrawing(drawing.id)}
            onMouseEnter={(e) => {
              if (drawing.id !== currentDrawingId) {
                e.currentTarget.style.background =
                  "var(--color-surface-lowest, #f0f0f0)";
              }
            }}
            onMouseLeave={(e) => {
              if (drawing.id !== currentDrawingId) {
                e.currentTarget.style.background =
                  "var(--color-surface-high, transparent)";
              }
            }}
          >
            {editingId === drawing.id ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => handleRename(drawing.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRename(drawing.id);
                  }
                  if (e.key === "Escape") {
                    setEditingId(null);
                  }
                }}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                style={{
                  flex: 1,
                  padding: "0.2rem 0.4rem",
                  fontSize: "0.85rem",
                  border: "1px solid #6965db",
                  borderRadius: "4px",
                }}
              />
            ) : (
              <>
                <div style={{ flex: 1 }}>
                  <div>{drawing.name}</div>
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--color-on-surface, #999)",
                      marginTop: "2px",
                    }}
                  >
                    {drawing.updatedAt.toLocaleDateString()}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(drawing.id);
                    setEditName(drawing.name);
                  }}
                  title="Rename"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "0.15rem 0.3rem",
                    fontSize: "0.75rem",
                    opacity: 0.5,
                    color: "var(--color-on-surface, #333)",
                  }}
                >
                  ✎
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(drawing.id, drawing.name);
                  }}
                  title="Delete"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "0.15rem 0.3rem",
                    fontSize: "0.75rem",
                    opacity: 0.5,
                    color: "#e53e3e",
                  }}
                >
                  ✕
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
