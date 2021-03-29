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

const markupText = (text: string, useTex: boolean) => {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const outputs = [] as Array<string>[];
  for (let index = 0; index < lines.length; index++) {
    outputs.push([]);
    const lineArray = lines[index].split(useTex ? "$$" : "`");
    for (let i = 0; i < lineArray.length; i++) {
      if (i % 2 === 1) {
        const svgString = math2Svg(lineArray[i], useTex);
        outputs[index].push(svgString);
      } else {
        outputs[index].push(lineArray[i]);
      }
    }
    if (lineArray.length === 0) {
      outputs[index].push("");
    }
  }
  return outputs;
};

const getCacheKey = (
  text: string,
  fontFamily: FontFamily,
  strokeColor: String,
  textAlign: CanvasTextAlign,
  opacity: Number,
  useTex: boolean,
) => {
  const key = `${text}, ${getFontFamilyString({
    fontFamily,
  })}, ${strokeColor}, ${textAlign}, ${opacity}, ${useTex}`;
  return key;
};

const metricsCache = {} as {
  [key: string]: {
    outputMetrics: Array<{ width: number; height: number; baseline: number }>[];
    lineMetrics: Array<{ width: number; height: number; baseline: number }>;
    imageMetrics: { width: number; height: number; baseline: number };
  };
};

const measureOutputs = (outputs: string[][], fontString: FontString) => {
  let key = fontString as string;
  for (let index = 0; index < outputs.length; index++) {
    for (let i = 0; i < outputs[index].length; i++) {
      key += outputs[index][i] === "" ? " " : outputs[index][i];
    }
  }
  const cKey = key;
  if (metricsCache[cKey]) {
    return metricsCache[cKey];
  }
  const tDiv = document.createElement("div");
  const tCtx = document.createElement("canvas").getContext("2d");
  if (tCtx !== null) {
    tCtx.font = fontString;
  }
  const exSize = tCtx ? tCtx.measureText("x").actualBoundingBoxAscent : 1;
  const outputMetrics = [] as Array<{
    width: number;
    height: number;
    baseline: number;
  }>[];
  const lineMetrics = [];
  let imageWidth = 0;
  let imageHeight = 0;
  let imageBaseline = 0;
  for (let index = 0; index < outputs.length; index++) {
    outputMetrics.push([]);
    let lineWidth = 0;
    let lineHeight = 0;
    let lineBaseline = 0;
    for (let i = 0; i < outputs[index].length; i++) {
      if (i % 2 === 1) {
        //svg
        tDiv.innerHTML = outputs[index][i];
        const cNode = tDiv.children[0];
        // For some reason, the width/height/baseline metrics gotten from
        // window.getComputedStyle() might not match the width and height
        // of the MathJax SVG. So we calculate these directly from the SVG
        // attributes, which are given in "ex" CSS units. If anything goes
        // wrong, fall back to a value of 0.
        let cWidth;
        let cHeight;
        let cBaseline;
        if (cNode && cNode.hasAttribute("width")) {
          cWidth = cNode.getAttribute("width");
          if (cWidth === null) {
            cWidth = "0";
          }
          cWidth = parseFloat(cWidth) * exSize;
        } else {
          cWidth = 0;
        }
        if (cNode && cNode.hasAttribute("height")) {
          cHeight = cNode.getAttribute("height");
          if (cHeight === null) {
            cHeight = "0";
          }
          cHeight = parseFloat(cHeight) * exSize;
        } else {
          cHeight = 0;
        }
        if (cNode && cNode.hasAttribute("style")) {
          cBaseline = cNode.getAttribute("style");
          if (cBaseline === null) {
            cBaseline = "vertical-align: 0ex;";
          }
          cBaseline =
            parseFloat(cBaseline.split(":")[1].split(";")[0]) * exSize;
        } else {
          cBaseline = 0;
        }
        outputMetrics[index].push({
          width: cWidth,
          height: cHeight,
          baseline: cHeight + cBaseline,
        });
      } else {
        outputMetrics[index].push(measureText(outputs[index][i], fontString));
      }
      lineWidth +=
        outputs[index][i] === "" && outputs[index].length > 1
          ? 0
          : outputMetrics[index][i].width;
      lineHeight = Math.max(lineHeight, outputMetrics[index][i].height);
      if (lineHeight === outputMetrics[index][i].height) {
        lineBaseline = outputMetrics[index][i].baseline;
      }
    }
    imageWidth = Math.max(imageWidth, lineWidth);
    imageBaseline = imageHeight + lineBaseline;
    imageHeight += lineHeight;
    lineMetrics.push({
      width: lineWidth,
      height: lineHeight,
      baseline: lineBaseline,
    });
  }
  const imageMetrics = {
    width: imageWidth,
    height: imageHeight,
    baseline: imageBaseline,
  };
  metricsCache[cKey] = { outputMetrics, lineMetrics, imageMetrics };
  return metricsCache[cKey];
};

const svgCache = {} as { [key: string]: SVGSVGElement };

// Use a power-of-two font size to generate the SVG.
const fontSizePoT = 128;

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
    fontFamily,
    strokeColor,
    textAlign,
    opacity,
    useTex,
  );

  const mathLines = text.replace(/\r\n?/g, "\n").split("\n");
  const processed = markupText(text, useTex);

  const scale = fontSize / fontSizePoT;
  const fontString = getFontString({
    fontSize: fontSizePoT,
    fontFamily,
  });
  const metrics = measureOutputs(processed, fontString);
  const imageMetrics = metrics.imageMetrics;

  if (svgCache[key]) {
    const svgRoot = svgCache[key];
    svgRoot.setAttribute("width", `${scale * imageMetrics.width}`);
    svgRoot.setAttribute("height", `${scale * imageMetrics.height}`);
    return svgRoot;
  }
  const svgRoot = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const node = svgRoot.ownerDocument.createElementNS(
    "http://www.w3.org/2000/svg",
    "g",
  );
  node.setAttribute("font-family", `${getFontFamilyString({ fontFamily })}`);
  node.setAttribute("font-size", `${fontSizePoT}px`);
  node.setAttribute("color", `${strokeColor}`);
  node.setAttribute("stroke-opacity", `${opacity}`);
  node.setAttribute("fill-opacity", `${opacity}`);
  svgRoot.appendChild(node);

  let y = 0;
  for (let index = 0; index < processed.length; index++) {
    const lineMetrics = metrics.lineMetrics[index];
    let x =
      textAlign === "right"
        ? imageMetrics.width - lineMetrics.width
        : textAlign === "center"
        ? (imageMetrics.width - lineMetrics.width) / 2
        : 0;
    y += lineMetrics.height;
    const rtl = isRTL(mathLines[index]);
    for (
      let i = rtl ? processed[index].length - 1 : 0;
      rtl ? i >= 0 : i < processed[index].length;
      i += rtl ? -1 : 1
    ) {
      let childNode = {} as SVGSVGElement | SVGTextElement;
      // If i % 2 === 0, then childNode is an SVGTextElement, not an SVGSVGElement.
      const childIsSvg = i % 2 === 1;
      if (childIsSvg) {
        const tempDiv = svgRoot.ownerDocument.createElement("div");
        tempDiv.innerHTML = processed[index][i];
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
        text.textContent = processed[index][i];
        childNode = text;
      }
      const childMetrics = metrics.outputMetrics[index][i];
      childNode.setAttribute("x", `${x}`);
      // Don't offset x when we have an empty string.
      x +=
        processed[index][i] === "" && processed[index].length > 0
          ? 0
          : childMetrics.width;
      const svgVerticalOffset = childIsSvg
        ? Math.min(childMetrics.height, childMetrics.baseline)
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
    `0 0 ${imageMetrics.width} ${imageMetrics.height}`,
  );
  svgRoot.setAttribute("width", `${imageMetrics.width}`);
  svgRoot.setAttribute("height", `${imageMetrics.height}`);
  svgCache[key] = svgRoot;
  // Now that we have cached the base SVG, scale it appropriately.
  svgRoot.setAttribute("width", `${scale * imageMetrics.width}`);
  svgRoot.setAttribute("height", `${scale * imageMetrics.height}`);
  return svgRoot;
};

const imageCache = {} as { [key: string]: HTMLImageElement };
const imageMetricsCache = {} as {
  [key: string]: { width: number; height: number; baseline: number };
};

const getRenderDims = (width: number, height: number) => {
  return [width / window.devicePixelRatio, height / window.devicePixelRatio];
};

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
    fontFamily,
    strokeColor,
    textAlign,
    opacity,
    useTex,
  );

  if (!(imageMetricsCache[key] && imageMetricsCache[key] !== undefined)) {
    imageMetricsCache[key] = measureOutputs(
      markupText(text, useTex),
      getFontString({ fontSize: fontSizePoT, fontFamily }),
    ).imageMetrics;
  }
  const imageMetrics = imageMetricsCache[key];
  const scale = fontSize / fontSizePoT;
  const imgKey = `${key}, ${scale * imageMetrics.width}, ${
    scale * imageMetrics.height
  }`;
  return new Promise<void>((resolve) => {
    if (imageCache[imgKey] && imageCache[imgKey] !== undefined) {
      const img = imageCache[imgKey];
      const [width, height] = getRenderDims(
        img.naturalWidth,
        img.naturalHeight,
      );
      context.drawImage(img, 0, 0, width, height);
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
            const [width, height] = getRenderDims(
              img.naturalWidth,
              img.naturalHeight,
            );
            context.drawImage(img, 0, 0, width, height);
            imageCache[imgKey] = img;
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
  fontSize: number,
  fontFamily: FontFamily,
  useTex: boolean,
) => {
  const scale = fontSize / fontSizePoT;
  const fontStringPoT = getFontString({
    fontSize: fontSizePoT,
    fontFamily,
  });
  const fontString = getFontString({ fontSize, fontFamily });
  const metrics =
    isMathMode(fontStringPoT) && containsMath(text, useTex)
      ? measureOutputs(markupText(text, useTex), fontStringPoT).imageMetrics
      : measureText(text, fontString);
  if (isMathMode(fontStringPoT) && containsMath(text, useTex)) {
    return {
      width: metrics.width * scale,
      height: metrics.height * scale,
      baseline: metrics.baseline * scale,
    };
  }
  return metrics;
};

export const toggleUseTex = (element: ExcalidrawTextElement) => {
  mutateElement(element, { useTex: !element.useTex });
};
