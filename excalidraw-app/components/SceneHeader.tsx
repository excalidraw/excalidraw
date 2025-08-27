import React, { useEffect, useRef, useState } from "react";
import { useAtom } from "../app-jotai";
import { sceneBrowserDialogStateAtom } from "./SceneBrowser";

export const SceneHeader: React.FC<{
  getName: () => string;
  setName: (name: string) => void;
}> = ({ getName, setName }) => {
  const [, setDialogState] = useAtom(sceneBrowserDialogStateAtom);
  const [editing, setEditing] = useState(false);
  const [name, setLocalName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalName(getName());
  }, [getName]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = name.trim();
    setName(trimmed);
    setEditing(false);
  };

  return (
    <div className="SceneHeader">
      {/* <button
        type="button"
        className="SceneHeader__browse-scenes"
        aria-label="Browse scenes"
        onClick={() => setDialogState({ isOpen: true })}
        title="Browse scenes"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10,9 9,9 8,9"/>
        </svg>
      </button> */}
      {editing ? (
        <input
          ref={inputRef}
          className="SceneHeader__name-input"
          value={name}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setLocalName(getName());
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          className="SceneHeader__name"
          onClick={() => setEditing(true)}
          title="Rename scene"
        >
          {name || "Untitled"}
        </button>
      )}
    </div>
  );
};

export default SceneHeader;


