import React from "react";
import clsx from "clsx";

import type {
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import "./NoteIcon.scss";

import type { UIAppState } from "../types";

interface NoteIconProps {
  textElement: ExcalidrawTextElement;
  appState: UIAppState;
  elementsMap: Map<string, NonDeletedExcalidrawElement>;
  onClick: () => void;
  onMouseEnter: (event: React.MouseEvent) => void;
  onMouseLeave: () => void;
}

export const NoteIcon: React.FC<NoteIconProps> = ({
  textElement,
  appState,
  elementsMap,
  onClick,
  onMouseEnter,
  onMouseLeave,
}) => {
  if (!textElement.note) {
    return null;
  }

  // Position icon exactly like canvas elements - direct scene coordinates
  const iconSize = 10;
  const padding = 2;

  // Use same positioning as canvas rendering
  const iconX = textElement.x + textElement.width + padding;
  const iconY = textElement.y;

  // Apply the same transforms the canvas uses
  const scrollX = (appState as any).scrollX || 0;
  const scrollY = (appState as any).scrollY || 0;

  const screenX = (iconX + scrollX) * appState.zoom.value + appState.offsetLeft;
  const screenY = (iconY + scrollY) * appState.zoom.value + appState.offsetTop;

  // Check if element is selected to highlight the icon
  const isSelected = appState.selectedElementIds[textElement.id];

  return (
    <div
      className={clsx("note-icon", {
        "note-icon--selected": isSelected,
        "note-icon--visible": textElement.note.isVisible,
      })}
      style={{
        position: "absolute",
        left: `${screenX}px`,
        top: `${screenY}px`,
        width: `${iconSize}px`,
        height: `${iconSize}px`,
        transform: `rotate(${-textElement.angle}rad)`,
        transformOrigin: "center",
        zIndex: 3,
        pointerEvents: "auto",
        transition: "none",
        willChange: "left, top, transform",
        backfaceVisibility: "hidden",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title="Edit note"
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="none">
        <path
          d="M3 2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8.5l-2-2V12H4V4h3.5l2-2H3z"
          fill="currentColor"
        />
        <path d="m12 2 2 2-6.5 6.5L6 11l.5-1.5L12 2z" fill="currentColor" />
      </svg>
    </div>
  );
};
