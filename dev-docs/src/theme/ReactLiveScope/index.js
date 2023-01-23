import React from "react";
import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";
import initialData from "@site/src/initialData";

let ExcalidrawComp = {};
if (ExecutionEnvironment.canUseDOM) {
  ExcalidrawComp = require("@excalidraw/excalidraw");
}
// Add react-live imports you need here
const ExcalidrawScope = {
  React,
  ...React,
  Excalidraw: ExcalidrawComp.Excalidraw,
  Footer: ExcalidrawComp.Footer,
  useDevice: ExcalidrawComp.useDevice,
  MainMenu: ExcalidrawComp.MainMenu,
  WelcomeScreen: ExcalidrawComp.WelcomeScreen,
  LiveCollaborationTrigger: ExcalidrawComp.LiveCollaborationTrigger,
  Sidebar: ExcalidrawComp.Sidebar,
  exportToCanvas: ExcalidrawComp.exportToCanvas,
  initialData,
};

export default ExcalidrawScope;
