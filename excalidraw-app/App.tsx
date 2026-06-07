import { isTestEnv } from "@excalidraw/common";
import React, { Suspense, lazy } from "react";

import { LandingPage } from "./components/landing/LandingPage";

const loadEditorApp = () => import("./EditorApp");

const ExcalidrawPlusIframeExport = lazy(() =>
  import("./ExcalidrawPlusIframeExport").then((module) => ({
    default: module.ExcalidrawPlusIframeExport,
  })),
);
const EditorApp = lazy(loadEditorApp);
const LandingEditorCanvas = lazy(() =>
  loadEditorApp().then((module) => ({
    default: module.LandingEditorCanvas,
  })),
);

const EditorLoadingFallback = () => (
  <div className="lp-canvas-shell__placeholder" aria-hidden="true">
    <div className="lp-canvas-shell__skeleton" />
    <p>Loading editor…</p>
  </div>
);

const isLandingPreview = () => {
  const landing = new URLSearchParams(window.location.search).get("landing");
  return landing === "1" || landing === "true";
};

const ExcalidrawApp = () => {
  const isCloudExportWindow =
    window.location.pathname === "/excalidraw-plus-export";
  if (isCloudExportWindow) {
    return (
      <Suspense fallback={null}>
        <ExcalidrawPlusIframeExport />
      </Suspense>
    );
  }

  if ((import.meta.env.DEV || isTestEnv()) && !isLandingPreview()) {
    return (
      <Suspense fallback={<EditorLoadingFallback />}>
        <EditorApp />
      </Suspense>
    );
  }

  const pathname = window.location.pathname;
  if (pathname === "/demo" || pathname === "/demo/") {
    return (
      <Suspense fallback={<EditorLoadingFallback />}>
        <EditorApp />
      </Suspense>
    );
  }

  return (
    <LandingPage
      renderCanvas={(onReady) => (
        <Suspense fallback={<EditorLoadingFallback />}>
          <LandingEditorCanvas onFrontendSceneReady={onReady} />
        </Suspense>
      )}
    />
  );
};

export default ExcalidrawApp;
