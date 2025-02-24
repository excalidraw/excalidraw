import React from "react";
import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";
import initialData from "@site/src/initialData";
import { useColorMode } from "@docusaurus/theme-common";

let ExcalidrawComp = {};
if (ExecutionEnvironment.canUseDOM) {
  ExcalidrawComp = require("@excalidraw/excalidraw");
}
const Excalidraw = (props) => {
  const { colorMode } = useColorMode();
  return (
    <ExcalidrawComp.Excalidraw theme={colorMode} {...props} ref={props.ref} />
  );
};
// Add react-live imports you need here
const ExcalidrawScope = {
  React,
  ...React,
  Excalidraw,
  Footer: ExcalidrawComp.Footer,
  useDevice: ExcalidrawComp.useDevice,
  MainMenu: ExcalidrawComp.MainMenu,
  WelcomeScreen: ExcalidrawComp.WelcomeScreen,
  LiveCollaborationTrigger: ExcalidrawComp.LiveCollaborationTrigger,
  Sidebar: ExcalidrawComp.Sidebar,
  exportToCanvas: ExcalidrawComp.exportToCanvas,
  initialData,
  useI18n: ExcalidrawComp.useI18n,
  convertToExcalidrawElements: ExcalidrawComp.convertToExcalidrawElements,
};

export default ExcalidrawScope;
