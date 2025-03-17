interface Window {
  EXCALIDRAW_EXPORT_SOURCE: string;
}

interface ImportMetaEnv {
  MODE: string;
  DEV: string;
  PROD: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
