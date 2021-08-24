// import React from "react";
import ReactDOM from "react-dom";
import ExcalidrawApp from "./excalidraw-app";
import ExampleApp from "./ExampleApp";

import "./excalidraw-app/pwa";
import "./excalidraw-app/sentry";
window.__EXCALIDRAW_SHA__ = process.env.REACT_APP_GIT_SHA;

ReactDOM.render(<ExampleApp />, document.getElementById("root"));
