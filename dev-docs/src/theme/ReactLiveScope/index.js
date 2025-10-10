import React from "react";
import ExecutionEnvironment from "@docusaurus/ExecutionEnvironment";
import initialData from "@site/src/initialData";
import { useColorMode } from "@docusaurus/theme-common";

import "@excalidraw/excalidraw/index.css";

let ExcalidrawComp = {};
if (ExecutionEnvironment.canUseDOM) {
  ExcalidrawComp = require("@excalidraw/excalidraw");
}
const Excalidraw = React.forwardRef((props, ref) => {
  if (!window.EXCALIDRAW_ASSET_PATH) {
    window.EXCALIDRAW_ASSET_PATH =
      "https://esm.sh/@excalidraw/excalidraw@0.18.0/dist/prod/";
  }

  const { colorMode } = useColorMode();
  return <ExcalidrawComp.Excalidraw theme={colorMode} {...props} ref={ref} />;
});
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
  CaptureUpdateAction: ExcalidrawComp.CaptureUpdateAction,
  // expose docusaurus color mode hook and a small ThemeButton for examples
  useColorMode,
  ThemeButton: function ThemeButton() {
    const { colorMode, setColorMode } = useColorMode();
    // simple button to toggle between light and dark
    return (
      <button
        onClick={() => setColorMode(colorMode === "dark" ? "light" : "dark")}
        style={{
          padding: "6px 10px",
          borderRadius: 6,
          border: "1px solid var(--ifm-pre-border-color)",
          background: "var(--ifm-pre-background)",
          color: "var(--ifm-color)",
          cursor: "pointer",
        }}
      >
        {colorMode === "dark" ? "Switch to light" : "Switch to dark"}
      </button>
    );
  },
};

export default ExcalidrawScope;
