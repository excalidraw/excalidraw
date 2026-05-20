import { renderSVG } from "uqr";

export const generateQRCodeSVG = (text: string): string => {
  return renderSVG(text);
};
