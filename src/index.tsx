import React from "react";
import ReactDOM from "react-dom";
import ExcalidrawApp from "./excalidraw-app";

import { TopErrorBoundary } from "./components/TopErrorBoundary";

import "./excalidraw-app/pwa";
import "./excalidraw-app/sentry";
import CollabWrapper from "./excalidraw-app/collab/CollabWrapper";

window.__EXCALIDRAW_SHA__ = process.env.REACT_APP_GIT_SHA;

const App = () => {
  return (
    <TopErrorBoundary>
      <CollabWrapper>
        <ExcalidrawApp />
      </CollabWrapper>
    </TopErrorBoundary>
  );
};

ReactDOM.render(<App />, document.getElementById("root"));
