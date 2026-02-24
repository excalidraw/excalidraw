import React from "react";

import { FONT_FAMILY } from "@excalidraw/common";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import "./NoteTooltip.scss";

import type { UIAppState } from "../types";

interface NoteTooltipProps {
  textElement: ExcalidrawTextElement;
  appState: UIAppState;
  x: number;
  y: number;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export const NoteTooltip: React.FC<NoteTooltipProps> = ({
  textElement,
  appState,
  x,
  y,
  onClose,
  onMouseEnter,
  onMouseLeave,
}) => {
  const note = textElement.note;

  if (!note || !note.content) {
    return null;
  }

  // Position tooltip near the cursor/element but ensure it stays in viewport
  const tooltipX = Math.min(Math.max(x + 10, 10), appState.width - 250);
  const tooltipY = Math.max(y - 10, 10);

  return (
    <div
      className="note-tooltip"
      style={{
        position: "fixed",
        left: `${tooltipX}px`,
        top: `${tooltipY}px`,
        zIndex: 9999,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="note-tooltip__container">
        <div
          className="note-tooltip__content"
          style={{
            fontSize: `${note.formatting.fontSize}px`,
            fontFamily:
              Object.entries(FONT_FAMILY).find(
                ([, value]) => value === note.formatting.fontFamily,
              )?.[0] || "Arial",
            textAlign: note.formatting
              .textAlign as React.CSSProperties["textAlign"],
            color: note.formatting.strokeColor,
            backgroundColor: note.formatting.backgroundColor,
            fontWeight: note.formatting.bold ? "bold" : "normal",
            fontStyle: note.formatting.italic ? "italic" : "normal",
          }}
        >
          {note.content}
        </div>
      </div>
    </div>
  );
};
