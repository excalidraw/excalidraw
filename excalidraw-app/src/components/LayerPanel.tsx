import React from "react";
import { CanvasState } from "../canvas/types";

interface LayerPanelProps {
  canvasState: CanvasState;
  setCanvasState: (state: CanvasState) => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({ canvasState, setCanvasState }) => {
  const toggleVisibility = (layerId: string) => {
    const updatedLayers = canvasState.layers.map((layer) =>
      layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
    );
    setCanvasState({ ...canvasState, layers: updatedLayers });
  };

  const setActiveLayer = (layerId: string) => {
    setCanvasState({ ...canvasState, activeLayerId: layerId });
  };

  return (
    <div className="layer-panel">
      {canvasState.layers.map((layer) => (
        <div key={layer.id} className={`layer-item ${canvasState.activeLayerId === layer.id ? "active" : ""}`}>
          <span onClick={() => setActiveLayer(layer.id)}>{layer.name}</span>
          <button onClick={() => toggleVisibility(layer.id)}>
            {layer.visible ? "👁️" : "🚫"}
          </button>
        </div>
      ))}
    </div>
  );
};
