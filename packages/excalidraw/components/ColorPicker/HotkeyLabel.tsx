import React from "react";

import { getContrastYIQ } from "./colorPickerUtils";

interface HotkeyLabelProps {
  color: string;
  keyLabel: string | number;
  isCustomColor?: boolean;
  isShade?: boolean;
}
const HotkeyLabel = ({
  color,
  keyLabel,
  isCustomColor = false,
  isShade = false,
}: HotkeyLabelProps) => {
  return (
    <div
      className="color-picker__button__hotkey-label"
      style={{
        color: getContrastYIQ(color, isCustomColor),
      }}
    >
      {isShade && "⇧"}
      {keyLabel}
    </div>
  );
};

export default HotkeyLabel;
