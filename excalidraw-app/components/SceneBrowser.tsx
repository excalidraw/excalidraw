import React, { useState, useEffect, useCallback } from "react";
import { listExportedScenes, loadSceneById, deleteSceneByName } from "../data/supabase";
import { Card } from "@excalidraw/excalidraw/components/Card";
import { ToolButton } from "@excalidraw/excalidraw/components/ToolButton";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { getFrame } from "@excalidraw/common";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { t } from "@excalidraw/excalidraw/i18n";
import { atom, useAtom } from "../app-jotai";
import { LoadIcon, LinkIcon, TrashIcon } from "@excalidraw/excalidraw/components/icons";
import "./SceneBrowser.scss";

// Global event emitter for scene updates
const sceneUpdateEmitter = {
  listeners: new Set<() => void>(),
  emit() {
    this.listeners.forEach(listener => listener());
  },
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
};

// Export the emitter so other components can trigger updates
export const triggerSceneBrowserRefresh = () => {
  sceneUpdateEmitter.emit();
};

interface ExportedScene {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  encryptionKey: string;
  url: string;
}

// State atom for scene browser dialog
export const sceneBrowserDialogStateAtom = atom<{ isOpen: boolean }>({ isOpen: false });

// State atom for current scene in scene browser (the scene that was just exported)
export const currentSceneInBrowserAtom = atom<{ sceneName: string; sceneId: string } | null>(null);

export const SceneBrowserDialog: React.FC<{
  onSceneLoad: (sceneData: any) => void;
  onError?: (error: Error) => void;
  onRefresh?: () => void;
}> = ({ onSceneLoad, onError, onRefresh }) => {
  const [dialogState, setDialogState] = useAtom(sceneBrowserDialogStateAtom);
  const [currentScene, setCurrentScene] = useAtom(currentSceneInBrowserAtom);
  const [scenes, setScenes] = useState<ExportedScene[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingScene, setLoadingScene] = useState<string | null>(null);
  const [deletingScene, setDeletingScene] = useState<string | null>(null);

  const loadScenes = useCallback(async () => {
    try {
      setLoading(true);
      const exportedScenes = await listExportedScenes();
      setScenes(exportedScenes);
    } catch (error: any) {
      console.error("Error loading scenes:", error);
      onError?.(new Error("Failed to load scenes"));
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    if (dialogState.isOpen) {
      loadScenes();
      
      // Subscribe to scene update events
      const unsubscribe = sceneUpdateEmitter.subscribe(() => {
        loadScenes();
      });
      
      return () => {
        unsubscribe();
      };
    }
  }, [dialogState.isOpen, loadScenes]);

  const handleLoadScene = async (sceneId: string, sceneName: string) => {
    try {
      setLoadingScene(sceneId);
      trackEvent("scene", "load", `browser`);

      const sceneData = await loadSceneById(sceneId);
      onSceneLoad(sceneData);

      // Update the current scene to reflect the newly loaded scene
      setCurrentScene({ sceneName, sceneId });

      setDialogState({ isOpen: false });
    } catch (error: any) {
      console.error("Error loading scene:", error);
      // You might want to show an error toast here
    } finally {
      setLoadingScene(null);
    }
  };

  const handleClose = () => {
    setDialogState({ isOpen: false });
    // Clear the current scene when closing the browser
    setCurrentScene(null);
  };

  const handleRefresh = () => {
    loadScenes();
    onRefresh?.();
  };

  const handleDeleteScene = async (sceneName: string) => {
    if (!confirm(`Are you sure you want to delete the scene "${sceneName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingScene(sceneName);
      await deleteSceneByName(sceneName);
      
      // Remove the entire scene from the local state
      setScenes(prevScenes => 
        prevScenes.filter(scene => scene.name !== sceneName)
      );
      
      trackEvent("scene", "delete", `browser`);
    } catch (error: any) {
      console.error("Error deleting scene:", error);
      onError?.(new Error("Failed to delete scene"));
    } finally {
      setDeletingScene(null);
    }
  };



  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (!dialogState.isOpen) {
    return null;
  }

  const renderContent = () => {
    if (loading) {
      return (
        <Card color="primary">
          <div className="Card-icon">⟳</div>
          <h2>Loading Scenes...</h2>
          <div className="Card-details">Please wait while we load your exported scenes.</div>
        </Card>
      );
    }

    if (scenes.length === 0) {
      return (
        <Card color="primary">
          <div className="Card-icon">📄</div>
          <h2>No Scenes Found</h2>
          <div className="Card-details">
            You haven't exported any scenes yet. Go to File → Export → Export to Excalidraw to create your first exported scene.
          </div>
        </Card>
      );
    }

    return (
      <div className="SceneBrowser">
        <h3 className="SceneBrowser__heading">Your Exported Scenes</h3>
        <div className="SceneBrowser__content">
          {scenes.map((scene) => {
            const isCurrentScene = currentScene?.sceneName === scene.name;
            return (
              <div
                key={scene.id}
                className={`SceneBrowser__item ${isCurrentScene ? 'SceneBrowser__item--current' : ''}`}
              >
                <div className="SceneBrowser__meta">
                  <h4 className="SceneBrowser__name">
                    {scene.name}
                    {isCurrentScene && <span className="SceneBrowser__current-indicator"> (Current)</span>}
                  </h4>
                  <div className="SceneBrowser__sub">
                    Created: {formatDate(scene.createdAt)}
                  </div>
                  {scene.description && (
                    <div className="SceneBrowser__sub">{scene.description}</div>
                  )}
                </div>
                <div className="SceneBrowser__actions">
                  <ToolButton
                    type="button"
                    size="small"
                    title="Load Scene"
                    aria-label="Load scene"
                    icon={LoadIcon}
                    onClick={() => handleLoadScene(scene.id, scene.name)}
                    disabled={loadingScene === scene.id}
                  >
                    {loadingScene === scene.id ? "Loading..." : "Load"}
                  </ToolButton>
                  <ToolButton
                    type="button"
                    size="small"
                    title="Copy URL"
                    aria-label="Copy scene URL"
                    icon={LinkIcon}
                    onClick={() => {
                      navigator.clipboard.writeText(scene.url);
                    }}
                  >
                    Copy URL
                  </ToolButton>
                  <ToolButton
                    type="button"
                    size="small"
                    title="Delete Scene"
                    aria-label="Delete scene"
                    icon={TrashIcon}
                    onClick={() => handleDeleteScene(scene.name)}
                    disabled={deletingScene === scene.name}
                  >
                    {deletingScene === scene.name ? "Deleting..." : "Delete"}
                  </ToolButton>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Dialog
      onCloseRequest={handleClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span>Scene Browser</span>
          <ToolButton
            type="button"
            size="small"
            title="Refresh Scenes"
            aria-label="Refresh scenes"
            icon="⟳"
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </ToolButton>
        </div>
      }
      size="wide"
    >
      {renderContent()}
    </Dialog>
  );
};
