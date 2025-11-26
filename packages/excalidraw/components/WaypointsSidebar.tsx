import React, { useState } from "react";

import type { Waypoint } from "@excalidraw/excalidraw/types";

type Props = {
  waypoints: Waypoint[];
  onAdd: () => void;
  onJump: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
};

export const WaypointsPanel: React.FC<Props> = ({
  waypoints,
  onAdd,
  onJump,
  onRename,
  onDelete,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const startEditing = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const commitEditing = () => {
    if (editingId) {
      onRename(editingId, editingName.trim() || editingName);
    }
    setEditingId(null);
    setEditingName("");
  };

  return (
    <div className="waypoints-panel">
      <div className="waypoints-panel__header">
        <span>Waypoints</span>
        <button onClick={onAdd}>Add current view</button>
      </div>

      {waypoints.length === 0 ? (
        <p className="waypoints-panel__empty">
          No waypoints yet. Use “Add current view”.
        </p>
      ) : (
        <ul className="waypoints-panel__list">
          {waypoints.map((w) => (
            <li key={w.id} className="waypoints-panel__item">
              {editingId === w.id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={commitEditing}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      commitEditing();
                    }
                    if (e.key === "Escape") {
                      setEditingId(null);
                      setEditingName("");
                    }
                  }}
                />
              ) : (
                <button
                  className="waypoints-panel__jump"
                  onClick={() => onJump(w.id)}
                  onDoubleClick={() => startEditing(w.id, w.name)}
                  title="Jump to waypoint (double-click to rename)"
                >
                  {w.name}
                </button>
              )}

              <button
                className="waypoints-panel__rename"
                onClick={() => startEditing(w.id, w.name)}
              >
                ✏️
              </button>
              <button
                className="waypoints-panel__delete"
                onClick={() => onDelete(w.id)}
              >
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
