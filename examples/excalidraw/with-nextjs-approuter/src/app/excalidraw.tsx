"use client";
import { useState, useEffect, useRef } from "react";
import "@excalidraw/excalidraw/index.css";

import "../../../with-script-in-browser/App.scss";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/dist/excalidraw/types";

const ExcalidrawWithClientOnly = () => {
  const excalidrawLib = useRef<any>(null);
  const [ExcalidrawComp, setExcalidrawComp] = useState<any>(null);

  // This Hack is needed until since Excalidraw doesn't support SSR
  // If you want to use only Excalidraw comp, you can use nextjs dynamic syntax to import Excalidraw
  useEffect(() => {
    const importExcalidraw = async () => {
      excalidrawLib.current = await import("@excalidraw/excalidraw");
      setExcalidrawComp(excalidrawLib.current.Excalidraw);
    };
    importExcalidraw();
  }, []);

  const updateScene = async () => {
    if (!excalidrawLib.current) {
      return;
    }
    const elements = excalidrawLib.current.convertToExcalidrawElements([
      {
        type: "rectangle",
        id: "rect-1",
        fillStyle: "hachure",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 1,
        angle: 0,
        x: 100.50390625,
        y: 93.67578125,
        strokeColor: "#c92a2a",
        width: 186.47265625,
        height: 141.9765625,
        seed: 1968410350,
        roundness: {
          type: 3,
          value: 32,
        },
      },
      {
        type: "arrow",
        x: 300,
        y: 150,
        start: { id: "rect-1" },
        end: { type: "ellipse" },
      },
      {
        type: "text",
        x: 300,
        y: 100,
        text: "HELLO WORLD!",
      },
    ]);

    const sceneData = {
      elements: excalidrawLib.current.restoreElements(elements, null),
      appState: {
        viewBackgroundColor: "#edf2ff",
      },
    };
    excalidrawAPI?.updateScene(sceneData);
  };
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  return (
    <>
      <div className="button-wrapper">
        <button onClick={updateScene}>update scene</button>
      </div>
      <div style={{ height: "800px", margin: "40px" }}>
        {ExcalidrawComp && (
          <ExcalidrawComp
            excalidrawAPI={(api: ExcalidrawImperativeAPI) =>
              setExcalidrawAPI(api)
            }
          />
        )}
      </div>
    </>
  );
};

export default ExcalidrawWithClientOnly;
