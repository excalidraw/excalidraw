import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import "../excalidraw-app/sentry";

import ExcalidrawApp from "./App";

window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;
registerSW();

if (document.documentElement.dataset.shangbanNotFound !== "true") {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <ExcalidrawApp />
    </StrictMode>,
  );
}
