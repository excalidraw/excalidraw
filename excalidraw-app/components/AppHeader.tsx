import React, { useState, useEffect, useRef } from "react";

const DRAWING_TITLE_STORAGE_KEY = "excalidraw-drawing-title";

interface AppHeaderProps {
  onChange?: () => void;
  excalidrawAPI?: any;
}

export const AppHeader = React.memo(({ onChange, excalidrawAPI }: AppHeaderProps) => {
  const [drawingName, setDrawingName] = useState<string>(() => {
    try {
      const savedTitle = localStorage.getItem(DRAWING_TITLE_STORAGE_KEY);
      return savedTitle || "Untitled Sketch";
    } catch (error) {
      console.error("Error reading title from localStorage:", error);
      return "Untitled Sketch";
    }
  });
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(DRAWING_TITLE_STORAGE_KEY, drawingName);
    } catch (error) {
      console.error("Error saving title to localStorage:", error);
    }
  }, [drawingName]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setDrawingName(newName);
    
    if (excalidrawAPI && typeof excalidrawAPI.updateScene === 'function') {
      excalidrawAPI.updateScene({
        appState: { name: newName }
      });
    }
    
    if (onChange) {
      onChange();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (inputRef.current) {
        inputRef.current.blur();
      }
    }
  };

  useEffect(() => {
    if (excalidrawAPI && typeof excalidrawAPI.updateScene === 'function') {
      excalidrawAPI.updateScene({
        appState: { name: drawingName }
      });
    }
  }, [excalidrawAPI, drawingName]);

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: -20,
        width: "100%",
        zIndex: 100,
        borderBottom: "1px solid #e0e0e0",
        boxShadow: "0px 2px 10px rgba(0, 0, 0, 0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          padding: "0.75rem 1.5rem",
          backgroundColor: "#f5f5f5",
          minHeight: "70px",
        }}
      >
        <img
          src="https://i.imgur.com/KttcKbd.png"
          alt="Logo"
          style={{ height: "40px", marginRight: "1rem" }}
        />
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <input
            ref={inputRef}
            type="text"
            value={drawingName}
            onChange={handleNameChange}
            onKeyDown={handleKeyDown}
            style={{
              width: "300px",
              fontSize: "16px",
              fontWeight: "bold",
              padding: "6px 10px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              outline: "none",
              backgroundColor: "white",
              textAlign: "center", 
            }}
            aria-label="Drawing Title"
          />
        </div>
        <div style={{ width: "40px", marginLeft: "1rem" }}></div>
      </div>
    </header>
  );
});