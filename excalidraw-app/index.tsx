import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import * as ExcalidrawLib from "@excalidraw/excalidraw";

import "../excalidraw-app/sentry";

import ExcalidrawApp from "./App";

window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
registerSW();
// #region agent log
fetch('http://127.0.0.1:7593/ingest/9bf2aae7-3da4-4585-9525-b80866c1ecc1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'bb91c7'},body:JSON.stringify({sessionId:'bb91c7',runId:'pre-fix',hypothesisId:'A',location:'excalidraw-app/index.tsx:boot',message:'App entry reached; checking API hook exports',data:{hasUseAdobeWhiteboardAPI:typeof (ExcalidrawLib as Record<string,unknown>).useAdobeWhiteboardAPI,hasUseExcalidrawAPI:typeof ExcalidrawLib.useExcalidrawAPI,rootExists:!!rootElement},timestamp:Date.now()})}).catch(()=>{});
// #endregion
root.render(
  <StrictMode>
    <ExcalidrawApp />
  </StrictMode>,
);
