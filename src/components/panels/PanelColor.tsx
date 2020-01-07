import React from "react";
import { ColorPicker } from "../ColorPicker";

interface PanelColorProps {
  title: string;
  colorValue: string | null;
  onColorChange: (value: string) => void;
}

export const PanelColor: React.FC<PanelColorProps> = ({
  title,
  onColorChange,
  colorValue
}) => {
  return (
    <>
      <h5>{title}</h5>
      <ColorPicker
        color={colorValue}
        onChange={color => onColorChange(color)}
      />
    </>
  );
};
