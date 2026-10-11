import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import "../excalidraw-app/sentry";

import ExcalidrawApp from "./App";

window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
/**
 * The service worker is OFF unless this install asks for it.
 *
 * It is a stale-version footgun on a tool that is redeployed by rsync: after a
 * deploy the browser kept serving the OLD bundle from the worker's cache, so the
 * app looked unchanged while the server had the new one — measured, and it cost an
 * afternoon of thinking the build had not landed.
 *
 * An existing worker is therefore UNREGISTERED, not merely left alone, so a
 * browser that cached an earlier build heals on its next visit.
 */
if (import.meta.env.VITE_APP_ENABLE_PWA === "true") {
  registerSW();
} else {
  navigator.serviceWorker?.getRegistrations?.().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}
root.render(
  <StrictMode>
    <ExcalidrawApp />
  </StrictMode>,
);
