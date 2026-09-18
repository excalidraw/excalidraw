import { useEffect, useRef, useState } from "react";

import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import { getDataURL } from "@excalidraw/excalidraw/data/blob";
import { randomId } from "@excalidraw/common";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { BinaryFileData } from "@excalidraw/excalidraw/types";
import type { FileId } from "@excalidraw/element/types";

/** Evento para abrir el picker desde el menú principal. */
export const PDF_IMPORT_EVENT = "excalidraw-clases:import-pdf";

const MAX_PAGES = 30;
const MAX_FILE_MB = 50;
const RENDER_SCALE = 1.5;
const MAX_DISPLAY_WIDTH = 900;
const PAGE_GAP = 40;

function canvasToPngFile(
  canvas: HTMLCanvasElement,
  name: string,
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("No se pudo convertir la página a imagen."));
        return;
      }
      resolve(new File([blob], name, { type: "image/png" }));
    }, "image/png");
  });
}

export const PdfImportDialog: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI;
}> = ({ excalidrawAPI }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const openPicker = () => inputRef.current?.click();
    window.addEventListener(PDF_IMPORT_EVENT, openPicker);
    return () => window.removeEventListener(PDF_IMPORT_EVENT, openPicker);
  }, []);

  const importPdf = async (file: File) => {
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setStatus(
        `El PDF supera ${MAX_FILE_MB} MB. Divídelo e intenta de nuevo.`,
      );
      return;
    }
    try {
      setStatus("Cargando lector PDF…");
      // pdf.js solo se descarga cuando se usa por primera vez
      const pdfjs = await import("pdfjs-dist");
      const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() })
        .promise;
      const totalPages = Math.min(pdf.numPages, MAX_PAGES);
      if (pdf.numPages > MAX_PAGES) {
        setStatus(
          `El PDF tiene ${pdf.numPages} páginas; se importan las primeras ${MAX_PAGES}.`,
        );
      }

      const files: BinaryFileData[] = [];
      const skeletons: Array<{
        type: "image";
        x: number;
        y: number;
        fileId: FileId;
        width: number;
        height: number;
      }> = [];

      // Origen: esquina superior izquierda del viewport actual
      const appState = excalidrawAPI.getAppState();
      let cursorY = -appState.scrollY + 80;
      const originX = -appState.scrollX + 80;

      for (let i = 1; i <= totalPages; i++) {
        setStatus(`Importando página ${i} de ${totalPages}…`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: RENDER_SCALE });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport })
          .promise;

        const pngFile = await canvasToPngFile(canvas, `${file.name}-p${i}.png`);
        const fileId = randomId() as FileId;
        const dataURL = await getDataURL(pngFile);
        files.push({
          mimeType: "image/png",
          id: fileId,
          dataURL,
          created: Date.now(),
        });

        const scaleDown =
          canvas.width > MAX_DISPLAY_WIDTH
            ? MAX_DISPLAY_WIDTH / canvas.width
            : 1;
        const width = Math.round(canvas.width * scaleDown);
        const height = Math.round(canvas.height * scaleDown);
        skeletons.push({
          type: "image",
          fileId,
          x: originX,
          y: cursorY,
          width,
          height,
        });
        cursorY += height + PAGE_GAP;
      }

      const newElements = convertToExcalidrawElements(skeletons);
      excalidrawAPI.addFiles(files);
      excalidrawAPI.updateScene({
        elements: [...excalidrawAPI.getSceneElements(), ...newElements],
        appState: {
          selectedElementIds: Object.fromEntries(
            newElements.map((el) => [el.id, true]),
          ),
        },
      });
      setStatus(
        `PDF importado: ${totalPages} página(s). Ya puedes rayar encima.`,
      );
      setTimeout(() => setStatus(null), 4000);
    } catch (error: any) {
      console.error("Error importando PDF:", error);
      setStatus(`No se pudo importar el PDF: ${error?.message || error}`);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) {
            importPdf(file);
          }
        }}
      />
      {status && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#03045e",
            color: "#fff",
            padding: "10px 18px",
            borderRadius: 10,
            fontSize: 13,
            zIndex: 9999,
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            maxWidth: "90vw",
            textAlign: "center",
          }}
        >
          {status}
        </div>
      )}
    </>
  );
};
