import { NonDeletedExcalidrawElement } from "../../element/types";
import React, { useEffect } from "react";
import { exportToCanvas } from "../../scene/export";
import { getDefaultAppState } from "../../appState";

export interface RenderedSceneProps {
  onClick?: () => void;
  elements: readonly NonDeletedExcalidrawElement[];
}

export default function RenderedScene({
  onClick,
  elements,
}: RenderedSceneProps) {
  const canvasRef = React.createRef<HTMLCanvasElement>();

  const scale = 0.5;

  useEffect(() => {
    exportToCanvas(
      elements,
      getDefaultAppState(),
      {
        scale,
        exportBackground: false,
        shouldAddWatermark: false,
        viewBackgroundColor: "#ffffff",
      },
      (width, height) => {
        const canvas = canvasRef.current as HTMLCanvasElement;
        canvas.width = width * scale;
        canvas.height = height * scale;
        return canvas;
      },
    );
  }, [canvasRef, elements]);

  return (
    <div className="CanvasWrapper" onClick={onClick}>
      <canvas ref={canvasRef} className="Canvas" />
    </div>
  );
}
