export {};

declare global {
  interface Window {
    pdfjsLib?: {
      getDocument: (params: unknown) => { promise: Promise<any> };
      PDFWorker: new () => unknown;
    };
    __EXCALIDRAW_LLM_SERVICE_URL?: string;

    extractPDFDocumentPages?: (
      data: Uint8Array,
      scale?: number
    ) => Promise<Array<{ Bytes: Uint8Array; Width: number; Height: number; page: number }>>;

    extractPDFText?: (
      data: Uint8Array
    ) => Promise<Array<{ page: number; text: string }>>;
  }
}


