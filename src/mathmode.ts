// Some imports
import { FontFamily, FontString } from "./element/types";
import {
  getFontString,
  getFontFamilyString,
  isRTL,
  measureText,
} from "./utils";
import { ExcalidrawTextElement } from "./element/types";
import { mutateElement } from "./element/mutateElement";

// MathJax components we use
import { AsciiMath } from "mathjax-full/js/input/asciimath.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { liteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { HTMLDocument } from "mathjax-full/js/handlers/html/HTMLDocument.js";

// Types needed to lazy-load MathJax
import { LiteElement } from "mathjax-full/js/adaptors/lite/Element.js";
import { LiteText } from "mathjax-full/js/adaptors/lite/Text.js";
import { LiteDocument } from "mathjax-full/js/adaptors/lite/Document.js";
import { LiteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";

// For caching the SVGs
import { StringMap } from "mathjax-full/js/output/common/Wrapper";

let _useTex = true;

export const setUseTex = (useTex: boolean) => {
  _useTex = useTex;
};

export const getUseTex = (): boolean => {
  return _useTex;
};

const mathJax = {} as {
  adaptor: LiteAdaptor;
  amHtml: HTMLDocument<LiteElement | LiteText, LiteText, LiteDocument>;
  texHtml: HTMLDocument<LiteElement | LiteText, LiteText, LiteDocument>;
};

const loadMathJax = () => {
  if (
    mathJax.adaptor === undefined ||
    mathJax.amHtml === undefined ||
    mathJax.texHtml === undefined
  ) {
    const asciimath = new AsciiMath({ displaystyle: false });
    const tex = new TeX({});
    const svg = new SVG({ fontCache: "local" });
    mathJax.adaptor = liteAdaptor();
    mathJax.amHtml = new HTMLDocument("", mathJax.adaptor, {
      InputJax: asciimath,
      OutputJax: svg,
    });
    mathJax.texHtml = new HTMLDocument("", mathJax.adaptor, {
      InputJax: tex,
      OutputJax: svg,
    });
  }
};

// Cache the SVGs from MathJax
const mathJaxSvgCacheAM = {} as StringMap;
const mathJaxSvgCacheTex = {} as StringMap;

const math2Svg = (text: string, useTex: boolean) => {
  if (useTex ? mathJaxSvgCacheTex[text] : mathJaxSvgCacheAM[text]) {
    return useTex ? mathJaxSvgCacheTex[text] : mathJaxSvgCacheAM[text];
  }
  loadMathJax();
  try {
    const userOptions = { display: false };
    const htmlString = mathJax.adaptor.innerHTML(
      useTex
        ? mathJax.texHtml.convert(text, userOptions)
        : mathJax.amHtml.convert(text, userOptions),
    );
    if (useTex) {
      mathJaxSvgCacheTex[text] = htmlString;
    } else {
      mathJaxSvgCacheAM[text] = htmlString;
    }
    return htmlString;
  } catch {
    return text;
  }
};

export { getFontString } from "./utils";

export const markupText = (text: string, useTex: boolean) => {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let htmlString = "";
  const htmlLines = [];
  const outputs = [] as Array<string>[];
  for (let index = 0; index < lines.length; index++) {
    htmlLines.push("");
    outputs.push([]);
    const lineArray = lines[index].split(useTex ? "$$" : "`");
    for (let i = 0; i < lineArray.length; i++) {
      if (i % 2 === 1) {
        const svgString = math2Svg(lineArray[i], useTex);
        htmlLines[index] += svgString;
        outputs[index].push(svgString);
      } else {
        htmlLines[index] += lineArray[i];
        outputs[index].push(lineArray[i]);
      }
    }
    if (lines[index] === "") {
      htmlLines[index] += `\n`;
    }
    htmlString += `<p style="margin: 0px; white-space: pre; direction: ${
      isRTL(lines[index]) ? "rtl" : "ltr"
    };">${htmlLines[index]}</p>`;
  }
  return { htmlString, htmlLines, outputs };
};

const getCacheKey = (
  text: string,
  fontSize: number,
  fontFamily: FontFamily,
  strokeColor: String,
  textAlign: CanvasTextAlign,
  opacity: Number,
  useTex: boolean,
) => {
  const key = `${text}, ${fontSize}, ${getFontFamilyString({
    fontFamily,
  })}, ${strokeColor}, ${textAlign}, ${opacity}, ${useTex}`;
  return key;
};

const svgCache = {} as { [key: string]: SVGSVGElement };

export const SVG_PADDING = 5;
export const createSvg = (
  text: string,
  fontSize: number,
  fontFamily: FontFamily,
  strokeColor: String,
  textAlign: CanvasTextAlign,
  opacity: Number,
  useTex: boolean,
) => {
  const key = getCacheKey(
    text,
    fontSize,
    fontFamily,
    strokeColor,
    textAlign,
    opacity,
    useTex,
  );

  if (svgCache[key]) {
    return svgCache[key];
  }
  const mathLines = text.replace(/\r\n?/g, "\n").split("\n");
  const markup = markupText(text, useTex);
  const svgRoot = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const node = svgRoot.ownerDocument.createElementNS(
    "http://www.w3.org/2000/svg",
    "g",
  );
  node.setAttribute("font-family", `${getFontFamilyString({ fontFamily })}`);
  node.setAttribute("font-size", `${fontSize}px`);
  node.setAttribute("color", `${strokeColor}`);
  node.setAttribute("stroke-opacity", `${opacity}`);
  node.setAttribute("fill-opacity", `${opacity}`);
  svgRoot.appendChild(node);

  const fontString = getFontString({
    fontSize,
    fontFamily,
  });
  const imageMetrics = measureText(markup.htmlString, fontString, true);
  let y = 0;
  for (let index = 0; index < markup.htmlLines.length; index++) {
    const lineMetrics = measureText(markup.htmlLines[index], fontString, true);
    let x =
      textAlign === "right"
        ? imageMetrics.width - lineMetrics.width
        : textAlign === "center"
        ? (imageMetrics.width - lineMetrics.width) / 2
        : 0;
    y += lineMetrics.height;
    const rtl = isRTL(mathLines[index]);
    for (
      let i = rtl ? markup.outputs[index].length - 1 : 0;
      rtl ? i >= 0 : i < markup.outputs[index].length;
      i += rtl ? -1 : 1
    ) {
      let childNode = {} as SVGSVGElement | SVGTextElement;
      const childIsSvg = i % 2 === 1;
      if (childIsSvg) {
        const tempDiv = svgRoot.ownerDocument.createElement("div");
        tempDiv.innerHTML = markup.outputs[index][i];
        childNode = tempDiv.children[0] as SVGSVGElement;
      } else {
        const text = svgRoot.ownerDocument.createElementNS(
          "http://www.w3.org/2000/svg",
          "text",
        );
        text.setAttribute("style", "white-space: pre;");
        text.setAttribute("fill", `${strokeColor}`);
        text.setAttribute("direction", `${rtl ? "rtl" : "ltr"}`);
        text.setAttribute("text-anchor", `${rtl ? "end" : "start"}`);
        text.textContent = markup.outputs[index][i];
        childNode = text;
      }
      const childMetrics = measureText(
        markup.outputs[index][i],
        fontString,
        childIsSvg,
      );
      childNode.setAttribute("x", `${x}`);
      x += childMetrics.width;
      // For some reason, childMetrics.height might not match the height
      // of the MathJax SVG. So we calculate it directly from the "height"
      // attribute, which is given in "ex" CSS units. If anything goes
      // wrong, fall back to a value of 0 for childHeight.
      let childHeight;
      const tCtx = document.createElement("canvas").getContext("2d");
      if (tCtx !== null && childNode.hasAttribute("height")) {
        tCtx.font = fontString;
        childHeight = childNode.getAttribute("height");
        if (childHeight === null) {
          childHeight = "0";
        }
        childHeight =
          parseFloat(childHeight) *
          (tCtx !== null ? tCtx.measureText("x").actualBoundingBoxAscent : 0);
      } else {
        childHeight = 0;
      }
      // If i % 2 === 0, then childNode is an SVGTextElement, not an SVGSVGElement.
      const svgVerticalOffset = childIsSvg
        ? Math.min(childHeight, childMetrics.baseline)
        : 0;
      const yOffset =
        lineMetrics.height - (lineMetrics.baseline - svgVerticalOffset);
      childNode.setAttribute("y", `${y - yOffset}`);
      node.appendChild(childNode);
    }
  }
  svgRoot.setAttribute("version", "1.1");
  svgRoot.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svgRoot.setAttribute(
    "viewBox",
    `0 0 ${imageMetrics.width + SVG_PADDING} ${imageMetrics.height}`,
  );
  svgRoot.setAttribute("width", `${imageMetrics.width + SVG_PADDING}`);
  svgRoot.setAttribute("height", `${imageMetrics.height}`);
  svgCache[key] = svgRoot;
  return svgRoot;
};

const imageCache = {} as { [key: string]: HTMLImageElement };

export const drawMathOnCanvas = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  fontSize: number,
  fontFamily: FontFamily,
  strokeColor: String,
  textAlign: CanvasTextAlign,
  opacity: Number,
  useTex: boolean,
) => {
  const key = getCacheKey(
    text,
    fontSize,
    fontFamily,
    strokeColor,
    textAlign,
    opacity,
    useTex,
  );
  return new Promise<void>((resolve) => {
    if (imageCache[key] && imageCache[key] !== undefined) {
      context.drawImage(imageCache[key], 0, 0);
      resolve();
    } else {
      const img = new Image();
      const svgString = createSvg(
        text,
        fontSize,
        fontFamily,
        strokeColor,
        textAlign,
        opacity,
        useTex,
      ).outerHTML;
      const svg = new Blob([svgString], {
        type: "image/svg+xml;charset=utf-8",
      });
      const reader = new FileReader();
      reader.addEventListener(
        "load",
        () => {
          img.src = reader.result as string;
          img.onload = function () {
            context.drawImage(img, x, y);
            imageCache[key] = img;
            resolve();
          };
        },
        false,
      );
      reader.readAsDataURL(svg);
    }
  });
};

export const containsMath = (text: string, useTex: boolean) => {
  const delimiter = (useTex ? "\\$\\$" : "`") as string;
  return text.search(delimiter) >= 0;
};

export const isMathMode = (fontString: FontString) => {
  return fontString.search("Helvetica") >= 0;
};

export const measureMath = (
  text: string,
  fontString: FontString,
  useTex: boolean,
) => {
  const markup = markupText(text, useTex);
  const metrics =
    isMathMode(fontString) && containsMath(text, useTex)
      ? measureText(markup.htmlString, fontString, true)
      : measureText(text, fontString, false);
  if (isMathMode(fontString) && containsMath(text, useTex)) {
    return {
      width: metrics.width + SVG_PADDING,
      height: metrics.height,
      baseline: metrics.baseline,
    };
  }
  return metrics;
};

export const toggleUseTex = (element: ExcalidrawTextElement) => {
  mutateElement(element, { useTex: !element.useTex });
};
