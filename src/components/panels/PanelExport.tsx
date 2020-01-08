import React from "react";
import { EditableText } from "../EditableText";
import { Panel } from "../Panel";

interface PanelExportProps {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onExportAsPNG: React.MouseEventHandler;
  exportBackground: boolean;
  onExportBackgroundChange: (val: boolean) => void;
  onSaveScene: React.MouseEventHandler;
  onLoadScene: React.MouseEventHandler;
}

export const PanelExport: React.FC<PanelExportProps> = ({
  projectName,
  exportBackground,
  onProjectNameChange,
  onExportBackgroundChange,
  onSaveScene,
  onLoadScene,
  onExportAsPNG
}) => {
  return (
    <Panel title="Export">
      <div className="panelColumn">
        <h5>Name</h5>
        {projectName && (
          <EditableText
            value={projectName}
            onChange={(name: string) => onProjectNameChange(name)}
          />
        )}
        <h5>Image</h5>
        <button onClick={onExportAsPNG}>Export to png</button>
        <label>
          <input
            type="checkbox"
            checked={exportBackground}
            onChange={e => {
              onExportBackgroundChange(e.target.checked);
            }}
          />
          background
        </label>
        <h5>Scene</h5>
        <button onClick={onSaveScene}>Save as...</button>
        <button onClick={onLoadScene}>Load file...</button>
      </div>
    </Panel>
  );
};
