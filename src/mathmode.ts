import { FontString } from "./element/types";
import { measureText } from "./utils";
import { AsciiMath } from "mathjax-full/js/input/asciimath.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { HTMLDocument } from "mathjax-full/js/handlers/html/HTMLDocument.js";
import { StringMap } from "mathjax-full/js/output/common/Wrapper";

const asciimath = new AsciiMath({});
const svg = new SVG();
const adaptor = liteAdaptor();
const html = new HTMLDocument("", adaptor, {
  InputJax: asciimath,
  OutputJax: svg,
});

const mathJaxSvgCache = {} as StringMap;

const asciimath2Svg = (text: string) => {
  if (mathJaxSvgCache[text]) {
    return mathJaxSvgCache[text];
  }
  const htmlString = adaptor.innerHTML(html.convert(text));
  mathJaxSvgCache[text] = htmlString;
  return htmlString;
};

export { getFontString } from "./utils";

export const markupText = (text: string) => {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let htmlString = "";
  for (let index = 0; index < lines.length; index++) {
    htmlString += `<p style="margin: 0px;">`;
    const lineArray = lines[index].split("`");
    for (let i = 0; i < lineArray.length; i++) {
      if (i % 2 === 1) {
        htmlString += asciimath2Svg(lineArray[i]);
      } else {
        htmlString += lineArray[i];
      }
    }
    if (lines[index] === "") {
      htmlString += `<span style="display: inline-block; overflow: hidden; width: 1px; height: 1px;"></span>`;
    }
    htmlString += `</p>`;
  }
  return htmlString;
};

export const measureMarkup = (htmlString: string, font: FontString) => {
  const div = document.createElement("div");
  div.style.font = font;
  div.style.position = "absolute";
  div.style.whiteSpace = "pre";
  div.innerHTML = htmlString;
  document.body.appendChild(div);
  const cStyle = window.getComputedStyle(div);
  const width = parseFloat(cStyle.width);
  const height = parseFloat(cStyle.height);
  // Now creating 1px sized item that will be aligned to baseline
  // to calculate baseline shift
  const span = document.createElement("span");
  span.style.display = "inline-block";
  span.style.overflow = "hidden";
  span.style.width = "1px";
  span.style.height = "1px";
  div.appendChild(span);
  // Baseline is important for positioning text on canvas
  const baseline = span.offsetTop + span.offsetHeight;
  document.body.removeChild(div);

  return { width, height, baseline };
};

export const encapsulateHtml = (
  fontSize: Number,
  fontFamily: String,
  textAlign: CanvasTextAlign,
  htmlString: String,
) => {
  const svgString =
    `<foreignObject width="100%" height="100%">` +
    `<div xmlns="http://www.w3.org/1999/xhtml" style="` +
    `text-align: ${textAlign}; ` +
    `font-family: ${fontFamily}; ` +
    `font-size: ${fontSize}px;` +
    `">${htmlString}</div>` +
    `</foreignObject>`;
  return svgString;
};

export const drawHtmlOnCanvas = (
  context: CanvasRenderingContext2D,
  htmlString: String,
  x: number,
  y: number,
  width: Number,
  height: Number,
  fontSize: Number,
  fontFamily: String,
  strokeColor: String,
  textAlign: CanvasTextAlign,
) => {
  const data = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" color="${strokeColor}">${encapsulateHtml(
    fontSize,
    fontFamily,
    textAlign,
    htmlString,
  )}</svg>`;

  const DOMURL = window.URL || window.webkitURL || window;

  const img = new Image();
  const svg = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
  const url = DOMURL.createObjectURL(svg);

  img.onload = function () {
    context.drawImage(img, x, y);
    DOMURL.revokeObjectURL(url);
  };

  img.src = url;
};

export const isMathMode = (fontString: FontString) => {
  return fontString.search("Helvetica") >= 0;
};

export const measureMath = (text: string, fontString: FontString) => {
  const htmlString = markupText(text);
  const metrics = isMathMode(fontString)
    ? measureMarkup(htmlString, fontString)
    : measureText(text, fontString);
  return metrics;
};
