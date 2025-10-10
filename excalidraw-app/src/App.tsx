import React, { useState, useRef, useEffect } from "react";
import { CanvasState, ExcalidrawElement } from "./canvas/types";
import { initialCanvasState } from "./canvas/canvasState";
import { renderCanvas } from "./canvas/renderCanvas";
import { addElementToActiveLayer } from "./canvas/LayerOperations";
import { LayerPanel } from "./components/LayerPanel";

export const App: React.FC = () => {
  const [canvasState, setCanvasState] = useState<CanvasState>(initialCanvasState);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      renderCanvas(canvasRef.current.getContext("2d")!, canvasState);
    }
  }, [canvasState]);

  const addRandomRect = () => {
    const newElement: ExcalidrawElement = {
      id: `${Date.now()}`,
      type: "rectangle",
      x: Math.random() * 300,
      y: Math.random() * 300,
      width: 50,
      height: 50,
    };
    setCanvasState(addElementToActiveLayer(canvasState, newElement));
  };

  return (
    <div style={{ display: "flex" }}>
      <LayerPanel canvasState={canvasState} setCanvasState={setCanvasState} />
      <div>
        <canvas ref={canvasRef} width={600} height={400} style={{ border: "1px solid black" }} />
        <button onClick={addRandomRect}>Add Rectangle</button>
      </div>
    </div>
  );
};
