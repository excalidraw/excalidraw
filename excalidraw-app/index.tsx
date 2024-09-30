import { StrictMode, useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import ExcalidrawApp from "./App";
import { registerSW } from "virtual:pwa-register";

import "../excalidraw-app/sentry";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
} from "../packages/excalidraw/types";
import type { ExcalidrawElement } from "../packages/excalidraw/element/types";
import { SyncableExcalidrawElement } from "./data";
window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
registerSW();

function App() {
  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const excalidrawAPIRefCallback = useCallback(
    (value: ExcalidrawImperativeAPI) => setExcalidrawAPI(value),
    [],
  );
  const onCollabRoomSave = useCallback(
    async (
      elements: readonly SyncableExcalidrawElement[],
      appState: AppState,
    ) => {
      console.log("collab room save");
    },
    [],
  );
  return (
    <StrictMode>
      <ExcalidrawApp
        firebaseConfig={JSON.parse(import.meta.env.VITE_APP_FIREBASE_CONFIG)}
        collabServerUrl={import.meta.env.VITE_APP_WS_SERVER_URL}
        roomLinkData={{
          roomId: "localTestRoomId02",
          roomKey: "yx8WgrzkcceYyZFXAo4_9g", // arbitrary constant key
        }}
        username={"Karat Engineer"}
        theme="dark"
        excalidrawAPIRefCallback={excalidrawAPIRefCallback}
        firebaseToken="placeholder"
        onCollabRoomSave={onCollabRoomSave}
      />
    </StrictMode>
  );
}
root.render(<App />);
