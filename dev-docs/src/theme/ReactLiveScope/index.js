import React from "react";
import {
  Excalidraw,
  Footer,
  useDevice,
  MainMenu,
} from "@excalidraw/excalidraw";

// Add react-live imports you need here
const ExcalidrawScope = {
  React,
  ...React,
  Excalidraw,
  Footer,
  useDevice,
  MainMenu,
};

export default ExcalidrawScope;
