import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ExcalidrawApp from "./App";

import "../excalidraw-app/sentry";
window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <ExcalidrawApp />
  </StrictMode>,
);
