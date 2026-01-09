import React, { useEffect, useRef } from "react";
import ImageEditor from "tui-image-editor";
import "tui-image-editor/dist/tui-image-editor.css";
import "tui-color-picker/dist/tui-color-picker.css";
import "./ChatCanvasModals.scss";

interface ImageEditorModalProps {
  open: boolean;
  imageDataURL: string | null;
  onCancel: () => void;
  onSave: (dataURL: string) => void;
}

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({
  open,
  imageDataURL,
  onCancel,
  onSave,
}) => {
  const editorRef = useRef<ImageEditor | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !containerRef.current || !imageDataURL) {
      return;
    }

    const editor = new ImageEditor(containerRef.current, {
      includeUI: {
        loadImage: {
          path: imageDataURL,
          name: "ChatCanvas",
        },
        menu: ["shape", "text", "draw", "icon", "crop"],
        initMenu: "draw",
        menuBarPosition: "bottom",
        uiSize: {
          width: "100%",
          height: "600px",
        },
      },
      cssMaxWidth: 800,
      cssMaxHeight: 600,
      usageStatistics: false,
    });

    editorRef.current = editor;

    return () => {
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, [open, imageDataURL]);

  if (!open || !imageDataURL) {
    return null;
  }

  const handleSave = () => {
    if (!editorRef.current) {
      return;
    }

    const dataURL = editorRef.current.toDataURL();
    onSave(dataURL);
  };

  return (
    <div className="chatcanvas-modal-backdrop">
      <div className="chatcanvas-modal">
        <div className="chatcanvas-modal__header">
          <h3 className="chatcanvas-modal__title">Edit Image</h3>
          <button className="chatcanvas-modal__button" onClick={onCancel}>
            ✕
          </button>
        </div>
        <div className="chatcanvas-modal__body">
          <div
            ref={containerRef}
            className="chatcanvas-image-editor"
          />
        </div>
        <div className="chatcanvas-modal__footer">
          <button className="chatcanvas-modal__button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="chatcanvas-modal__button chatcanvas-modal__button--primary"
            onClick={handleSave}
          >
            Save to Canvas
          </button>
        </div>
      </div>
    </div>
  );
};
