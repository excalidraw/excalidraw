import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import "../excalidraw-app/sentry";

import ExcalidrawApp from "./App";
import { APP_ROUTES } from "./app_routes";

// the entry's JavaScript and CSS loaded and ran (`scripts/stats/perf.mjs`)
performance.mark("excalidraw:app-start");

window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;
const ownerWindow = rootElement.ownerDocument.defaultView!;

if (
  ownerWindow.location.pathname === APP_ROUTES.excalidrawPlusExport &&
  ownerWindow === ownerWindow.top
) {
  ownerWindow.location.replace("/404");
} else {
  const root = createRoot(rootElement);
  registerSW();
  root.render(
    <StrictMode>
      <ExcalidrawApp />
    </StrictMode>,
  );
}
