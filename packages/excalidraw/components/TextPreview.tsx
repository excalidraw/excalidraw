import React from "react";
import { AppState } from "../types";
import "./TextPreview.scss";

export const TextPreview = ({
  textPreview,
  theme,
}: {
  textPreview: AppState["textPreview"];
  theme: AppState["theme"];
}) => {
  if (!textPreview) {
    return null;
  }

  // In dark mode, use white text for better readability
  const textColor = theme === "dark" ? "white" : textPreview.color;

  return (
    <div className="excalidraw-text-preview-container">
      <div
        className="excalidraw-text-preview"
        style={{
          font: textPreview.font,
          textAlign: textPreview.textAlign as any,
          color: textColor,
          opacity: (textPreview.opacity / 100) * 0.8,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflowWrap: "break-word",
        }}
      >
        {textPreview.text}
      </div>
    </div>
  );
};
