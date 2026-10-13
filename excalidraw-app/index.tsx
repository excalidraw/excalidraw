import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import "../excalidraw-app/sentry";

import ExcalidrawApp from "./App";

window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
registerSW({
  onRegisteredSW(_swUrl, registration) {
    if (!registration) {
      return;
    }
    window.addEventListener("vite:preloadError", () => {
      if (navigator.onLine) {
        registration.update().catch((error) => {
          console.warn("Failed to check for service worker update", error);
        });
      }
    });
  },
});
root.render(
  <StrictMode>
    <ExcalidrawApp />
  </StrictMode>,
);
