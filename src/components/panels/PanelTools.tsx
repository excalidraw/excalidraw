import React from "react";

import { SHAPES } from "../../shapes";
import { capitalizeString } from "../../utils";
import { Panel } from "../Panel";

interface PanelToolsProps {
  activeTool: string;
  onToolChange: (value: string) => void;
}

export const PanelTools: React.FC<PanelToolsProps> = ({
  activeTool,
  onToolChange
}) => {
  return (
    <Panel title="Shapes">
      <div className="panelTools">
        {SHAPES.map(({ value, icon }) => (
          <label
            key={value}
            className="tool"
            title={`${capitalizeString(value)} - ${capitalizeString(value)[0]}`}
          >
            <input
              type="radio"
              checked={activeTool === value}
              onChange={() => {
                onToolChange(value);
              }}
            />
            <div className="toolIcon">{icon}</div>
          </label>
        ))}
      </div>
    </Panel>
  );
};
