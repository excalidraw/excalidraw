import React, { useEffect, useRef, useState } from "react";
import { useAtom } from "jotai";
import {
  chatPanelWidthAtom,
  isChatPanelOpenAtom,
} from "./atoms";
import type { ExcalidrawImageElement } from "@excalidraw/element/types";
import type { ImageToolAction } from "./types";
import type { ImageEditHistoryEntry } from "../../chatcanvas/image/ImageOps";
import "./InspectorPanel.scss";

interface InspectorPanelProps {
  selectedImage: ExcalidrawImageElement | null;
  onImageToolAction: (action: ImageToolAction) => void;
  onReplaceImage: (file: File) => void;
  onDuplicateImage: () => void;
  layersPanel?: React.ReactNode;
  sceneStats: {
    elementCount: number;
    imageCount: number;
  };
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  selectedImage,
  onImageToolAction,
  onReplaceImage,
  onDuplicateImage,
  layersPanel,
  sceneStats,
}) => {
  const [isInspectorOpen, setIsInspectorOpen] = useAtom(isChatPanelOpenAtom);
  const [panelWidth, setPanelWidth] = useAtom(chatPanelWidthAtom);
  const [isResizing, setIsResizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(280, window.innerWidth - event.clientX);
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setPanelWidth]);

  if (!isInspectorOpen) {
    return null;
  }

  const handleReplaceClick = () => {
    fileInputRef.current?.click();
  };

  const history =
    (selectedImage?.customData as { editHistory?: ImageEditHistoryEntry[] })
      ?.editHistory ?? [];

  return (
    <div className="chatcanvas-inspector" style={{ width: `${panelWidth}px` }}>
      <div className="chatcanvas-inspector__header">
        <h2 className="chatcanvas-inspector__title">Inspector</h2>
        <button
          className="chatcanvas-inspector__close"
          onClick={() => setIsInspectorOpen(false)}
        >
          ✕
        </button>
      </div>

      <div className="chatcanvas-inspector__content">
        {selectedImage ? (
          <>
            <div className="chatcanvas-inspector__section">
              <h3 className="chatcanvas-inspector__section-title">
                Image Inspector
              </h3>
              <div className="chatcanvas-inspector__meta">
                <div>
                  <span>File ID</span>
                  <strong>{selectedImage.fileId}</strong>
                </div>
                <div>
                  <span>Size</span>
                  <strong>
                    {Math.round(selectedImage.width)} ×
                    {Math.round(selectedImage.height)}
                  </strong>
                </div>
                <div>
                  <span>Source</span>
                  <strong>
                    {(selectedImage.customData as { source?: string })?.source ??
                      "unknown"}
                  </strong>
                </div>
              </div>
            </div>

            <div className="chatcanvas-inspector__section">
              <h4 className="chatcanvas-inspector__section-title">
                Image Actions
              </h4>
              <div className="chatcanvas-inspector__actions">
                {(
                  [
                    ["crop", "Crop"],
                    ["edit", "Edit"],
                    ["extend", "Extend"],
                    ["upscale", "Upscale"],
                    ["layers", "Layers"],
                  ] as const
                ).map(([action, label]) => (
                  <button
                    key={action}
                    className="chatcanvas-inspector__button"
                    onClick={() => onImageToolAction(action)}
                  >
                    {label}
                  </button>
                ))}
                <button
                  className="chatcanvas-inspector__button"
                  onClick={handleReplaceClick}
                >
                  Replace
                </button>
                <button
                  className="chatcanvas-inspector__button"
                  onClick={onDuplicateImage}
                >
                  Duplicate
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      onReplaceImage(file);
                    }
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                />
              </div>
            </div>

            <div className="chatcanvas-inspector__section">
              <h4 className="chatcanvas-inspector__section-title">
                Edit History
              </h4>
              {history.length ? (
                <ul className="chatcanvas-inspector__history">
                  {history.map((entry) => (
                    <li key={`${entry.ts}-${entry.fileId}`}>
                      <div>
                        <strong>{entry.op}</strong> ·{" "}
                        {new Date(entry.ts).toLocaleString()}
                      </div>
                      <div className="chatcanvas-inspector__history-meta">
                        {entry.prevWidth}×{entry.prevHeight} → {entry.width}×
                        {entry.height}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="chatcanvas-inspector__hint">
                  No edits recorded yet.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="chatcanvas-inspector__empty">
            <h3>Canvas Overview</h3>
            <p>Select an image on the canvas to see image tools.</p>
            <div className="chatcanvas-inspector__stats">
              <div>
                <span>Total elements</span>
                <strong>{sceneStats.elementCount}</strong>
              </div>
              <div>
                <span>Image assets</span>
                <strong>{sceneStats.imageCount}</strong>
              </div>
            </div>
          </div>
        )}
        {layersPanel}
      </div>

      <div
        className="chatcanvas-inspector__resizer"
        onMouseDown={() => setIsResizing(true)}
        title="Drag to resize"
      />
    </div>
  );
};
