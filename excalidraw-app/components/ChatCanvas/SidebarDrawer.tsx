import React, { useMemo, useState } from "react";
import { useAtom } from "jotai";
import { isImageElement } from "@excalidraw/element";
import { CaptureUpdateAction } from "@excalidraw/element";
import { isSidebarOpenAtom, sidebarWidthAtom } from "./atoms";
import type {
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ImageToolAction } from "./types";
import "./SidebarDrawer.scss";

interface SidebarDrawerProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  elements: readonly ExcalidrawElement[];
  files: BinaryFiles;
  selectedImageId: string | null;
  onImageToolAction: (action: ImageToolAction) => void;
  onExportCanvas: () => void;
  onExportSelection: () => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  excalidrawAPI,
  elements,
  files,
  selectedImageId,
  onImageToolAction,
  onExportCanvas,
  onExportSelection,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useAtom(isSidebarOpenAtom);
  const [sidebarWidth, setSidebarWidth] = useAtom(sidebarWidthAtom);
  const [isResizing, setIsResizing] = useState(false);

  const imageAssets = useMemo(() => {
    return elements
      .filter((element) => isImageElement(element))
      .map((element) => ({
        element,
        file: files[element.fileId],
      }));
  }, [elements, files]);

  const handleMouseDown = () => {
    setIsResizing(true);
  };

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = Math.max(220, Math.min(420, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  const handleSelectAsset = (elementId: string) => {
    if (!excalidrawAPI) {
      return;
    }

    excalidrawAPI.updateScene({
      appState: {
        selectedElementIds: {
          [elementId]: true,
        },
      },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    const target = elements.find((element) => element.id === elementId);
    if (target) {
      excalidrawAPI.scrollToContent([target]);
    }
  };

  if (!isSidebarOpen) {
    return null;
  }

  return (
    <div className="chatcanvas-sidebar" style={{ width: `${sidebarWidth}px` }}>
      <div className="chatcanvas-sidebar__header">
        <h2 className="chatcanvas-sidebar__title">Image Design</h2>
        <button
          className="chatcanvas-sidebar__close"
          onClick={() => setIsSidebarOpen(false)}
          title="Close sidebar"
        >
          ✕
        </button>
      </div>

      <div className="chatcanvas-sidebar__content">
        <section className="chatcanvas-sidebar__section">
          <div className="chatcanvas-sidebar__section-title">Image Tools</div>
          <div className="chatcanvas-sidebar__tool-grid">
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
                className="chatcanvas-sidebar__tool"
                onClick={() => onImageToolAction(action)}
                disabled={!selectedImageId}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="chatcanvas-sidebar__section">
          <div className="chatcanvas-sidebar__section-title">Assets</div>
          {imageAssets.length ? (
            <div className="chatcanvas-sidebar__assets">
              {imageAssets.map(({ element, file }) => (
                <button
                  key={element.id}
                  className={`chatcanvas-sidebar__asset ${
                    element.id === selectedImageId
                      ? "chatcanvas-sidebar__asset--active"
                      : ""
                  }`}
                  onClick={() => handleSelectAsset(element.id)}
                >
                  <div className="chatcanvas-sidebar__asset-thumb">
                    {file?.dataURL ? (
                      <img src={file.dataURL} alt="asset" />
                    ) : (
                      <div className="chatcanvas-sidebar__asset-placeholder">
                        No preview
                      </div>
                    )}
                  </div>
                  <div className="chatcanvas-sidebar__asset-meta">
                    <span>Image</span>
                    <small>{element.id}</small>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="chatcanvas-sidebar__placeholder">
              No image assets yet.
            </p>
          )}
        </section>

        <section className="chatcanvas-sidebar__section">
          <div className="chatcanvas-sidebar__section-title">Export</div>
          <div className="chatcanvas-sidebar__export">
            <button
              className="chatcanvas-sidebar__tool"
              onClick={onExportCanvas}
            >
              Export Canvas
            </button>
            <button
              className="chatcanvas-sidebar__tool"
              onClick={onExportSelection}
              disabled={!selectedImageId}
            >
              Export Selected Image
            </button>
          </div>
        </section>
      </div>

      <div
        className="chatcanvas-sidebar__resizer"
        onMouseDown={handleMouseDown}
        title="Drag to resize"
      />
    </div>
  );
};
