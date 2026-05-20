import React from "react";
import { isColorDark } from "@excalidraw/common";

interface HotkeyLabelProps {
  color: string;
  keyLabel: string | number;
  isShade?: boolean;
}
const HotkeyLabel = ({
  color,
  keyLabel,
  isShade = false,
}: HotkeyLabelProps) => {
  return (
    <div
      className="color-picker__button__hotkey-label"
      style={{
        color: isColorDark(color) ? "#fff" : "#000",
      }}
    >
      {isShade && "⇧"}
      {keyLabel}
    </div>
  );
};

export default HotkeyLabel;
