// Some imports
import { FontString } from "../../element/types";
import { BOUND_TEXT_PADDING, FONT_FAMILY, SVG_NS } from "../../constants";
import {
  getFontString,
  getFontFamilyString,
  getShortcutKey,
  isRTL,
} from "../../utils";
import {
  getApproxLineHeight,
  getBoundTextElement,
  getContainerElement,
  getTextWidth,
  measureText,
  wrapText,
} from "../../element/textElement";
import { hasBoundTextElement, isTextElement } from "../../element/typeChecks";
import {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeleted,
} from "../../element/types";
import {
  ElementUpdate,
  mutateElement,
  newElementWith,
} from "../../element/mutateElement";
import {
  addTextLikeActions,
  registerTextLikeDisabledPanelComponents,
  registerTextLikeMethod,
  registerTextLikeShortcutNames,
  registerTextLikeSubtypeName,
} from "../";
import { registerAuxLangData } from "../../i18n";

// Imports for actions
import { t } from "../../i18n";
import { Action } from "../../actions/types";
import { AppState } from "../../types";
import { getFormValue } from "../../actions/actionProperties";
import { getSelectedElements } from "../../scene";
import { getNonDeletedElements, redrawTextBoundingBox } from "../../element";
import { invalidateShapeForElement } from "../../renderer/renderElement";
import { ButtonSelect } from "../../components/ButtonSelect";

import {
  isTextShortcutNameMath,
  TextOptsMath,
  TextShortcutNameMath,
  TEXT_SUBTYPE_MATH,
} from "./types";

const FONT_FAMILY_MATH = FONT_FAMILY.Helvetica;

// Begin exports
type ExcalidrawTextElementMath = ExcalidrawTextElement &
  Readonly<{
    subtype: typeof TEXT_SUBTYPE_MATH;
    useTex: boolean;
    mathOnly: boolean;
  }>;

type MathOpts = {
  useTex: boolean;
  mathOnly: boolean;
};

const isMathElement = (
  element: ExcalidrawElement | null,
): element is ExcalidrawTextElementMath => {
  return (
    isTextElement(element) &&
    "subtype" in element &&
    element.subtype === TEXT_SUBTYPE_MATH
  );
};

const textShortcutMap: Record<TextShortcutNameMath, string[]> = {
  changeUseTex: [getShortcutKey("CtrlOrCmd+Shift+M")],
  changeMathOnly: [getShortcutKey("CtrlOrCmd+Shift+O")],
};

class GetMathOpts {
  private useTex: boolean = true;
  private mathOnly: boolean = false;
  getUseTex = (appState: AppState): boolean => {
    const textOptsMath = appState.textOpts as TextOptsMath;
    if (textOptsMath !== undefined) {
      this.useTex =
        textOptsMath.useTex !== undefined ? textOptsMath.useTex : true;
    }
    return this.useTex;
  };

  getMathOnly = (appState: AppState): boolean => {
    const textOptsMath = appState.textOpts as TextOptsMath;
    if (textOptsMath !== undefined) {
      this.mathOnly =
        textOptsMath.mathOnly !== undefined ? textOptsMath.mathOnly : false;
    }
    return this.mathOnly;
  };

  ensureMathOpts = (useTex: boolean, mathOnly: boolean): MathOpts => {
    const mathOpts: MathOpts = {
      useTex: useTex !== undefined ? useTex : this.useTex,
      mathOnly: mathOnly !== undefined ? mathOnly : this.mathOnly,
    };
    return mathOpts;
  };
}
const getMathOpts = new GetMathOpts();

const getDelimiter = (useTex: boolean): string => {
  return useTex ? "$$" : "`";
};

const mathJax = {} as {
  adaptor: any;
  amHtml: any;
  texHtml: any;
};

let mathJaxLoaded = false;
let mathJaxLoading = false;
let mathJaxLoadedCallback:
  | ((isTextElementSubtype: Function) => void)
  | undefined;

let errorSvg: string;

const loadMathJax = async () => {
  if (
    !mathJaxLoaded &&
    !mathJaxLoading &&
    (mathJax.adaptor === undefined ||
      mathJax.amHtml === undefined ||
      mathJax.texHtml === undefined)
  ) {
    mathJaxLoading = true;

    // MathJax components we use
    const AsciiMath = await import("mathjax-full/js/input/asciimath.js");
    const TeX = await import("mathjax-full/js/input/tex.js");
    const SVG = await import("mathjax-full/js/output/svg.js");
    const liteAdaptor = await import("mathjax-full/js/adaptors/liteAdaptor.js");
    const HTMLDocument = await import(
      "mathjax-full/js/handlers/html/HTMLDocument.js"
    );

    // Import some TeX packages
    await import("mathjax-full/js/input/tex/ams/AmsConfiguration");
    await import(
      "mathjax-full/js/input/tex/boldsymbol/BoldsymbolConfiguration"
    );

    // Set the following to "true" to import the "mhchem" and "physics" packages.
    const includeMhchemPhysics = false;
    if (includeMhchemPhysics) {
      await import("mathjax-full/js/input/tex/mhchem/MhchemConfiguration");
      await import("mathjax-full/js/input/tex/physics/PhysicsConfiguration");
    }
    const texPackages = includeMhchemPhysics
      ? ["base", "ams", "boldsymbol", "mhchem", "physics"]
      : ["base", "ams", "boldsymbol"];

    // Types needed to lazy-load MathJax
    const LiteElement = (
      await import("mathjax-full/js/adaptors/lite/Element.js")
    ).LiteElement;
    const LiteText = (await import("mathjax-full/js/adaptors/lite/Text.js"))
      .LiteText;
    const LiteDocument = (
      await import("mathjax-full/js/adaptors/lite/Document.js")
    ).LiteDocument;

    // Now set up MathJax
    const asciimath = new AsciiMath.AsciiMath<
      typeof LiteElement | typeof LiteText,
      typeof LiteText,
      typeof LiteDocument
    >({ displaystyle: false });
    const tex = new TeX.TeX({ packages: texPackages });
    const svg = new SVG.SVG({ fontCache: "local" });
    mathJax.adaptor = liteAdaptor.liteAdaptor();
    mathJax.amHtml = new HTMLDocument.HTMLDocument("", mathJax.adaptor, {
      InputJax: asciimath,
      OutputJax: svg,
    });
    mathJax.texHtml = new HTMLDocument.HTMLDocument("", mathJax.adaptor, {
      InputJax: tex,
      OutputJax: svg,
    });
    mathJaxLoaded = true;
    errorSvg = mathJax.adaptor.outerHTML(
      mathJax.texHtml.convert("ERR", { display: false }),
    );
    if (mathJaxLoadedCallback !== undefined) {
      mathJaxLoadedCallback(isMathElement);
    }
  }
};

// This lets math input run across multiple newlines.
// Basically, replace with a space each newline between the delimiters.
// Do so unless it's AsciiMath in math-only mode.
const consumeMathNewlines = (text: string, mathOpts: MathOpts) => {
  const delimiter = getDelimiter(mathOpts.useTex);
  const tempText = mathOpts.mathOnly
    ? [text]
    : text.replace(/\r\n?/g, "\n").split(delimiter);
  if (mathOpts.useTex || !mathOpts.mathOnly) {
    for (let i = 0; i < tempText.length; i++) {
      if (i % 2 === 1 || mathOpts.mathOnly) {
        tempText[i] = tempText[i].replace(/\n/g, " ");
      }
    }
  }
  return tempText.join(delimiter);
};

// Cache the SVGs from MathJax
const mathJaxSvgCacheAM = {} as { [key: string]: string };
const mathJaxSvgCacheTex = {} as { [key: string]: string };

const math2Svg = (
  text: string,
  mathOpts: MathOpts,
  isMathJaxLoaded: boolean,
) => {
  const useTex = mathOpts.useTex;
  if (
    isMathJaxLoaded &&
    (useTex ? mathJaxSvgCacheTex[text] : mathJaxSvgCacheAM[text])
  ) {
    return useTex ? mathJaxSvgCacheTex[text] : mathJaxSvgCacheAM[text];
  }
  loadMathJax();
  try {
    const userOptions = { display: mathOpts.mathOnly };
    const htmlString = isMathJaxLoaded
      ? mathJax.adaptor.outerHTML(
          useTex
            ? mathJax.texHtml.convert(text, userOptions)
            : mathJax.amHtml.convert(text, userOptions),
        )
      : text;
    if (isMathJaxLoaded) {
      if (useTex) {
        mathJaxSvgCacheTex[text] = htmlString;
      } else {
        mathJaxSvgCacheAM[text] = htmlString;
      }
    }
    return htmlString;
  } catch {
    if (isMathJaxLoaded) {
      return errorSvg;
    }
    return text;
  }
};

const markupText = (
  text: string,
  mathOpts: MathOpts,
  isMathJaxLoaded: boolean,
) => {
  const lines = consumeMathNewlines(text, mathOpts).split("\n");
  const outputs = [] as Array<string>[];
  for (let index = 0; index < lines.length; index++) {
    outputs.push([]);
    if (!isMathJaxLoaded) {
      // Run lines[index] through math2Svg so loadMathJax() gets called
      outputs[index].push(math2Svg(lines[index], mathOpts, isMathJaxLoaded));
      continue;
    }
    // Don't split by the delimiter in math-only mode
    const lineArray = mathOpts.mathOnly
      ? [lines[index]]
      : lines[index].split(getDelimiter(mathOpts.useTex));
    for (let i = 0; i < lineArray.length; i++) {
      // Don't guard the following as "isMathJaxLoaded && i % 2 === 1"
      // in order to ensure math2Svg() actually gets called, and thus
      // loadMathJax().
      if (i % 2 === 1 || mathOpts.mathOnly) {
        const svgString = math2Svg(lineArray[i], mathOpts, isMathJaxLoaded);
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
  fontSize: number,
  strokeColor: String,
  textAlign: CanvasTextAlign,
  opacity: Number,
  mathOpts: MathOpts,
) => {
  const key = `${text}, ${fontSize}, ${strokeColor}, ${textAlign}, ${opacity}, ${mathOpts.useTex}, ${mathOpts.mathOnly}`;
  return key;
};

const metricsCache = {} as {
  [key: string]: {
    outputMetrics: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>[];
    lineMetrics: Array<{ width: number; height: number; baseline: number }>;
    imageMetrics: { width: number; height: number; baseline: number };
  };
};

const measureHTML = (
  text: string,
  font: FontString,
  mathOpts: MathOpts,
  isMathJaxLoaded: boolean,
  maxWidth?: number | null,
) => {
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.whiteSpace = "pre";
  container.style.font = font;
  container.style.minHeight = "1em";

  if (maxWidth) {
    const lineHeight = getApproxLineHeight(font);
    container.style.width = `${String(maxWidth)}px`;
    container.style.maxWidth = `${String(maxWidth)}px`;
    container.style.overflow = "hidden";
    container.style.wordBreak = "break-word";
    container.style.lineHeight = `${String(lineHeight)}px`;
    container.style.whiteSpace = "pre-wrap";
  }
  document.body.appendChild(container);

  container.innerHTML = text;
  const width = container.offsetWidth;
  const height = container.offsetHeight;

  // Now creating 1px sized item that will be aligned to baseline
  // to calculate baseline shift
  const span = document.createElement("span");
  span.style.display = "inline-block";
  span.style.overflow = "hidden";
  span.style.width = "1px";
  span.style.height = "1px";
  container.appendChild(span);
  // Baseline is important for positioning text on canvas
  const baseline = span.offsetTop + span.offsetHeight;

  const containerRect = container.getBoundingClientRect();
  // Compute for each SVG or Text child node of line (the last
  // child is the span element for the baseline).
  const childMetrics = [];
  let nextX = 0;
  for (let i = 0; i < container.childNodes.length - 1; i++) {
    // The mjx-container has child nodes, while Text nodes do not
    const childIsSvg =
      isMathJaxLoaded &&
      (container.childNodes[i].hasChildNodes() || mathOpts.mathOnly);
    // The mjx-container element or the Text node
    const child = container.childNodes[i] as HTMLElement | Text;
    if (isMathJaxLoaded && (mathOpts.mathOnly || childIsSvg)) {
      // The svg element
      const grandchild = (child as HTMLElement).firstChild as HTMLElement;
      const grandchildRect = grandchild.getBoundingClientRect();
      childMetrics.push({
        x: grandchildRect.x - containerRect.x,
        y: grandchildRect.y - containerRect.y,
        width: grandchildRect.width,
        height: grandchildRect.height,
      });
      // Set the x value for the next Text node
      nextX = grandchildRect.x + grandchildRect.width - containerRect.x;
    } else {
      // The Text node
      const grandchild = child as Text;
      const text = grandchild.textContent ?? "";
      if (text !== "") {
        const textMetrics = measureText(text, font, maxWidth);
        childMetrics.push({
          x: nextX,
          y: baseline,
          width: textMetrics.width,
          height: textMetrics.height,
        });
      }
    }
  }
  if (childMetrics.length === 0) {
    // Avoid crashes in measureOutputs()
    childMetrics.push({ x: 0, y: 0, width: 0, height: 0 });
  }
  document.body.removeChild(container);
  return { width, height, baseline, childMetrics };
};

const measureOutputs = (
  outputs: string[][],
  fontString: FontString,
  mathOpts: MathOpts,
  isMathJaxLoaded: boolean,
  maxWidth?: number | null,
) => {
  let key = fontString as string;
  for (let index = 0; index < outputs.length; index++) {
    for (let i = 0; i < outputs[index].length; i++) {
      key += outputs[index][i];
    }
    if (index < outputs.length - 1) {
      key += "\n";
    }
  }
  const cKey = key;
  if (isMathJaxLoaded && metricsCache[cKey]) {
    return metricsCache[cKey];
  }
  const outputMetrics = [] as Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>[];
  const lineMetrics = [] as Array<{
    width: number;
    height: number;
    baseline: number;
  }>;
  let imageWidth = 0;
  let imageHeight = 0;
  let imageBaseline = 0;
  for (let index = 0; index < outputs.length; index++) {
    let html = "";
    for (let i = 0; i < outputs[index].length; i++) {
      html += outputs[index][i];
    }
    if (html === "") {
      html += "\n";
    }

    // Use the browser's measurements by temporarily attaching
    // the rendered line to the document.body.
    const {
      width: lineWidth,
      height: lineHeight,
      baseline: lineBaseline,
      childMetrics: lineChildMetrics,
    } = measureHTML(html, fontString, mathOpts, isMathJaxLoaded, maxWidth);

    outputMetrics.push(lineChildMetrics);
    lineMetrics.push({
      width: lineWidth,
      height: lineHeight,
      baseline: lineBaseline,
    });
    imageWidth = Math.max(imageWidth, lineWidth);
    imageBaseline = imageHeight + lineBaseline;
    imageHeight += lineHeight;
  }
  const imageMetrics = {
    width: imageWidth,
    height: imageHeight,
    baseline: imageBaseline,
  };
  const metrics = { outputMetrics, lineMetrics, imageMetrics };
  if (isMathJaxLoaded) {
    metricsCache[cKey] = metrics;
    return metricsCache[cKey];
  }
  return metrics;
};

const svgCache = {} as { [key: string]: SVGSVGElement };

const createSvg = (
  text: string,
  fontSize: number,
  strokeColor: String,
  textAlign: CanvasTextAlign,
  opacity: Number,
  mathOpts: MathOpts,
  isMathJaxLoaded: boolean,
) => {
  const key = getCacheKey(
    text,
    fontSize,
    strokeColor,
    textAlign,
    opacity,
    mathOpts,
  );

  const mathLines = consumeMathNewlines(text, mathOpts).split("\n");
  const processed = markupText(text, mathOpts, isMathJaxLoaded);

  const fontFamily = FONT_FAMILY_MATH;
  const fontString = getFontString({ fontSize, fontFamily });
  const metrics = measureOutputs(
    processed,
    fontString,
    mathOpts,
    isMathJaxLoaded,
  );
  const imageMetrics = metrics.imageMetrics;

  if (isMathJaxLoaded && svgCache[key]) {
    const svgRoot = svgCache[key];
    svgRoot.setAttribute("width", `${imageMetrics.width}`);
    svgRoot.setAttribute("height", `${imageMetrics.height}`);
    return svgRoot;
  }
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

  let y = 0;
  for (let index = 0; index < processed.length; index++) {
    const lineMetrics = metrics.lineMetrics[index];
    const x =
      textAlign === "right"
        ? imageMetrics.width - lineMetrics.width
        : textAlign === "center"
        ? (imageMetrics.width - lineMetrics.width) / 2
        : 0;
    const rtl = isRTL(mathLines[index]);
    // Drop any empty strings from this line to match childMetrics
    const content = processed[index].filter((value) => value !== "");
    for (
      let i = rtl ? content.length - 1 : 0;
      rtl ? i >= 0 : i < content.length;
      i += rtl ? -1 : 1
    ) {
      let childNode = {} as SVGSVGElement | SVGTextElement;
      // Put the content in a div to check whether it is SVG or Text
      const container = svgRoot.ownerDocument.createElement("div");
      container.innerHTML = content[mathOpts.mathOnly ? 0 : i];
      // The mjx-container has child nodes, while Text nodes do not
      const childIsSvg =
        isMathJaxLoaded &&
        (container.childNodes[0].hasChildNodes() || mathOpts.mathOnly);
      if (childIsSvg && content[i] !== "") {
        childNode = container.children[0].children[0] as SVGSVGElement;
      } else {
        const text = svgRoot.ownerDocument.createElementNS(
          "http://www.w3.org/2000/svg",
          "text",
        );
        text.setAttribute("style", "white-space: pre;");
        text.setAttribute("fill", `${strokeColor}`);
        text.setAttribute("direction", `${rtl ? "rtl" : "ltr"}`);
        text.setAttribute("text-anchor", `${rtl ? "end" : "start"}`);
        text.textContent = content[i];
        childNode = text;
      }
      // Don't offset x when we have an empty string.
      const childX =
        content.length > 0 && content[i] === ""
          ? 0
          : metrics.outputMetrics[index][i].x;
      childNode.setAttribute("x", `${x + childX}`);
      // Don't offset y when we have an empty string.
      const childY =
        content.length > 0 && content[i] === ""
          ? 0
          : metrics.outputMetrics[index][i].y;
      childNode.setAttribute("y", `${y + childY}`);
      node.appendChild(childNode);
    }
    y += lineMetrics.height;
  }
  svgRoot.setAttribute("version", "1.1");
  svgRoot.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svgRoot.setAttribute(
    "viewBox",
    `0 0 ${imageMetrics.width} ${imageMetrics.height}`,
  );
  svgRoot.setAttribute("width", `${imageMetrics.width}`);
  svgRoot.setAttribute("height", `${imageMetrics.height}`);
  if (isMathJaxLoaded) {
    svgCache[key] = svgRoot;
  }
  // Now that we have cached the base SVG, scale it appropriately.
  svgRoot.setAttribute("width", `${imageMetrics.width}`);
  svgRoot.setAttribute("height", `${imageMetrics.height}`);
  return svgRoot;
};

const imageCache = {} as { [key: string]: HTMLImageElement };
const imageMetricsCache = {} as {
  [key: string]: { width: number; height: number; baseline: number };
};

const getRenderDims = (width: number, height: number) => {
  return [width / window.devicePixelRatio, height / window.devicePixelRatio];
};

const measureMath = (
  text: string,
  fontSize: number,
  mathOpts: MathOpts,
  isMathJaxLoaded: boolean,
  maxWidth?: number | null,
) => {
  return measureOutputs(
    markupText(text, mathOpts, isMathJaxLoaded),
    getFontString({ fontSize, fontFamily: FONT_FAMILY_MATH }),
    mathOpts,
    isMathJaxLoaded,
    maxWidth,
  ).imageMetrics;
};

const getSelectedMathElements = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
): NonDeleted<ExcalidrawTextElementMath>[] => {
  const selectedElements = getSelectedElements(
    getNonDeletedElements(elements),
    appState,
  );
  if (appState.editingElement) {
    selectedElements.push(appState.editingElement);
  }
  const eligibleElements = selectedElements.filter(
    (element, index, eligibleElements) =>
      isMathElement(element) ||
      (hasBoundTextElement(element) &&
        isMathElement(getBoundTextElement(element))),
  ) as NonDeleted<ExcalidrawTextElementMath>[];
  return eligibleElements;
};

const applyTextElementMathOpts = (
  element: NonDeleted<ExcalidrawTextElementMath>,
  textOpts?: TextOptsMath,
): NonDeleted<ExcalidrawTextElement> => {
  const useTex = textOpts?.useTex !== undefined ? textOpts.useTex : true;
  const mathOnly = textOpts?.mathOnly !== undefined ? textOpts.mathOnly : false;
  return newElementWith(element, {
    useTex,
    mathOnly,
    fontFamily: FONT_FAMILY_MATH,
  });
};

const cleanTextOptUpdatesMath = (
  opts: ElementUpdate<ExcalidrawTextElementMath>,
): ElementUpdate<ExcalidrawTextElementMath> => {
  const newOpts = {};
  for (const key in opts) {
    const value = key === "fontFamily" ? FONT_FAMILY_MATH : (opts as any)[key];
    (newOpts as any)[key] =
      key === "useTex"
        ? value !== undefined
          ? value
          : true
        : key === "mathOnly"
        ? value !== undefined
          ? value
          : false
        : value;
  }
  return newOpts;
};

const measureTextElementMath = (
  element: Omit<
    ExcalidrawTextElementMath,
    | "id"
    | "isDeleted"
    | "type"
    | "baseline"
    | "width"
    | "height"
    | "angle"
    | "seed"
    | "version"
    | "versionNonce"
    | "groupIds"
    | "boundElements"
    | "containerId"
    | "originalText"
    | "updated"
    | "link"
  >,
  next?: {
    fontSize?: number;
    text?: string;
    textOpts?: TextOptsMath;
  },
  maxWidth?: number | null,
) => {
  const isMathJaxLoaded = mathJaxLoaded;
  const fontSize =
    next?.fontSize !== undefined ? next.fontSize : element.fontSize;
  const text = next?.text !== undefined ? next.text : element.text;
  const useTex =
    next?.textOpts !== undefined && next.textOpts.useTex !== undefined
      ? next.textOpts.useTex
      : element.useTex;
  const mathOnly =
    next?.textOpts !== undefined && next.textOpts.mathOnly !== undefined
      ? next.textOpts.mathOnly
      : element.mathOnly;
  const mathOpts = getMathOpts.ensureMathOpts(useTex, mathOnly);
  return measureMath(text, fontSize, mathOpts, isMathJaxLoaded, maxWidth);
};

const renderTextElementMath = (
  element: NonDeleted<ExcalidrawTextElementMath>,
  context: CanvasRenderingContext2D,
  refresh?: () => void,
) => {
  const isMathJaxLoaded = mathJaxLoaded;

  const text = element.text;
  const fontSize = element.fontSize * window.devicePixelRatio;
  const fontFamily = FONT_FAMILY_MATH;
  const strokeColor = element.strokeColor;
  const textAlign = element.textAlign;
  const opacity = context.globalAlpha;
  const useTex = element.useTex;
  const mathOnly = element.mathOnly;
  const mathOpts = getMathOpts.ensureMathOpts(useTex, mathOnly);

  const key = getCacheKey(
    text,
    fontSize,
    strokeColor,
    textAlign,
    opacity,
    mathOpts,
  );

  if (
    isMathJaxLoaded &&
    imageMetricsCache[key] &&
    imageMetricsCache[key] === undefined
  ) {
    imageMetricsCache[key] = measureOutputs(
      markupText(text, mathOpts, isMathJaxLoaded),
      getFontString({ fontSize, fontFamily }),
      mathOpts,
      isMathJaxLoaded,
    ).imageMetrics;
  }
  const imageMetrics =
    isMathJaxLoaded &&
    imageMetricsCache[key] &&
    imageMetricsCache[key] !== undefined
      ? imageMetricsCache[key]
      : measureOutputs(
          markupText(text, mathOpts, isMathJaxLoaded),
          getFontString({ fontSize, fontFamily }),
          mathOpts,
          isMathJaxLoaded,
        ).imageMetrics;
  const imgKey = `${key}, ${imageMetrics.width}, ${imageMetrics.height}`;
  if (
    isMathJaxLoaded &&
    imageCache[imgKey] &&
    imageCache[imgKey] !== undefined
  ) {
    const img = imageCache[imgKey];
    const [width, height] = getRenderDims(img.naturalWidth, img.naturalHeight);
    context.drawImage(img, 0, 0, width, height);
  } else {
    // Avoid creating and rendering an SVG until MathJax is loaded.
    if (!isMathJaxLoaded) {
      return;
    }
    const img = new Image();
    const svgString = createSvg(
      text,
      fontSize,
      strokeColor,
      textAlign,
      opacity,
      mathOpts,
      isMathJaxLoaded,
    ).outerHTML;
    const svg = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });
    const transformMatrix = context.getTransform();
    const reader = new FileReader();
    reader.addEventListener(
      "load",
      () => {
        img.onload = function () {
          const [width, height] = getRenderDims(
            img.naturalWidth,
            img.naturalHeight,
          );
          context.setTransform(transformMatrix);
          context.drawImage(img, 0, 0, width, height);
          if (isMathJaxLoaded) {
            imageCache[imgKey] = img;
          }
          if (refresh) {
            refresh();
          }
        };
        img.src = reader.result as string;
      },
      false,
    );
    reader.readAsDataURL(svg);
  }
};

const renderSvgTextElementMath = (
  svgRoot: SVGElement,
  node: SVGElement,
  element: NonDeleted<ExcalidrawTextElementMath>,
): void => {
  const isMathJaxLoaded = mathJaxLoaded;
  const svg = createSvg(
    element.text,
    element.fontSize,
    element.strokeColor,
    element.textAlign,
    element.opacity / 100,
    getMathOpts.ensureMathOpts(element.useTex, element.mathOnly),
    isMathJaxLoaded,
  );
  const tempSvg = svgRoot.ownerDocument!.createElementNS(SVG_NS, "svg");
  tempSvg.innerHTML = svg.innerHTML;
  tempSvg.setAttribute("width", svg.getAttribute("width")!);
  tempSvg.setAttribute("height", svg.getAttribute("height")!);
  tempSvg.setAttribute("viewBox", svg.getAttribute("viewBox")!);
  node.appendChild(tempSvg);
};

const restoreTextElementMath = (
  element: ExcalidrawTextElementMath,
  elementRestored: ExcalidrawTextElementMath,
): ExcalidrawTextElement => {
  const mathElement = element;
  const mathOpts = getMathOpts.ensureMathOpts(
    mathElement.useTex,
    mathElement.mathOnly,
  );
  elementRestored = newElementWith(elementRestored, {
    useTex: mathOpts.useTex,
    mathOnly: mathOpts.mathOnly,
  });
  return elementRestored;
};

export const wrapTextElementMath = (
  element: Omit<
    ExcalidrawTextElementMath,
    | "id"
    | "isDeleted"
    | "type"
    | "baseline"
    | "width"
    | "height"
    | "angle"
    | "seed"
    | "version"
    | "versionNonce"
    | "groupIds"
    | "boundElements"
    | "containerId"
    | "updated"
    | "link"
  >,
  containerWidth: number,
  next?: {
    fontSize?: number;
    text?: string;
    textOpts?: TextOptsMath;
  },
): string => {
  const isMathJaxLoaded = mathJaxLoaded;
  const fontSize =
    next?.fontSize !== undefined ? next.fontSize : element.fontSize;
  const text = next?.text !== undefined ? next.text : element.originalText;
  const useTex =
    next?.textOpts !== undefined && next.textOpts.useTex !== undefined
      ? next.textOpts.useTex
      : element.useTex;
  const mathOnly =
    next?.textOpts !== undefined && next.textOpts.mathOnly !== undefined
      ? next.textOpts.mathOnly
      : element.mathOnly;
  const mathOpts = getMathOpts.ensureMathOpts(useTex, mathOnly);

  const font = getFontString({ fontSize, fontFamily: element.fontFamily });

  const maxWidth = containerWidth - BOUND_TEXT_PADDING * 2;

  const outputs = markupText(text, mathOpts, isMathJaxLoaded);
  const outputMetrics = measureOutputs(
    outputs,
    font,
    mathOpts,
    isMathJaxLoaded,
  );

  const delimiter = getDelimiter(mathOpts.useTex);
  const lines = consumeMathNewlines(text, mathOpts).split("\n");
  const lineText: string[][] = [];
  const lineWidth: number[][] = [];
  const newText: string[] = [];
  let newTextIndex = 0;
  newText.push("");
  for (let index = 0; index < outputs.length; index++) {
    let lineIndex = 0;
    let itemWidth = 0;
    let pushNew = false;
    lineText.push([]);
    lineWidth.push([]);
    lineText[index].push("");
    lineWidth[index].push(0);
    const lineArray = lines[index].split(delimiter);
    for (let i = 0; i < outputs[index].length; i++) {
      const isSvg = i % 2 === 1 || mathOnly;
      itemWidth = 0;
      let lineItem = lineArray[i];
      if (isSvg) {
        itemWidth = outputMetrics.outputMetrics[index][i].width;
        lineItem = delimiter + lineItem + delimiter;
      }
      if (pushNew) {
        lineText[index].push(lineItem);
        lineWidth[index].push(itemWidth);
        lineIndex++;
      } else {
        lineText[index][lineIndex] += lineItem; // should always be text
      }
      pushNew = true;
    }
    if (outputs[index].length % 2 === 1 || mathOnly) {
      // Last one was text
      pushNew = false;
    }

    for (let i = 0; i < lineText[index].length; i++) {
      // Now get the widths for all the concatenated text strings
      if (lineIndex % 2 === 0) {
        lineWidth[index][i] = getTextWidth(lineText[index][i], font);
      }
    }

    // Now move onto wrapping
    let curWidth = 0;
    for (let i = 0; i < lineText[index].length; i++) {
      if (i % 2 === 1 || mathOnly) {
        // lineText[index][i] is math here
        if (lineWidth[index][i] > maxWidth) {
          // If the math svg is greater than maxWidth, make it its
          // own, new line.  Don't try to split the math rendering
          // into multiple lines.
          newText.push(lineText[index][i]);
          newTextIndex++;
          curWidth = 0;
        } else if (
          curWidth <= maxWidth &&
          curWidth + lineWidth[index][i] > maxWidth
        ) {
          // If the math svg would push us past maxWidth, start a
          // new line.  Store the math svg's width in curWidth.
          newText.push(lineText[index][i]);
          newTextIndex++;
          curWidth = lineWidth[index][i];
        } else {
          // If the math svg would not push us past maxWidth, then
          // just append it to the current line.  Add the math
          // svg's width to curWidth.
          newText[newTextIndex] += lineText[index][i];
          curWidth += lineWidth[index][i];
        }
      } else if (
        curWidth <= maxWidth &&
        curWidth + lineWidth[index][i] > maxWidth
      ) {
        // lineText[index][i] is text from here on in the if blocks
        const spaceWidth = getTextWidth(" ", font);
        const words = lineText[index][i].split(" ");
        let wordsIndex = 0;
        // Append words one-by-one until we would be over maxWidth;
        // then let wrapText() take effect.
        while (curWidth <= maxWidth) {
          const tempWidth =
            getTextWidth(words[wordsIndex], font) +
            (wordsIndex > 0 ? spaceWidth : 0);
          if (curWidth + tempWidth <= maxWidth) {
            if (wordsIndex > 0) {
              newText[newTextIndex] += " ";
            }
            newText[newTextIndex] += words[wordsIndex];
            curWidth += tempWidth;
            wordsIndex++;
          } else {
            break;
          }
        }
        let toWrap = "";
        let addSpace = false;
        for (; wordsIndex < words.length; wordsIndex++) {
          if (addSpace) {
            toWrap += " ";
          }
          addSpace = true;
          toWrap += words[wordsIndex];
        }
        const wrappedText = wrapText(toWrap, font, maxWidth);
        const lastNewline = wrappedText.lastIndexOf("\n");
        if (lastNewline >= 0) {
          newText.push("");
          newTextIndex++;
          newText[newTextIndex] += wrappedText.substring(0, lastNewline);
        }
        newText.push(wrappedText.substring(lastNewline + 1));
        newTextIndex++;
        curWidth = getTextWidth(wrappedText.substring(lastNewline + 1), font);
      } else {
        newText[newTextIndex] += lineText[index][i];
        curWidth += lineWidth[index][i];
      }
    }
  }

  // Get the metrics for the newly wrapped text.
  // Since we cache, no need to do anything with the return value
  // of measureMath().
  const wrappedText = newText.join("\n");
  measureMath(wrappedText, fontSize, mathOpts, isMathJaxLoaded);
  return wrappedText;
};

export const registerTextElementSubtypeMath = (
  onSubtypesLoaded?: (isTextElementSubtype: Function) => void,
) => {
  registerTextLikeShortcutNames(textShortcutMap, isTextShortcutNameMath);
  registerTextLikeSubtypeName(TEXT_SUBTYPE_MATH);
  registerTextLikeDisabledPanelComponents(TEXT_SUBTYPE_MATH, [
    "changeFontFamily",
  ]);
  // Set the callback first just in case anything in this method
  // calls loadMathJax().
  mathJaxLoadedCallback = onSubtypesLoaded;
  registerTextLikeMethod("apply", {
    subtype: TEXT_SUBTYPE_MATH,
    method: applyTextElementMathOpts,
  });
  registerTextLikeMethod("clean", {
    subtype: TEXT_SUBTYPE_MATH,
    method: cleanTextOptUpdatesMath,
  });
  registerTextLikeMethod("measure", {
    subtype: TEXT_SUBTYPE_MATH,
    method: measureTextElementMath,
  });
  registerTextLikeMethod("render", {
    subtype: TEXT_SUBTYPE_MATH,
    method: renderTextElementMath,
  });
  registerTextLikeMethod("renderSvg", {
    subtype: TEXT_SUBTYPE_MATH,
    method: renderSvgTextElementMath,
  });
  registerTextLikeMethod("restore", {
    subtype: TEXT_SUBTYPE_MATH,
    method: restoreTextElementMath,
  });
  registerTextLikeMethod("wrap", {
    subtype: TEXT_SUBTYPE_MATH,
    method: wrapTextElementMath,
  });
  registerActionsMath();
  registerAuxLangData(`./textlike/${TEXT_SUBTYPE_MATH}`);
  // Call loadMathJax() here if we want to be sure it's loaded.
};

const enableActionChangeMathOpts = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  const eligibleElements = getSelectedMathElements(elements, appState);

  let enabled = false;
  eligibleElements.forEach((element) => {
    if (
      isMathElement(element) ||
      (hasBoundTextElement(element) &&
        isMathElement(getBoundTextElement(element)))
    ) {
      enabled = true;
    }
  });

  return enabled;
};

const setMathOptsForSelectedElements = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  mathOpts: TextOptsMath,
) => {
  // Operate on the selected math elements only
  const selectedElements = getSelectedMathElements(elements, appState);

  selectedElements.forEach((element) => {
    const el = (
      getBoundTextElement(element) &&
      isMathElement(getBoundTextElement(element))
        ? getBoundTextElement(element)
        : element
    ) as NonDeleted<ExcalidrawTextElementMath>;
    const isMathJaxLoaded = mathJaxLoaded;

    // Set the useTex field
    if (mathOpts.useTex !== undefined) {
      mutateElement(el, { useTex: mathOpts.useTex });
    }
    // Set the mathOnly field
    if (mathOpts.mathOnly !== undefined) {
      mutateElement(el, { mathOnly: mathOpts.mathOnly });
    }
    // Mark the element for re-rendering
    invalidateShapeForElement(el);
    // Update the width/height of the element
    const metrics = measureMath(
      el.text,
      el.fontSize,
      getMathOpts.ensureMathOpts(el.useTex, el.mathOnly),
      isMathJaxLoaded,
    );
    mutateElement(el, metrics);
    redrawTextBoundingBox(el, getContainerElement(element));
  });

  // Set the default value for new math-text elements.
  return {
    elements: elements.map(
      (element) =>
        selectedElements.find((ele) => ele.id === element.id) || element,
    ),
    appState: { ...appState, textOpts: mathOpts },
  };
};

const registerActionsMath = () => {
  const mathActions: Action[] = [];
  const actionChangeUseTex: Action = {
    name: "changeUseTex",
    perform: (elements, appState, useTex) => {
      if (useTex === null) {
        useTex = getFormValue(elements, appState, (element) => {
          const el = hasBoundTextElement(element)
            ? getBoundTextElement(element)
            : element;
          return isMathElement(el) && el.useTex;
        });
        if (useTex === null) {
          useTex = getMathOpts.getUseTex(appState);
        }
        useTex = !useTex;
      }
      const { elements: modElements, appState: modAppState } =
        setMathOptsForSelectedElements(elements, appState, { useTex });

      return {
        elements: modElements,
        appState: modAppState,
        commitToHistory: true,
      };
    },
    keyTest: (event) =>
      event.ctrlKey && event.shiftKey && event.code === "KeyM",
    contextItemLabel: "labels.toggleUseTex",
    contextItemPredicate: (elements, appState) =>
      enableActionChangeMathOpts(elements, appState),
    PanelComponentPredicate: (elements, appState) => {
      let enabled = true;
      getSelectedElements(getNonDeletedElements(elements), appState).forEach(
        (element) => {
          if (
            (!isTextElement(element) && !hasBoundTextElement(element)) ||
            (!isTextElement(element) &&
              hasBoundTextElement(element) &&
              !isMathElement(getBoundTextElement(element))) ||
            (isTextElement(element) && element.subtype !== TEXT_SUBTYPE_MATH)
          ) {
            enabled = false;
          }
        },
      );
      if (appState.editingElement && !isMathElement(appState.editingElement)) {
        enabled = false;
      }
      if (
        appState.activeTool.type === "text" &&
        appState.textElementSubtype !== TEXT_SUBTYPE_MATH
      ) {
        enabled = false;
      }
      return enabled;
    },
    PanelComponent: ({ elements, appState, updateData }) => (
      <fieldset>
        <legend>{t("labels.changeUseTex")}</legend>
        <ButtonSelect
          group="useTex"
          options={[
            {
              value: true,
              text: t("labels.useTexTrue"),
            },
            {
              value: false,
              text: t("labels.useTexFalse"),
            },
          ]}
          value={getFormValue(
            elements,
            appState,
            (element) => {
              const el = hasBoundTextElement(element)
                ? getBoundTextElement(element)
                : element;
              return isMathElement(el) && el.useTex !== undefined
                ? el.useTex
                : true;
            },
            getMathOpts.getUseTex(appState),
          )}
          onChange={(value) => updateData(value)}
          theme={appState.theme}
        />
      </fieldset>
    ),
    trackEvent: false,
  };
  const actionChangeMathOnly: Action = {
    name: "changeMathOnly",
    perform: (elements, appState, mathOnly) => {
      if (mathOnly === null) {
        mathOnly = getFormValue(elements, appState, (element) => {
          const el = hasBoundTextElement(element)
            ? getBoundTextElement(element)
            : element;
          return isMathElement(el) && el.mathOnly;
        });
        if (mathOnly === null) {
          mathOnly = getMathOpts.getMathOnly(appState);
        }
        mathOnly = !mathOnly;
      }
      const { elements: modElements, appState: modAppState } =
        setMathOptsForSelectedElements(elements, appState, { mathOnly });

      return {
        elements: modElements,
        appState: modAppState,
        commitToHistory: true,
      };
    },
    keyTest: (event) =>
      event.ctrlKey && event.shiftKey && event.code === "KeyO",
    contextItemLabel: "labels.toggleMathOnly",
    contextItemPredicate: (elements, appState) =>
      enableActionChangeMathOpts(elements, appState),
    PanelComponentPredicate: (elements, appState) => {
      let enabled = true;
      getSelectedElements(getNonDeletedElements(elements), appState).forEach(
        (element) => {
          if (
            (!isTextElement(element) && !hasBoundTextElement(element)) ||
            (!isTextElement(element) &&
              hasBoundTextElement(element) &&
              !isMathElement(getBoundTextElement(element))) ||
            (isTextElement(element) && element.subtype !== TEXT_SUBTYPE_MATH)
          ) {
            enabled = false;
          }
        },
      );
      if (appState.editingElement && !isMathElement(appState.editingElement)) {
        enabled = false;
      }
      if (
        appState.activeTool.type === "text" &&
        appState.textElementSubtype !== TEXT_SUBTYPE_MATH
      ) {
        enabled = false;
      }
      return enabled;
    },
    PanelComponent: ({ elements, appState, updateData }) => (
      <fieldset>
        <legend>{t("labels.changeMathOnly")}</legend>
        <ButtonSelect
          group="mathOnly"
          options={[
            {
              value: false,
              text: t("labels.mathOnlyFalse"),
            },
            {
              value: true,
              text: t("labels.mathOnlyTrue"),
            },
          ]}
          value={getFormValue(
            elements,
            appState,
            (element) => {
              const el = hasBoundTextElement(element)
                ? getBoundTextElement(element)
                : element;
              return isMathElement(el) && el.mathOnly !== undefined
                ? el.mathOnly
                : false;
            },
            getMathOpts.getMathOnly(appState),
          )}
          onChange={(value) => updateData(value)}
          theme={appState.theme}
        />
      </fieldset>
    ),
    trackEvent: false,
  };
  mathActions.push(actionChangeUseTex);
  mathActions.push(actionChangeMathOnly);
  addTextLikeActions(mathActions);
};
