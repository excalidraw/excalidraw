import React from "react";

import { ColorPicker } from "../ColorPicker";

interface PanelCanvasProps {
  viewBackgroundColor: string;
  onViewBackgroundColorChange: (val: string) => void;
  onClearCanvas: React.MouseEventHandler;
}

export const PanelCanvas: React.FC<PanelCanvasProps> = ({
  viewBackgroundColor,
  onViewBackgroundColorChange,
  onClearCanvas
}) => {
  return (
    <>
      <h4>Canvas</h4>
      <div className="panelColumn">
        <h5>Canvas Background Color</h5>
        <ColorPicker
          color={viewBackgroundColor}
          onChange={color => onViewBackgroundColorChange(color)}
        />
        <button
          type="button"
          onClick={onClearCanvas}
          title="Clear the canvas & reset background color"
        >
          Clear canvas
        </button>
      </div>
    </>
  );
};
