import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ExcalidrawApp from "./App";
import { registerSW } from "virtual:pwa-register";

import "../excalidraw-app/sentry";
window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
registerSW();
root.render(
  <StrictMode>
    <ExcalidrawApp
      firebaseConfig={JSON.parse(import.meta.env.VITE_APP_FIREBASE_CONFIG)}
      collabServerUrl={import.meta.env.VITE_APP_WS_SERVER_URL}
      roomLinkData={{
        roomId: "localTestRoomId02",
        roomKey: "yx8WgrzkcceYyZFXAo4_9g", // arbitrary constant key
      }}
      username={"Karat Engineer"}
    />
  </StrictMode>,
);
