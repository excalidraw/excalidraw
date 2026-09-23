import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ExcalidrawApp from "./App";
import { registerSW } from "virtual:pwa-register";
import { installDesktopBridge, isDesktop } from "./desktop/bridge";

import "../excalidraw-app/sentry";
window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
installDesktopBridge();
if (!isDesktop()) {
  registerSW();
}
root.render(
  <StrictMode>
    <ExcalidrawApp />
  </StrictMode>,
);
