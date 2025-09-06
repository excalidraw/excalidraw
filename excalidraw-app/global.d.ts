import "@excalidraw/excalidraw/global";
import "@excalidraw/excalidraw/css";

interface Window {
  __EXCALIDRAW_SHA__: string | undefined;
  extractPDFDocumentPages?: (data: Uint8Array, scale?: number) => Promise<Array<{ Bytes: Uint8Array; Width: number; Height: number; page: number }>>;
  extractPDFText?: (data: Uint8Array) => Promise<Array<{ page: number; text: string }>>;
}
