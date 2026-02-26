const PX_TO_MM = 25.4 / 96;

export const svgToPdfBlob = async (
  svg: SVGSVGElement,
): Promise<Blob> => {
  const [{ jsPDF }, svg2pdf] = await Promise.all([
    import("jspdf"),
    import("svg2pdf.js"),
  ]);

  // svg2pdf.js is a side-effect import that patches jsPDF prototype;
  // reference it to prevent tree-shaking
  void svg2pdf;

  const vb = svg.viewBox.baseVal;
  const widthPx = vb.width || svg.width.baseVal.value;
  const heightPx = vb.height || svg.height.baseVal.value;

  const widthMm = widthPx * PX_TO_MM;
  const heightMm = heightPx * PX_TO_MM;

  const doc = new jsPDF({
    orientation: widthMm > heightMm ? "landscape" : "portrait",
    unit: "mm",
    format: [widthMm, heightMm],
    compress: true,
  });

  await doc.svg(svg, {
    x: 0,
    y: 0,
    width: widthMm,
    height: heightMm,
  });

  return doc.output("blob");
};
