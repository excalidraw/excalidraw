import React, { useEffect, useRef, useState } from "react";
import Cropper from "cropperjs";
import "cropperjs/dist/cropper.css";
import "./ChatCanvasModals.scss";

interface CropModalProps {
  open: boolean;
  imageDataURL: string | null;
  onCancel: () => void;
  onSave: (blob: Blob, width: number, height: number) => void;
}

export const CropModal: React.FC<CropModalProps> = ({
  open,
  imageDataURL,
  onCancel,
  onSave,
}) => {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const cropperRef = useRef<Cropper | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open || !imageRef.current || !imageDataURL) {
      return;
    }

    cropperRef.current = new Cropper(imageRef.current, {
      viewMode: 1,
      autoCropArea: 1,
      background: false,
    });

    return () => {
      cropperRef.current?.destroy();
      cropperRef.current = null;
    };
  }, [open, imageDataURL]);

  if (!open || !imageDataURL) {
    return null;
  }

  const handleSave = async () => {
    if (!cropperRef.current) {
      return;
    }
    setIsSaving(true);

    const canvas = cropperRef.current.getCroppedCanvas();
    canvas.toBlob((blob) => {
      if (blob) {
        onSave(blob, canvas.width, canvas.height);
      }
      setIsSaving(false);
    }, "image/png");
  };

  return (
    <div className="chatcanvas-modal-backdrop">
      <div className="chatcanvas-modal">
        <div className="chatcanvas-modal__header">
          <h3 className="chatcanvas-modal__title">Crop Image</h3>
          <button className="chatcanvas-modal__button" onClick={onCancel}>
            ✕
          </button>
        </div>
        <div className="chatcanvas-modal__body">
          <img
            ref={imageRef}
            src={imageDataURL}
            alt="Crop preview"
            className="chatcanvas-cropper"
          />
        </div>
        <div className="chatcanvas-modal__footer">
          <button className="chatcanvas-modal__button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="chatcanvas-modal__button chatcanvas-modal__button--primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Apply Crop"}
          </button>
        </div>
      </div>
    </div>
  );
};
