"use client";
import * as excalidrawLib from "@excalidraw/excalidraw/src";
import { Excalidraw } from "@excalidraw/excalidraw/src";

import "@excalidraw/excalidraw/index.css";

import App from "../../with-script-in-browser/components/ExampleApp";

const ExcalidrawWrapper: React.FC = () => {
  return (
    <>
      <App
        appTitle={"Excalidraw with Nextjs Example"}
        useCustom={(api: any, args?: any[]) => {}}
        excalidrawLib={excalidrawLib}
      >
        <Excalidraw />
      </App>
    </>
  );
};

export default ExcalidrawWrapper;
