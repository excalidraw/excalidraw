import "@excalidraw/excalidraw/global";
import "@excalidraw/excalidraw/css";

interface Window {
  __EXCALIDRAW_SHA__: string | undefined;
  EXCALIDRAW_ASSET_PATH: string | readonly string[];
  EXCALIDRAW_ENV?: Record<string, string | undefined>;
}
