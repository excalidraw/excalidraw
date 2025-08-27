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

interface ExportedSceneVersion {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  encryptionKey: string;
  url: string;
  version: number;
  isLatest: boolean;
  isAutomatic: boolean;
}

interface GroupedScene {
  name: string;
  description: string;
  versions: ExportedSceneVersion[];
  branches: {
    version: number;
    versions: ExportedSceneVersion[];
    latestVersion: ExportedSceneVersion;
    isManualBranch: boolean;
  }[];
  latestVersion: ExportedSceneVersion;
}

// State atom for scene browser dialog
export const sceneBrowserDialogStateAtom = atom<{ isOpen: boolean }>({ isOpen: false });

export const SceneBrowserDialog: React.FC<{
  onSceneLoad: (sceneData: any) => void;
  onError?: (error: Error) => void;
  onRefresh?: () => void;
}> = ({ onSceneLoad, onError, onRefresh }) => {
  const [dialogState, setDialogState] = useAtom(sceneBrowserDialogStateAtom);
  const [scenes, setScenes] = useState<GroupedScene[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingScene, setLoadingScene] = useState<string | null>(null);
  const [deletingScene, setDeletingScene] = useState<string | null>(null);
  const [selectedVersions, setSelectedVersions] = useState<Record<string, string>>({});

  const loadScenes = useCallback(async () => {
    try {
      setLoading(true);
      const exportedScenes = await listExportedScenes();
      setScenes(exportedScenes);
      
      // Initialize selected versions to latest versions
      const initialVersions: Record<string, string> = {};
      exportedScenes.forEach(scene => {
        initialVersions[scene.name] = scene.latestVersion.id;
      });
      setSelectedVersions(initialVersions);
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

  const handleLoadScene = async (sceneName: string) => {
    const selectedSceneId = selectedVersions[sceneName];
    if (!selectedSceneId) return;

    try {
      setLoadingScene(selectedSceneId);
      trackEvent("scene", "load", `browser`);

      const sceneData = await loadSceneById(selectedSceneId);
      onSceneLoad(sceneData);
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
  };

  const handleRefresh = () => {
    loadScenes();
    onRefresh?.();
  };

  const handleDeleteScene = async (sceneName: string) => {
    if (!confirm(`Are you sure you want to delete the entire scene "${sceneName}" and all its versions? This action cannot be undone.`)) {
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

  const handleVersionChange = (sceneName: string, sceneId: string) => {
    setSelectedVersions(prev => ({
      ...prev,
      [sceneName]: sceneId,
    }));
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
          {scenes.map((scene) => (
            <div key={scene.name} className="SceneBrowser__item">
              <div className="SceneBrowser__meta">
                <h4 className="SceneBrowser__name">{scene.name}</h4>
                <div className="SceneBrowser__sub">
                  {scene.branches.length > 1 ? (
                    <div className="SceneBrowser__version-selector">
                      <label htmlFor={`version-${scene.name}`}>Branch:</label>
                      <select
                        id={`version-${scene.name}`}
                        className="dropdown-select"
                        value={selectedVersions[scene.name] || scene.latestVersion.id}
                        onChange={(e) => handleVersionChange(scene.name, e.target.value)}
                      >
                        {scene.branches.map((branch) => (
                          <optgroup key={branch.version} label={branch.isManualBranch ? `Manual v${branch.version}` : `Automatic v${branch.version}`}>
                            {branch.versions.map((version) => (
                              <option key={version.id} value={version.id}>
                                {version.isLatest ? "Latest" : formatDate(version.createdAt)}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="SceneBrowser__sub">Created: {formatDate(scene.latestVersion.createdAt)}</div>
                  )}
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
                  onClick={() => handleLoadScene(scene.name)}
                  disabled={loadingScene === selectedVersions[scene.name]}
                >
                  {loadingScene === selectedVersions[scene.name] ? "Loading..." : "Load"}
                </ToolButton>
                <ToolButton
                  type="button"
                  size="small"
                  title="Copy URL"
                  aria-label="Copy scene URL"
                  icon={LinkIcon}
                  onClick={() => {
                    const selectedVersion = scene.versions.find(v => v.id === selectedVersions[scene.name]);
                    if (selectedVersion) {
                      navigator.clipboard.writeText(selectedVersion.url);
                    }
                  }}
                >
                  Copy URL
                </ToolButton>
                <ToolButton
                  type="button"
                  size="small"
                  title="Delete Scene"
                  aria-label="Delete entire scene and all versions"
                  icon={TrashIcon}
                  onClick={() => handleDeleteScene(scene.name)}
                  disabled={deletingScene === scene.name}
                >
                  {deletingScene === scene.name ? "Deleting..." : "Delete Scene"}
                </ToolButton>
              </div>
            </div>
          ))}
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
