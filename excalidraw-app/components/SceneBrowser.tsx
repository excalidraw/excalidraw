import React, { useState, useEffect, useCallback } from "react";
import { listExportedScenes, loadSceneById, deleteSceneById } from "../data/supabase";
import { Card } from "@excalidraw/excalidraw/components/Card";
import { ToolButton } from "@excalidraw/excalidraw/components/ToolButton";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { getFrame } from "@excalidraw/common";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { t } from "@excalidraw/excalidraw/i18n";
import { atom, useAtom } from "../app-jotai";
import { LoadIcon, LinkIcon, TrashIcon } from "@excalidraw/excalidraw/components/icons";
import "./SceneBrowser.scss";

interface ExportedSceneVersion {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  encryptionKey: string;
  url: string;
  version: number;
  isLatest: boolean;
}

interface GroupedScene {
  name: string;
  description: string;
  versions: ExportedSceneVersion[];
  latestVersion: ExportedSceneVersion;
}

// State atom for scene browser dialog
export const sceneBrowserDialogStateAtom = atom<{ isOpen: boolean }>({ isOpen: false });

export const SceneBrowserDialog: React.FC<{
  onSceneLoad: (sceneData: any) => void;
  onError?: (error: Error) => void;
}> = ({ onSceneLoad, onError }) => {
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

  const handleDeleteScene = async (sceneId: string) => {
    if (!confirm("Are you sure you want to delete this scene? This action cannot be undone.")) {
      return;
    }

    try {
      setDeletingScene(sceneId);
      await deleteSceneById(sceneId);
      
      // Remove the scene from the local state
      setScenes(prevScenes => 
        prevScenes.map(scene => ({
          ...scene,
          versions: scene.versions.filter(version => version.id !== sceneId),
        })).filter(scene => scene.versions.length > 0)
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
                  {scene.versions.length > 1 ? (
                    <div className="SceneBrowser__version-selector">
                      <label htmlFor={`version-${scene.name}`}>Version:</label>
                      <select
                        id={`version-${scene.name}`}
                        className="dropdown-select"
                        value={selectedVersions[scene.name] || scene.latestVersion.id}
                        onChange={(e) => handleVersionChange(scene.name, e.target.value)}
                      >
                        {scene.versions.map((version) => (
                          <option key={version.id} value={version.id}>
                            v{version.version} {version.isLatest ? "(Latest)" : ""} - {formatDate(version.createdAt)}
                          </option>
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
                {scene.versions.length > 1 && (
                  <ToolButton
                    type="button"
                    size="small"
                    title="Delete Version"
                    aria-label="Delete scene version"
                    icon={TrashIcon}
                    onClick={() => handleDeleteScene(selectedVersions[scene.name])}
                    disabled={deletingScene === selectedVersions[scene.name]}
                  >
                    {deletingScene === selectedVersions[scene.name] ? "Deleting..." : "Delete Version"}
                  </ToolButton>
                )}
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
      title="Scene Browser"
      size="wide"
    >
      {renderContent()}
    </Dialog>
  );
};
