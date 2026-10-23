import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import "../excalidraw-app/sentry";

import { NotesApp } from "./notes/NotesApp";

window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
// the macOS app (desktop/) always serves its bundled build, so a service
// worker would only risk serving stale assets after an app update
if (!navigator.userAgent.includes("Electron")) {
  registerSW();
}
root.render(
  <StrictMode>
    <NotesApp />
  </StrictMode>,
);
