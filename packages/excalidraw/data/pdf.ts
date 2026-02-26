export const svgToPdfBlob = async (
  svg: SVGSVGElement,
): Promise<Blob> => {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([
    import("jspdf"),
    import("svg2pdf.js"),
  ]);

  const widthPx = parseFloat(svg.getAttribute("width") || "0");
  const heightPx = parseFloat(svg.getAttribute("height") || "0");

  // Convert px to pt (1px = 0.75pt)
  const widthPt = widthPx * 0.75;
  const heightPt = heightPx * 0.75;

  const orientation = widthPt > heightPt ? "landscape" : "portrait";

  const pdf = new jsPDF({
    orientation,
    unit: "pt",
    format: [widthPt, heightPt],
  });

  await svg2pdf(svg, pdf, {
    x: 0,
    y: 0,
    width: widthPt,
    height: heightPt,
  });

  return pdf.output("blob");
};
