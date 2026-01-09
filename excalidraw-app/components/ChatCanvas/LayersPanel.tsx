import React from "react";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import "./LayersPanel.scss";

export type LayerReorderDirection =
  | "forward"
  | "backward"
  | "front"
  | "back";

interface LayersPanelProps {
  elements: readonly ExcalidrawElement[];
  selectedElementId: string | null;
  onSelectElement: (elementId: string) => void;
  onReorder: (direction: LayerReorderDirection) => void;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({
  elements,
  selectedElementId,
  onSelectElement,
  onReorder,
}) => {
  const reversed = [...elements].reverse();

  return (
    <div className="chatcanvas-layers">
      <div className="chatcanvas-layers__header">
        <h3>Layers</h3>
        <div className="chatcanvas-layers__controls">
          {(
            [
              ["front", "Front"],
              ["forward", "Forward"],
              ["backward", "Backward"],
              ["back", "Back"],
            ] as const
          ).map(([direction, label]) => (
            <button
              key={direction}
              className="chatcanvas-layers__button"
              onClick={() => onReorder(direction)}
              disabled={!selectedElementId}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <ul className="chatcanvas-layers__list">
        {reversed.map((element) => (
          <li
            key={element.id}
            className={`chatcanvas-layers__item ${
              element.id === selectedElementId
                ? "chatcanvas-layers__item--active"
                : ""
            }`}
            onClick={() => onSelectElement(element.id)}
          >
            <span className="chatcanvas-layers__type">{element.type}</span>
            <span className="chatcanvas-layers__id">{element.id}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
