import React from "react";
import ReactDOM from "react-dom";

import App from "../../excalidraw/example/App";

declare global {
  interface Window {
    ExcalidrawPluginsLib: any;
  }
}
const { usePlugins } = window.ExcalidrawPluginsLib;

const rootElement = document.getElementById("root");
ReactDOM.render(
  <React.StrictMode>
    <App
      appTitle={"Excalidraw Plugins Example"}
      useCustom={usePlugins}
      customArgs={["mathjax"]}
    />
  </React.StrictMode>,
  rootElement,
);
