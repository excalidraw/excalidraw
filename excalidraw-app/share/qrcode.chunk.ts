import qrcode from "qrcode-generator";

export const generateQRCodeSVG = (text: string, size: number): string => {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();

  const cellSize = size / qr.getModuleCount();

  return qr.createSvgTag({ cellSize, margin: 0 });
};
