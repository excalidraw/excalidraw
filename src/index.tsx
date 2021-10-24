import ReactDOM from "react-dom";
import ExcalidrawApp from "./excalidraw-app";

import "./excalidraw-app/pwa";
import "./excalidraw-app/sentry";
window.__EXCALIDRAW_SHA__ = process.env.REACT_APP_GIT_SHA;

ReactDOM.render(<ExcalidrawApp />, document.getElementById("root"));
