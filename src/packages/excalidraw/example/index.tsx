import React from "react";
import ReactDOM from "react-dom";

import App from "./App";

const rootElement = document.getElementById("root");
ReactDOM.render(
  <React.StrictMode>
    <App
      appTitle={"Excalidraw Example"}
      useCustom={(api: any, args?: any[]) => {}}
    />
  </React.StrictMode>,
  rootElement,
);
