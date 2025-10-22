import { useState, useRef, useCallback } from "react";
import Spinner from "../Spinner";
import { ToolButton } from "../ToolButton";
import { ZoomInIcon, ZoomOutIcon } from "../icons";
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from "@excalidraw/common";

const ErrorComp = ({ error }: { error: string }) => {
  return (
    <div
      data-testid="ttd-dialog-output-error"
      className="ttd-dialog-output-error"
    >
      Error! <p>{error}</p>
    </div>
  );
};

interface TTDDialogOutputProps {
  error: Error | null;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  loaded: boolean;
}

export const TTDDialogOutput = ({
  error,
  canvasRef,
  loaded,
}: TTDDialogOutputProps) => {
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });

  const handleZoomIn = () => {
    setZoom((prevZoom) => Math.min(prevZoom + ZOOM_STEP, MAX_ZOOM));
  };

  const handleZoomOut = () => {
    setZoom((prevZoom) => Math.max(prevZoom - ZOOM_STEP, MIN_ZOOM));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom <= 1) return; // Only allow panning when zoomed in

      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    },
    [zoom],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning || zoom <= 1) return;

      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;

      setPanOffset((prev) => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));

      setLastPanPoint({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    },
    [isPanning, lastPanPoint, zoom],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
  }, []);

  return (
    <div className="ttd-dialog-output-wrapper">
      {error && <ErrorComp error={error.message} />}
      <div className="ttd-dialog-output-controls">
        <ToolButton
          type="button"
          className="ttd-dialog-zoom-button"
          icon={ZoomOutIcon}
          onClick={handleZoomOut}
          disabled={zoom <= MIN_ZOOM}
          title="Zoom Out"
          aria-label="Zoom Out"
        />
        <ToolButton
          type="button"
          className="ttd-dialog-zoom-button"
          label={`${Math.round(zoom * 100)}%`}
          onClick={handleResetZoom}
          title="Reset Zoom"
          aria-label="Reset Zoom"
        />
        <ToolButton
          type="button"
          className="ttd-dialog-zoom-button"
          icon={ZoomInIcon}
          onClick={handleZoomIn}
          disabled={zoom >= MAX_ZOOM}
          title="Zoom In"
          aria-label="Zoom In"
        />
      </div>
      {loaded ? (
        <div
          className="ttd-dialog-output-canvas-container"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          style={{
            cursor: zoom > 1 ? (isPanning ? "grabbing" : "grab") : "default",
          }}
        >
            <div
              ref={canvasRef}
              style={{
                opacity: error ? "0.15" : 1,
                transform: `translate3d(${panOffset.x / zoom}px, ${
                  panOffset.y / zoom
                }px, 0) scale3d(${zoom}, ${zoom}, 1)`,
                transformOrigin: "center center",
              }}
              className="ttd-dialog-output-canvas-content"
            />
        </div>
      ) : (
        <Spinner size="2rem" />
      )}
    </div>
  );
};
