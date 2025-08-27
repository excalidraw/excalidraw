import React, { useState, useEffect } from "react";
import { listExportedScenes, loadSceneById } from "../data/supabase";
import { Card } from "@excalidraw/excalidraw/components/Card";
import { ToolButton } from "@excalidraw/excalidraw/components/ToolButton";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { getFrame } from "@excalidraw/common";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { t } from "@excalidraw/excalidraw/i18n";
import { atom, useAtom } from "../app-jotai";
import { LoadIcon, LinkIcon } from "@excalidraw/excalidraw/components/icons";
import "./SceneBrowser.scss";

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

export const SceneBrowserDialog: React.FC<{
  onSceneLoad: (sceneData: any) => void;
  onError?: (error: Error) => void;
}> = ({ onSceneLoad, onError }) => {
  const [dialogState, setDialogState] = useAtom(sceneBrowserDialogStateAtom);
  const [scenes, setScenes] = useState<ExportedScene[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingScene, setLoadingScene] = useState<string | null>(null);

  useEffect(() => {
    loadScenes();
  }, []);

  const loadScenes = async () => {
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
  };

  const handleLoadScene = async (sceneId: string) => {
    try {
      setLoadingScene(sceneId);
      trackEvent("scene", "load", `browser`);

      const sceneData = await loadSceneById(sceneId);
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
            <div key={scene.id} className="SceneBrowser__item">
              <div className="SceneBrowser__meta">
                <h4 className="SceneBrowser__name">{scene.name}</h4>
                <div className="SceneBrowser__sub">Created: {formatDate(scene.createdAt)}</div>
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
                  onClick={() => handleLoadScene(scene.id)}
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
