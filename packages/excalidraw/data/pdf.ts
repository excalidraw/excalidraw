import { canvasToBlob } from "./blob";

export const exportToPdf = async (canvas: HTMLCanvasElement): Promise<Blob> => {
  const { jsPDF } = await import("jspdf");

  const { width, height } = canvas;
  const orientation = width > height ? "l" : "p";

  const blob = await canvasToBlob(canvas);
  const blobURL = URL.createObjectURL(blob);

  try {
    const pdf = new jsPDF({
      orientation,
      unit: "px",
      format: [width, height],
    });

    pdf.addImage(blobURL, "PNG", 0, 0, width, height);

    return new Blob([pdf.output("blob")], { type: "application/pdf" });
  } finally {
    URL.revokeObjectURL(blobURL);
  }
};
