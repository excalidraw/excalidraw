import React, { useState } from "react";
import "./ChatCanvasModals.scss";

interface ExtendModalProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: (payload: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    prompt?: string;
  }) => void;
}

export const ExtendModal: React.FC<ExtendModalProps> = ({
  open,
  onCancel,
  onSubmit,
}) => {
  const [left, setLeft] = useState(128);
  const [right, setRight] = useState(128);
  const [top, setTop] = useState(128);
  const [bottom, setBottom] = useState(128);
  const [prompt, setPrompt] = useState("");

  if (!open) {
    return null;
  }

  return (
    <div className="chatcanvas-modal-backdrop">
      <div className="chatcanvas-modal">
        <div className="chatcanvas-modal__header">
          <h3 className="chatcanvas-modal__title">Extend Image</h3>
          <button className="chatcanvas-modal__button" onClick={onCancel}>
            ✕
          </button>
        </div>
        <div className="chatcanvas-modal__body">
          <div className="chatcanvas-modal__form">
            <div className="chatcanvas-modal__form-row">
              <label className="chatcanvas-modal__label">
                Left (px)
                <input
                  className="chatcanvas-modal__input"
                  type="number"
                  min={0}
                  value={left}
                  onChange={(event) => setLeft(Number(event.target.value))}
                />
              </label>
              <label className="chatcanvas-modal__label">
                Right (px)
                <input
                  className="chatcanvas-modal__input"
                  type="number"
                  min={0}
                  value={right}
                  onChange={(event) => setRight(Number(event.target.value))}
                />
              </label>
              <label className="chatcanvas-modal__label">
                Top (px)
                <input
                  className="chatcanvas-modal__input"
                  type="number"
                  min={0}
                  value={top}
                  onChange={(event) => setTop(Number(event.target.value))}
                />
              </label>
              <label className="chatcanvas-modal__label">
                Bottom (px)
                <input
                  className="chatcanvas-modal__input"
                  type="number"
                  min={0}
                  value={bottom}
                  onChange={(event) => setBottom(Number(event.target.value))}
                />
              </label>
            </div>
            <label className="chatcanvas-modal__label">
              Prompt (optional)
              <textarea
                className="chatcanvas-modal__textarea"
                rows={3}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe how to extend the scene"
              />
            </label>
            <p className="chatcanvas-modal__hint">
              Tip: Without a backend, this uses a development mock that adds a
              placeholder border.
            </p>
          </div>
        </div>
        <div className="chatcanvas-modal__footer">
          <button className="chatcanvas-modal__button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="chatcanvas-modal__button chatcanvas-modal__button--primary"
            onClick={() =>
              onSubmit({
                left,
                right,
                top,
                bottom,
                prompt: prompt.trim() || undefined,
              })
            }
          >
            Run Extend
          </button>
        </div>
      </div>
    </div>
  );
};
