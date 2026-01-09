import React, { useState } from "react";
import "./ChatCanvasModals.scss";

interface UpscaleModalProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: (payload: { scale: number }) => void;
}

export const UpscaleModal: React.FC<UpscaleModalProps> = ({
  open,
  onCancel,
  onSubmit,
}) => {
  const [scale, setScale] = useState(2);

  if (!open) {
    return null;
  }

  return (
    <div className="chatcanvas-modal-backdrop">
      <div className="chatcanvas-modal">
        <div className="chatcanvas-modal__header">
          <h3 className="chatcanvas-modal__title">Upscale Image</h3>
          <button className="chatcanvas-modal__button" onClick={onCancel}>
            ✕
          </button>
        </div>
        <div className="chatcanvas-modal__body">
          <div className="chatcanvas-modal__form">
            <label className="chatcanvas-modal__label">
              Scale
              <select
                className="chatcanvas-modal__select"
                value={scale}
                onChange={(event) => setScale(Number(event.target.value))}
              >
                <option value={2}>2x</option>
                <option value={4}>4x</option>
              </select>
            </label>
            <p className="chatcanvas-modal__hint">
              If the backend is unavailable, we will use a high-quality browser
              resize (not true super-resolution).
            </p>
          </div>
        </div>
        <div className="chatcanvas-modal__footer">
          <button className="chatcanvas-modal__button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="chatcanvas-modal__button chatcanvas-modal__button--primary"
            onClick={() => onSubmit({ scale })}
          >
            Upscale
          </button>
        </div>
      </div>
    </div>
  );
};
