/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vanillajs" />
/// <reference types="vite-plugin-pwa/info" />
/// <reference types="vite-plugin-svgr/client" />
interface ImportMetaEnv {
  // The port to run the dev server
  VITE_APP_PORT: string;

  // whether to disable live reload / HMR. Usuaully what you want to do when
  // debugging Service Workers.
  VITE_APP_DEV_DISABLE_LIVE_RELOAD: string;
  // To enable bounding box for text containers
  VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX: string;

  FAST_REFRESH: string;

  // MATOMO
  VITE_APP_MATOMO_URL: string;
  VITE_APP_CDN_MATOMO_TRACKER_URL: string;
  VITE_APP_MATOMO_SITE_ID: string;

  //Debug flags
  // Set this flag to false if you want to open the overlay by default
  VITE_APP_COLLAPSE_OVERLAY: string;
  // Enable eslint in dev server
  VITE_APP_ENABLE_ESLINT: string;
  VITE_APP_ENABLE_TRACKING: string;

  PKG_NAME: string;
  PKG_VERSION: string;

  VITE_WORKER_ID: string;
  MODE: string;
  DEV: string;
  PROD: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
