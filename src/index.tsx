import React from "react";
import ReactDOM from "react-dom";
import * as Sentry from "@sentry/browser";
import { TopErrorBoundary } from "./components/TopErrorBoundary";
import { IsMobileProvider } from "./is-mobile";
import { App } from "./components/App";
import "./styles.scss";

const SentyEnvHostnameMap: { [key: string]: string } = {
  "excalidraw.com": "production",
  "now.sh": "staging",
};

const onlineEnv = Object.keys(SentyEnvHostnameMap).find(
  (item) => window.location.hostname.indexOf(item) >= 0,
);

Sentry.init({
  // Disable Sentry locally to avoid noise
  dsn: onlineEnv
    ? "https://7bfc596a5bf945eda6b660d3015a5460@sentry.io/5179260"
    : undefined,
  environment: onlineEnv ? SentyEnvHostnameMap[onlineEnv] : undefined,
  release: process.env.REACT_APP_GIT_SHA,
});

// Block pinch-zooming on iOS outside of the content area
document.addEventListener(
  "touchmove",
  function (event) {
    // @ts-ignore
    if (event.scale !== 1) {
      event.preventDefault();
    }
  },
  { passive: false },
);

const rootElement = document.getElementById("root");

ReactDOM.render(
  <TopErrorBoundary>
    <IsMobileProvider>
      <App />
    </IsMobileProvider>
  </TopErrorBoundary>,
  rootElement,
);
