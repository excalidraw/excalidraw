import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// PWA registration removed for development

import "./sentry";
import { renderWithAuth } from "./auth-shell";

import ExcalidrawApp from "./App";

window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
renderWithAuth(root, () => (
  <StrictMode>
    <ExcalidrawApp />
  </StrictMode>
));
