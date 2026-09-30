/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  readonly VITE_APP_LIBRARY_URL: string;
  readonly VITE_APP_LIBRARY_BACKEND: string;
  readonly VITE_APP_AI_BACKEND: string;
}
