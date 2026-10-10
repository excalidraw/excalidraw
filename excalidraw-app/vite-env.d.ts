/// <reference types="vite-plugin-pwa/vanillajs" />
/// <reference types="vite-plugin-pwa/info" />
/// <reference types="vite-plugin-svgr/client" />
interface ImportMetaEnv {
  // The port to run the dev server
  VITE_APP_PORT: string;

  VITE_APP_BACKEND_V2_GET_URL: string;
  VITE_APP_BACKEND_V2_POST_URL: string;

  // collaboration WebSocket server (https: string
  VITE_APP_WS_SERVER_URL: string;

  // set this only if using the collaboration workflow we use on excalidraw.com
  VITE_APP_PORTAL_URL: string;
  VITE_APP_AI_BACKEND: string;

  VITE_APP_FIREBASE_CONFIG: string;

  // whether to disable live reload / HMR. Usuaully what you want to do when
  // debugging Service Workers.
  VITE_APP_DEV_DISABLE_LIVE_RELOAD: string;

  VITE_APP_DISABLE_SENTRY: string;

  // Error reporting DSN. Unset = Sentry is never initialised; there is no
  // built-in default.
  VITE_APP_SENTRY_DSN: string;

  // ── Per-install defaults for Settings ──
  // These seed a FRESH install only; stored settings win once edited.
  VITE_APP_MODEL_BASE_URL: string;
  VITE_APP_MODEL: string;
  VITE_APP_COLLAB_SERVER: string;
  VITE_APP_TICKETS_API: string;
  // The address a room link carries — the host the team reaches.
  VITE_APP_PUBLIC_URL: string;
  // "true" only when the bridge has a model that can see images.
  VITE_APP_VISION_ENABLED: string;

  // Set this flag to false if you want to open the overlay by default
  VITE_APP_COLLAPSE_OVERLAY: string;

  // Enable eslint in dev server
  VITE_APP_ENABLE_ESLINT: string;

  // Enable PWA in dev server
  VITE_APP_ENABLE_PWA: string;

  VITE_APP_PLUS_LP: string;

  VITE_APP_PLUS_APP: string;

  VITE_APP_GIT_SHA: string;

  MODE: string;

  DEV: string;
  PROD: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
