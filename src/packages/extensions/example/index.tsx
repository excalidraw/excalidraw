import React from "react";
import ReactDOM from "react-dom";

import App from "../../excalidraw/example/App";

declare global {
  interface Window {
    ExcalidrawExtensionsLib: any;
  }
}
const { useExtensions } = window.ExcalidrawExtensionsLib;

const rootElement = document.getElementById("root");
ReactDOM.render(
  <React.StrictMode>
    <App
      appTitle={"Excalidraw Extensions Example"}
      useCustom={useExtensions}
      customArgs={["mathjax"]}
    />
  </React.StrictMode>,
  rootElement,
);
