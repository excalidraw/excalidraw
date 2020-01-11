import React from "react";
import { ColorPicker } from "../ColorPicker";

interface PanelColorProps {
  title: string;
  colorType: "canvasBackground" | "elementBackground" | "elementStroke";
  colorValue: string | null;
  onColorChange: (value: string) => void;
}

export const PanelColor: React.FC<PanelColorProps> = ({
  title,
  colorType,
  onColorChange,
  colorValue
}) => {
  return (
    <>
      <h5>{title}</h5>
      <ColorPicker
        type={colorType}
        color={colorValue}
        onChange={color => onColorChange(color)}
      />
    </>
  );
};
