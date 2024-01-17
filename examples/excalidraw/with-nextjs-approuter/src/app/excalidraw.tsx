"use client";
import dynamic from "next/dynamic";
import "@excalidraw/excalidraw/index.css";
import { useState } from "react";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/dist/excalidraw/types";

import "../../../with-script-in-browser/App.scss";
import { useRef } from "react";
import { useEffect } from "react";

// This Hack is needed until the canvas round rect polyfil is supported in nextjs, currently it throws Path2D not found error
const Excalidraw: any = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  {
    ssr: false,
  },
);

const ExcalidrawWithClientOnly = () => {
  const excalidrawUtils = useRef<ExcalidrawImperativeAPI | null>(null);

  // This Hack is needed until the canvas round rect polyfil is supported in nextjs, currently it throws Path2D not found error
  useEffect(() => {
    const importExcalidrawUtils = async () => {
      const { Excalidraw, ...rest } = await import("@excalidraw/excalidraw");
      excalidrawUtils.current = rest;
    };
    importExcalidrawUtils();
  }, []);

  const updateScene = async () => {
    const elements = excalidrawUtils.current.convertToExcalidrawElements([
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
      elements: excalidrawUtils.current.restoreElements(elements, null),
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
        <Excalidraw
          excalidrawAPI={(api: ExcalidrawImperativeAPI) =>
            setExcalidrawAPI(api)
          }
        />
      </div>
    </>
  );
};

export default ExcalidrawWithClientOnly;
