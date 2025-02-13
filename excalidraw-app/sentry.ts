import * as Sentry from "@sentry/browser";

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
    /^.+(Failed to fetch|(fetch|loading) dynamically imported module).+$/i, // This is happening when a service worker tries to load an old asset
    "QuotaExceededError: Failed to execute 'setItem' on 'Storage': Setting the value of 'excalidraw' exceeded the quota.", // This should be handled by the user
    "Internal error opening backing store for indexedDB.open", // Private mode and disabled indexedDB
  ],
  integrations: [
    Sentry.captureConsoleIntegration({
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
