import jsPDF from "jspdf";
import { exportToCanvas } from "@excalidraw/utils"; // same one used for PNG/JPEG
import { getNonDeletedElements } from "@excalidraw/element";
import { DEFAULT_EXPORT_PADDING } from "@excalidraw/common";

/**
 * Exports the current scene as a PDF.
 */
export const exportToPDF = async (
  elements: any[],
  appState: any,
  files: Record<string, any>,
  fileName: string
) => {
  // 1️⃣ Get only valid elements
  const exportElements = getNonDeletedElements(elements);

  // 2️⃣ Render to canvas
  const canvas = await exportToCanvas({
    elements: exportElements,
    appState: {
      ...appState,
      exportBackground: true,
      theme: appState.exportWithDarkMode ? "dark" : "light",
    },
    files,
    exportPadding: DEFAULT_EXPORT_PADDING,
  });

  // 3️⃣ Convert the canvas to image data
  const imgData = canvas.toDataURL("image/png");

  // 4️⃣ Create jsPDF document (portrait or landscape based on canvas)
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? "landscape" : "portrait",
    unit: "px",
    format: [canvas.width, canvas.height],
  });

  pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);

  // 5️⃣ Save to disk
  pdf.save(`${fileName || "excalidraw"}.pdf`);

  return true;
};
