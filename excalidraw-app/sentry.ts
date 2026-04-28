import { getFeatureFlag } from "@excalidraw/common";
import * as Sentry from "@sentry/browser";
import callsites from "callsites";

const SentryEnvHostnameMap: { [key: string]: string } = {
  "excalidraw.com": "production",
  "staging.excalidraw.com": "staging",
  "vercel.app": "staging",
};

const SENTRY_DISABLED = import.meta.env.VITE_APP_DISABLE_SENTRY === "true";

// Disable Sentry locally or inside the Docker to avoid noise/respect privacy
const onlineEnv =
  !SENTRY_DISABLED &&
  Object.keys(SentryEnvHostnameMap).find(
    (item) => window.location.hostname.indexOf(item) >= 0,
  );

Sentry.init({
  dsn: onlineEnv
    ? "https://7bfc596a5bf945eda6b660d3015a5460@sentry.io/5179260"
    : undefined,
  environment: onlineEnv ? SentryEnvHostnameMap[onlineEnv] : undefined,
  release: import.meta.env.VITE_APP_GIT_SHA,
  ignoreErrors: [
    "undefined is not an object (evaluating 'window.__pad.performLoop')", // Only happens on Safari, but spams our servers. Doesn't break anything
    "InvalidStateError: Failed to execute 'transaction' on 'IDBDatabase': The database connection is closing.", // Not much we can do about the IndexedDB closing error
    /(Failed to fetch|(fetch|loading) dynamically imported module)/i, // This is happening when a service worker tries to load an old asset
    /QuotaExceededError: (The quota has been exceeded|.*setItem.*Storage)/i, // localStorage quota exceeded
    "Internal error opening backing store for indexedDB.open", // Private mode and disabled indexedDB
  ],
  integrations: [
    Sentry.captureConsoleIntegration({
      levels: ["error"],
    }),
    Sentry.featureFlagsIntegration(),
  ],
  beforeSend(event) {
    if (event.request?.url) {
      event.request.url = event.request.url.replace(/#.*$/, "");
    }

    if (!event.exception) {
      event.exception = {
        values: [
          {
            type: "ConsoleError",
            value: event.message ?? "Unknown error",
            stacktrace: {
              frames: callsites()
                .slice(1)
                .filter(
                  (frame) =>
                    frame.getFileName() &&
                    !frame.getFileName()?.includes("@sentry_browser.js"),
                )
                .map((frame) => ({
                  filename: frame.getFileName() ?? undefined,
                  function: frame.getFunctionName() ?? undefined,
                  in_app: !(
                    frame.getFileName()?.includes("node_modules") ?? false
                  ),
                  lineno: frame.getLineNumber() ?? undefined,
                  colno: frame.getColumnNumber() ?? undefined,
                })),
            },
            mechanism: {
              type: "instrument",
              handled: true,
              data: {
                function: "console.error",
                handler: "Sentry.beforeSend",
              },
            },
          },
        ],
      };
    }

    return event;
  },
});

const flagsIntegration =
  Sentry.getClient()?.getIntegrationByName<Sentry.FeatureFlagsIntegration>(
    "FeatureFlags",
  );
if (flagsIntegration) {
  flagsIntegration.addFeatureFlag(
    "COMPLEX_BINDINGS",
    getFeatureFlag("COMPLEX_BINDINGS"),
  );
}
