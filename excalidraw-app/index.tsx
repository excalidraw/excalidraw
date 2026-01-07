import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import "../excalidraw-app/sentry";

import ExcalidrawApp from "./App";

window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
// In dev, ensure no Service Worker from previous runs interferes with module loading
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((reg) => reg.unregister()))
    .catch(() => void 0);
}

// Only register PWA Service Worker in production or when explicitly enabled
if (
  import.meta.env.PROD ||
  import.meta.env.VITE_APP_ENABLE_PWA === "true"
) {
  try {
    registerSW();
  } catch {
    // noop
  }
}
root.render(
  <StrictMode>
    <ExcalidrawApp />
  </StrictMode>,
);
