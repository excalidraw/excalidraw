import React from "react";

interface PanelSelectionProps {
  onBringForward: React.MouseEventHandler;
  onBringToFront: React.MouseEventHandler;
  onSendBackward: React.MouseEventHandler;
  onSendToBack: React.MouseEventHandler;
}

export const PanelSelection: React.FC<PanelSelectionProps> = ({
  onBringForward,
  onBringToFront,
  onSendBackward,
  onSendToBack
}) => {
  return (
    <div>
      <div className="buttonList">
        <button type="button" onClick={onBringForward}>
          Bring forward
        </button>
        <button type="button" onClick={onBringToFront}>
          Bring to front
        </button>
        <button type="button" onClick={onSendBackward}>
          Send backward
        </button>
        <button type="button" onClick={onSendToBack}>
          Send to back
        </button>
      </div>
    </div>
  );
};
