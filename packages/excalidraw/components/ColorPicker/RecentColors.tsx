import React from "react";
// 🚨 FIX: We changed this line to use Excalidraw's specific Jotai store!
import { useAtom } from "../../editor-jotai";
import { recentColorsAtom } from "./colorPickerUtils";

interface RecentColorsProps {
  onChange: (color: string) => void;
}

export const RecentColors = ({ onChange }: RecentColorsProps) => {
  const [recentColors] = useAtom(recentColorsAtom);

  return (
    <div style={{ marginTop: "12px", padding: "8px", borderTop: "1px solid #e5e5e5" }}>
      <div style={{ fontSize: "0.75rem", marginBottom: "8px", fontWeight: "bold" }}>
        Recent Colors ({recentColors.length})
      </div>
      
      {recentColors.length === 0 ? (
        <div style={{ fontSize: "0.75rem", color: "#888" }}>No colors picked yet</div>
      ) : (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {recentColors.map((color, index) => (
            <button
              key={`${color}-${index}`}
              style={{
                backgroundColor: color,
                width: "24px",
                height: "24px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                cursor: "pointer",
                padding: 0
              }}
              onClick={(e) => {
                e.preventDefault();
                onChange(color);
              }}
              title={color}
            />
          ))}
        </div>
      )}
    </div>
  );
};