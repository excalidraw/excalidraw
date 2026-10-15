import React, { useState } from "react";

import type { LinkDirection } from "@excalidraw/element";

import { PlusIcon } from "./icons";

import "./FlowchartAddButton.scss";

const DIRECTIONS: readonly {
  direction: LinkDirection;
  label: string;
}[] = [
  { direction: "up", label: "above" },
  { direction: "left", label: "left" },
  { direction: "right", label: "right" },
  { direction: "down", label: "below" },
];

const DirectionIcon = ({ direction }: { direction: LinkDirection }) => {
  const rotations: Record<LinkDirection, number> = {
    up: -90,
    right: 0,
    down: 90,
    left: 180,
  };

  return (
    <svg
      aria-hidden="true"
      className="flowchart-add-step__direction-icon"
      viewBox="0 0 20 20"
      style={{ transform: `rotate(${rotations[direction]}deg)` }}
    >
      <path d="M3 10h12" />
      <path d="m11 6 4 4-4 4" />
    </svg>
  );
};

export const FlowchartAddButton = ({
  onAdd,
}: {
  onAdd: (direction: LinkDirection) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="flowchart-add-step"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Add step"
        className="flowchart-add-step__trigger"
        data-testid="flowchart-add-step"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        {PlusIcon}
        <span>Add step</span>
      </button>
      {isOpen && (
        <div
          aria-label="Choose direction"
          className="flowchart-add-step__picker"
          role="menu"
        >
          {DIRECTIONS.map(({ direction, label }) => (
            <button
              aria-label={`Add step ${label}`}
              className={`flowchart-add-step__direction flowchart-add-step__direction--${direction}`}
              data-testid={`flowchart-add-step-${direction}`}
              key={direction}
              onClick={() => {
                setIsOpen(false);
                onAdd(direction);
              }}
              role="menuitem"
              title={`Add step ${label}`}
              type="button"
            >
              <DirectionIcon direction={direction} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
