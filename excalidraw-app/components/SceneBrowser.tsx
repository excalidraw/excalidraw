import React, { useState, useEffect } from "react";
import { listExportedScenes, loadSceneById } from "../data/supabase";
import { Card } from "@excalidraw/excalidraw/components/Card";
import { ToolButton } from "@excalidraw/excalidraw/components/ToolButton";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { getFrame } from "@excalidraw/common";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { t } from "@excalidraw/excalidraw/i18n";
import { atom, useAtom } from "../app-jotai";

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
}> = ({ onSceneLoad }) => {
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
      onError(new Error("Failed to load scenes"));
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
          <ToolButton
            className="Card-button"
            type="button"
            title="Refresh"
            onClick={loadScenes}
          >
            Refresh
          </ToolButton>
        </Card>
      );
    }

    return (
      <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
        <h3 style={{ marginBottom: "1rem", color: "#333" }}>Your Exported Scenes</h3>
        {scenes.map((scene) => (
          <Card key={scene.id} color="primary" style={{ marginBottom: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: "0 0 0.5rem 0", color: "#333" }}>{scene.name}</h4>
                <div style={{ fontSize: "0.875rem", color: "#666", marginBottom: "0.25rem" }}>
                  Created: {formatDate(scene.createdAt)}
                </div>
                {scene.description && (
                  <div style={{ fontSize: "0.875rem", color: "#666" }}>
                    {scene.description}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <ToolButton
                  type="button"
                  size="small"
                  title="Load Scene"
                  onClick={() => handleLoadScene(scene.id)}
                  disabled={loadingScene === scene.id}
                >
                  {loadingScene === scene.id ? "Loading..." : "Load"}
                </ToolButton>
                <ToolButton
                  type="button"
                  size="small"
                  title="Copy URL"
                  onClick={() => {
                    navigator.clipboard.writeText(scene.url);
                    // You might want to show a toast notification here
                  }}
                >
                  Copy URL
                </ToolButton>
              </div>
            </div>
          </Card>
        ))}
        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <ToolButton
            type="button"
            onClick={loadScenes}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh List"}
          </ToolButton>
        </div>
      </div>
    );
  };

  return (
    <Dialog
      onCloseRequest={handleClose}
      title="Scene Browser"
      size="large"
    >
      {renderContent()}
    </Dialog>
  );
};
