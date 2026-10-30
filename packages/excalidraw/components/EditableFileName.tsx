import { Theme } from "@excalidraw/element/types";
import { useState } from "react";

function EditableFileName({fileName, setFileName, theme}: {fileName: string, setFileName: (name: string) => void, theme: Theme}) {
  const [editing, setEditing] = useState(false);

  return (
    <div>
      {editing ? (
        <input
          value={fileName}
          autoFocus
          onChange={(e) => setFileName(e.target.value)}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setEditing(false);
            }
          }}
          style={{
            width: `${Math.max(fileName.length, 2)}ch`,
            color: theme === "light" ? "black" : "white",
            border: "none",
            outline: "none",
            boxShadow: "none",
            background: "transparent",
            padding: 0,
            margin: 0,
            font: "inherit",
            textAlign: "left",
            display: "block"
          }}
        />
      ) : (
        <label
          onClick={() => setEditing(true)}
          style={{
            background: "transparent",
            cursor: "pointer"
          }}
        >
          {fileName}
        </label>
      )}
    </div>
  );
}

export default EditableFileName;