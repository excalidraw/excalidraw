import React, { useState, useLayoutEffect, useEffect } from "react";
import ReactDOM from "react-dom";
import * as Sentry from "@sentry/browser";
import * as SentryIntegrations from "@sentry/integrations";

import { EVENT } from "./constants";
import { TopErrorBoundary } from "./components/TopErrorBoundary";
import Excalidraw from "./excalidraw-embed/index";
import { register as registerServiceWorker } from "./serviceWorker";

import { debounce } from "./utils";
import {
  importFromLocalStorage,
  importUsernameFromLocalStorage,
  saveUsernameToLocalStorage,
  saveToLocalStorage,
} from "./data/localStorage";

import { SAVE_TO_LOCAL_STORAGE_TIMEOUT } from "./time_constants";
import { ImportedDataState } from "./data/types";
import { LoadingMessage } from "./components/LoadingMessage";
import { ExcalidrawElement } from "./element/types";
import { AppState } from "./types";

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

const saveDebounced = debounce(
  (elements: readonly ExcalidrawElement[], state: AppState) => {
    saveToLocalStorage(elements, state);
  },
  SAVE_TO_LOCAL_STORAGE_TIMEOUT,
);

const onUsernameChange = (username: string) => {
  saveUsernameToLocalStorage(username);
};

const onBlur = () => {
  saveDebounced.flush();
};

function ExcalidrawApp() {
  // dimensions
  // ---------------------------------------------------------------------------

  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  useLayoutEffect(() => {
    const onResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);

  // initial state
  // ---------------------------------------------------------------------------

  const [initialState, setInitialState] = useState<{
    data: ImportedDataState;
    user: {
      name: string | null;
    };
  } | null>(null);

  useEffect(() => {
    setInitialState({
      data: importFromLocalStorage(),
      user: {
        name: importUsernameFromLocalStorage(),
      },
    });
  }, []);

  // blur/unload
  // ---------------------------------------------------------------------------

  useEffect(() => {
    window.addEventListener(EVENT.UNLOAD, onBlur, false);
    window.addEventListener(EVENT.BLUR, onBlur, false);
    return () => {
      window.removeEventListener(EVENT.UNLOAD, onBlur, false);
      window.removeEventListener(EVENT.BLUR, onBlur, false);
    };
  }, []);

  // ---------------------------------------------------------------------------

  if (!initialState) {
    return <LoadingMessage />;
  }

  return (
    <TopErrorBoundary>
      <Excalidraw
        width={dimensions.width}
        height={dimensions.height}
        onChange={saveDebounced}
        initialData={initialState.data}
        user={initialState.user}
        onUsernameChange={onUsernameChange}
      />
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
