import App from "../components/ExampleApp";
import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import type * as TExcalidraw from "@excalidraw/excalidraw";

import "@excalidraw/excalidraw/index.css";

declare global {
  interface Window {
    ExcalidrawLib: typeof TExcalidraw;
  }
}

const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
const { Excalidraw } = window.ExcalidrawLib;
root.render(
  <StrictMode>
    <App
      appTitle={"Excalidraw Example"}
      useCustom={(api: any, args?: any[]) => {}}
      excalidrawLib={window.ExcalidrawLib}
    >
      <Excalidraw />
    </App>
  </StrictMode>,
);
