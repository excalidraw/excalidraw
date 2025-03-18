interface ImportMetaEnv {
  MODE: string;
  DEV: string;
  PROD: string;

  // To enable bounding box for text containers
  VITE_APP_DEBUG_ENABLE_TEXT_CONTAINER_BOUNDING_BOX: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
