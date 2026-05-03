"use client";
import * as excalidrawLib from "@excalidraw/excalidraw";
import { Excalidraw } from "@excalidraw/excalidraw";

import "@excalidraw/excalidraw/index.css";

import type { ScrollConstraints } from "@excalidraw/excalidraw/types";

import App from "../../with-script-in-browser/components/ExampleApp";

const scrollConstraints: ScrollConstraints = {
  x: 0,
  y: 0,
  width: 850,
  height: 400,
  lockZoom: true,
  overscrollAllowance: 0,
  viewportZoomFactor: 1,
};

const ExcalidrawWrapper: React.FC = () => {
  return (
    <>
      <App
        appTitle={"Excalidraw with Nextjs Example"}
        useCustom={(api: any, args?: any[]) => {}}
        excalidrawLib={excalidrawLib}
      >
        <Excalidraw scrollConstraints={scrollConstraints} />
      </App>
    </>
  );
};

export default ExcalidrawWrapper;
