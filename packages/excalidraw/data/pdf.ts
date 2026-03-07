export const exportToPdf = async (svg: SVGSVGElement): Promise<Blob> => {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([
    import("jspdf"),
    import("svg2pdf.js"),
  ]);

  const viewBox = svg.getAttribute("viewBox");
  let width: number;
  let height: number;

  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    width = parts[2];
    height = parts[3];
  } else {
    width = parseFloat(svg.getAttribute("width") || "210");
    height = parseFloat(svg.getAttribute("height") || "297");
  }

  // jsPDF uses mm by default; use pt (1px = 0.75pt) for pixel-accurate sizing
  const pxToPt = 0.75;
  const widthPt = width * pxToPt;
  const heightPt = height * pxToPt;

  const orientation = widthPt > heightPt ? "landscape" : "portrait";

  const doc = new jsPDF({
    orientation,
    unit: "pt",
    format: [widthPt, heightPt],
  });

  await svg2pdf(svg, doc, {
    x: 0,
    y: 0,
    width: widthPt,
    height: heightPt,
  });

  return doc.output("blob");
};
