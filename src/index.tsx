import React, { useState, useLayoutEffect } from "react";
import ReactDOM from "react-dom";
import * as Sentry from "@sentry/browser";
import * as SentryIntegrations from "@sentry/integrations";

import { EVENT } from "./constants";
import { TopErrorBoundary } from "./components/TopErrorBoundary";
import { InitializeApp } from "./components/InitializeApp";
import { IsMobileProvider } from "./is-mobile";
import App from "./components/App";
import { register as registerServiceWorker } from "./serviceWorker";

import "./css/styles.scss";
import { loadFromBlob } from "./data";

// On Apple mobile devices add the proprietary app icon and splashscreen markup.
// No one should have to do this manually, and eventually this annoyance will
// go away once https://bugs.webkit.org/show_bug.cgi?id=183937 is fixed.
if (
  /\b(iPad|iPhone|iPod)\b/.test(navigator.userAgent) &&
  !matchMedia("(display-mode: standalone)").matches
) {
  import(/* webpackChunkName: "pwacompat" */ "pwacompat");
}

const SentryEnvHostnameMap: { [key: string]: string } = {
  "excalidraw.com": "production",
  "vercel.app": "staging",
};

const REACT_APP_DISABLE_SENTRY =
  process.env.REACT_APP_DISABLE_SENTRY === "true";
const REACT_APP_GIT_SHA = process.env.REACT_APP_GIT_SHA as string;

// Disable Sentry locally or inside the Docker to avoid noise/respect privacy
const onlineEnv =
  !REACT_APP_DISABLE_SENTRY &&
  Object.keys(SentryEnvHostnameMap).find(
    (item) => window.location.hostname.indexOf(item) >= 0,
  );

Sentry.init({
  dsn: onlineEnv
    ? "https://7bfc596a5bf945eda6b660d3015a5460@sentry.io/5179260"
    : undefined,
  environment: onlineEnv ? SentryEnvHostnameMap[onlineEnv] : undefined,
  release: REACT_APP_GIT_SHA,
  ignoreErrors: [
    "undefined is not an object (evaluating 'window.__pad.performLoop')", // Only happens on Safari, but spams our servers. Doesn't break anything
  ],
  integrations: [
    new SentryIntegrations.CaptureConsole({
      levels: ["error"],
    }),
  ],
  beforeSend(event) {
    if (event.request?.url) {
      event.request.url = event.request.url.replace(/#.*$/, "");
    }
    return event;
  },
});

window.__EXCALIDRAW_SHA__ = REACT_APP_GIT_SHA;

// Block pinch-zooming on iOS outside of the content area
document.addEventListener(
  "touchmove",
  (event) => {
    // @ts-ignore
    if (typeof event.scale === "number" && event.scale !== 1) {
      event.preventDefault();
    }
  },
  { passive: false },
);

function ExcalidrawApp() {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  const onResize = () => {
    setDimensions({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  };

  useLayoutEffect(() => {
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);

  const { width, height } = dimensions;
  return (
    <TopErrorBoundary>
      <IsMobileProvider>
        <InitializeApp>
          <App width={width} height={height} />
        </InitializeApp>
      </IsMobileProvider>
    </TopErrorBoundary>
  );
}

const rootElement = document.getElementById("root");

ReactDOM.render(<ExcalidrawApp />, rootElement);

registerServiceWorker({
  onUpdate: (registration) => {
    const waitingServiceWorker = registration.waiting;
    if (waitingServiceWorker) {
      waitingServiceWorker.addEventListener(
        EVENT.STATE_CHANGE,
        (event: Event) => {
          const target = event.target as ServiceWorker;
          const state = target.state as ServiceWorkerState;
          if (state === "activated") {
            window.location.reload();
          }
        },
      );
      waitingServiceWorker.postMessage({ type: "SKIP_WAITING" });
    }
  },
});

if ("launchQueue" in window && "LaunchParams" in window) {
  (window as any).launchQueue.setConsumer(
    async (launchParams: { files: any[] }) => {
      if (!launchParams.files.length) {
        return;
      }
      const fileHandle = launchParams.files[0];
      const blob = await fileHandle.getFile();
      loadFromBlob(blob);
    },
  );
}
