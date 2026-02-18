import React, { useEffect, useState } from "react";
import { loadPersistentCustomColors, savePersistentCustomColors, isColorDark } from "./colorPickerUtils";

interface ColorPaletteTableProps {
  selectedColor: string | null;
  onChange: (color: string) => void;
}

export const ColorPaletteTable: React.FC<ColorPaletteTableProps> = ({
  selectedColor,
  onChange,
}) => {
  const [colors, setColors] = useState<string[]>([]);

  useEffect(() => {
    setColors(loadPersistentCustomColors());
  }, []);

  const addColor = () => {
    const newColor = prompt("Enter a hex color (e.g. #ff0000):", "#000000");
    if (newColor && /^#([0-9A-Fa-f]{3}){1,2}$/.test(newColor)) {
      const updated = [...new Set([...colors, newColor])];
      setColors(updated);
      savePersistentCustomColors(updated);
    }
  };

  const removeColor = (color: string) => {
    const updated = colors.filter((c) => c !== color);
    setColors(updated);
    savePersistentCustomColors(updated);
  };

  return (
    <div className="palette-table">
      <div className="grid">
        {colors.map((c) => (
          <button
            key={c}
            className={`palette-cell ${c === selectedColor ? "selected" : ""}`}
            style={{
              backgroundColor: c,
              color: isColorDark(c) ? "white" : "black",
            }}
            onClick={() => onChange(c)}
            onContextMenu={(e) => {
              e.preventDefault();
              removeColor(c);
            }}
            aria-label={`Custom color ${c}`}
          >
            {c === selectedColor ? "✓" : ""}
          </button>
        ))}
      </div>
      <button className="add-color-btn" onClick={addColor}>
        + Add Color
      </button>
    </div>
  );
};
