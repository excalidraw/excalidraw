import * as Sentry from "@sentry/browser";
import * as SentryIntegrations from "@sentry/integrations";
import posthog from "posthog-js";

const apiKey = import.meta.env.VITE_APP_POSTHOG_KEY;
const options = {
  api_host: import.meta.env.VITE_APP_POSTHOG_HOST,
  session_recording: {
    recordCrossOriginIframes: true,
  },
};

const posthogIntegration = [];
if (apiKey || options.api_host) {
  posthog.init(apiKey, options);
  posthogIntegration.push(
    new posthog.SentryIntegration(posthog, "sparkwise", 4506979770171392),
  );
}

const SentryEnvHostnameMap: { [key: string]: string } = {
  "draw-prod.sparkwise.co": "production",
  "draw-next.sparkwise.co": "staging",
};

// Disable Sentry locally or inside the Docker to avoid noise/respect privacy
const onlineEnv = Object.keys(SentryEnvHostnameMap).find(
  (item) => window.location.hostname.indexOf(item) >= 0,
);

Sentry.init({
  dsn: onlineEnv
    ? "https://37fe4be0271ac8f2d1de035c5d32d3c7@o1112051.ingest.us.sentry.io/4506979770171392"
    : undefined,
  environment: onlineEnv ? SentryEnvHostnameMap[onlineEnv] : undefined,
  ignoreErrors: [
    "undefined is not an object (evaluating 'window.__pad.performLoop')", // Only happens on Safari, but spams our servers. Doesn't break anything
  ],
  integrations: [
    new SentryIntegrations.CaptureConsole({
      levels: ["error"],
    }),
    ...posthogIntegration,
  ],
});
