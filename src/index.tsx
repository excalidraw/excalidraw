import React from "react";
import ReactDOM from "react-dom";
import * as Sentry from "@sentry/browser";
import { TopErrorBoundary } from "./components/TopErrorBoundary";
import { IsMobileProvider } from "./is-mobile";
import { App } from "./components/App";
import "./styles.scss";

const SentyProjectsHostnameMap: { [key: string]: string } = {
  "excalidraw.com":
    "https://a678efd811e84fa8811c61efecabbab8@sentry.io/5179065",
  "excalidraw-team.now.sh":
    "https://99a6ce3552444f7094f306de0eeb8c1d@sentry.io/5179196",
};

const onlineEnv = Object.keys(SentyProjectsHostnameMap).find(
  (item) => window.location.hostname.indexOf(item) >= 0,
);

Sentry.init({
  // Disable Sentry locally to avoid noise
  dsn: onlineEnv ? SentyProjectsHostnameMap[onlineEnv] : undefined,
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
