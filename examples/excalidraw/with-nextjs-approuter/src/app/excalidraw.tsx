"use client";
import App from "../../../App";

import { useState, useEffect, useRef } from "react";
import "@excalidraw/excalidraw/index.css";

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

  return (
    <>
      {ExcalidrawComp && (
        <App
          appTitle={"Excalidraw with Nextjs Example"}
          useCustom={(api: any, args?: any[]) => {}}
          excalidrawLib={excalidrawLib.current}
        >
          <ExcalidrawComp />
        </App>
      )}
    </>
  );
};

export default ExcalidrawWithClientOnly;
