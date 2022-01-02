// Some imports
import { FontString } from "../../element/types";
import { FONT_FAMILY, SVG_NS } from "../../constants";
import {
  getFontString,
  getFontFamilyString,
  getShortcutKey,
  isRTL,
} from "../../utils";
import { getApproxLineHeight, measureText } from "../../element/textElement";
import { isTextElement } from "../../element/typeChecks";
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
import { getNonDeletedElements } from "../../element";
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
  }>;

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
};

const getUseTex = (appState: AppState): boolean => {
  const textOptsMath = appState.textOpts as TextOptsMath;
  const useTex = textOptsMath.useTex !== undefined ? textOptsMath.useTex : true;
  return useTex;
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
    const tex = new TeX.TeX({});
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
    if (mathJaxLoadedCallback !== undefined) {
      mathJaxLoadedCallback(isMathElement);
    }
  }
};

// Cache the SVGs from MathJax
const mathJaxSvgCacheAM = {} as { [key: string]: string };
const mathJaxSvgCacheTex = {} as { [key: string]: string };

const math2Svg = (text: string, useTex: boolean, isMathJaxLoaded: boolean) => {
  if (
    isMathJaxLoaded &&
    (useTex ? mathJaxSvgCacheTex[text] : mathJaxSvgCacheAM[text])
  ) {
    return useTex ? mathJaxSvgCacheTex[text] : mathJaxSvgCacheAM[text];
  }
  loadMathJax();
  try {
    const userOptions = { display: false };
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
    return text;
  }
};

const markupText = (
  text: string,
  useTex: boolean,
  isMathJaxLoaded: boolean,
) => {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const outputs = [] as Array<string>[];
  for (let index = 0; index < lines.length; index++) {
    outputs.push([]);
    if (!isMathJaxLoaded) {
      // Run lines[index] through math2Svg so loadMathJax() gets called
      outputs[index].push(math2Svg(lines[index], useTex, isMathJaxLoaded));
      continue;
    }
    const lineArray = lines[index].split(useTex ? "$$" : "`");
    for (let i = 0; i < lineArray.length; i++) {
      // Don't guard the following as "isMathJaxLoaded && i % 2 === 1"
      // in order to ensure math2Svg() actually gets called, and thus
      // loadMathJax().
      if (i % 2 === 1) {
        const svgString = math2Svg(lineArray[i], useTex, isMathJaxLoaded);
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
  useTex: boolean,
) => {
  const key = `${text}, ${fontSize}, ${strokeColor}, ${textAlign}, ${opacity}, ${useTex}`;
  return key;
};

const metricsCache = {} as {
  [key: string]: {
    outputMetrics: Array<{ width: number; height: number; baseline: number }>[];
    lineMetrics: Array<{ width: number; height: number; baseline: number }>;
    imageMetrics: { width: number; height: number; baseline: number };
  };
};

const measureHTML = (
  text: string,
  font: FontString,
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

  // Compute for each SVG child element of line (the last
  // child is the span element for the baseline).
  const childOffsets = [];
  for (let i = 0; i < container.children.length - 1; i++) {
    // The mji-container element
    const child = container.children[i] as HTMLElement;
    // The svg element
    const grandchild = child.firstChild as HTMLElement;
    // How far the svg element is offset from the top of the rendered text
    const childOffsetHeight =
      container.getBoundingClientRect().y -
      grandchild.getBoundingClientRect().y;
    childOffsets.push({
      width: child.offsetWidth,
      height: childOffsetHeight,
    });
  }
  if (childOffsets.length === 0) {
    // Avoid crashes in measureOutputs()
    childOffsets.push({ width: 0, height: 0 });
  }
  document.body.removeChild(container);
  return { width, height, baseline, childOffsets };
};

const measureOutputs = (
  outputs: string[][],
  fontString: FontString,
  isMathJaxLoaded: boolean,
  maxWidth?: number | null,
) => {
  let key = fontString as string;
  for (let index = 0; index < outputs.length; index++) {
    for (let i = 0; i < outputs[index].length; i++) {
      key += outputs[index][i] === "" ? " " : outputs[index][i];
    }
    if (index < outputs.length - 1) {
      key += "\n";
    }
  }
  const cKey = key;
  if (isMathJaxLoaded && metricsCache[cKey]) {
    return metricsCache[cKey];
  }
  const tCtx = document.createElement("canvas").getContext("2d");
  if (tCtx !== null) {
    tCtx.font = fontString;
  }
  const outputMetrics = [] as Array<{
    width: number;
    height: number;
    baseline: number;
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
    outputMetrics.push([]);
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
      childOffsets: lineChildOffsets,
    } = measureHTML(html, fontString, maxWidth);

    for (let i = 0; i < outputs[index].length; i++) {
      if (isMathJaxLoaded && i % 2 === 1) {
        // svg
        outputMetrics[index].push({
          width: lineChildOffsets[(i - 1) / 2].width,
          height: lineChildOffsets[(i - 1) / 2].height,
          baseline: 0,
        });
      } else {
        // text
        outputMetrics[index].push(measureText(outputs[index][i], fontString));
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
  useTex: boolean,
  isMathJaxLoaded: boolean,
) => {
  const key = getCacheKey(
    text,
    fontSize,
    strokeColor,
    textAlign,
    opacity,
    useTex,
  );

  const mathLines = text.replace(/\r\n?/g, "\n").split("\n");
  const processed = markupText(text, useTex, isMathJaxLoaded);

  const fontFamily = FONT_FAMILY_MATH;
  const fontString = getFontString({ fontSize, fontFamily });
  const metrics = measureOutputs(processed, fontString, isMathJaxLoaded);
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
      const childIsSvg = isMathJaxLoaded && i % 2 === 1;
      if (childIsSvg) {
        const tempDiv = svgRoot.ownerDocument.createElement("div");
        tempDiv.innerHTML = processed[index][i];
        childNode = tempDiv.children[0].children[0] as SVGSVGElement;
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
        processed[index].length > 0 && processed[index][i] === ""
          ? 0
          : childMetrics.width;
      const yOffset =
        lineMetrics.height +
        (childIsSvg ? childMetrics.height : -lineMetrics.baseline);
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
  useTex: boolean,
  isMathJaxLoaded: boolean,
  maxWidth?: number | null,
) => {
  return measureOutputs(
    markupText(text, useTex, isMathJaxLoaded),
    getFontString({ fontSize, fontFamily: FONT_FAMILY_MATH }),
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
    (element, index, eligibleElements) => {
      return isMathElement(element);
    },
  ) as NonDeleted<ExcalidrawTextElementMath>[];
  return eligibleElements;
};

const applyTextElementMathOpts = (
  element: NonDeleted<ExcalidrawTextElementMath>,
  textOpts?: TextOptsMath,
): NonDeleted<ExcalidrawTextElement> => {
  const useTex = textOpts?.useTex !== undefined ? textOpts.useTex : true;
  return newElementWith(element, { useTex, fontFamily: FONT_FAMILY_MATH });
};

const cleanTextOptUpdatesMath = (
  opts: ElementUpdate<ExcalidrawTextElementMath>,
): ElementUpdate<ExcalidrawTextElementMath> => {
  const newOpts = {};
  for (const key in opts) {
    const value = key === "fontFamily" ? FONT_FAMILY_MATH : (opts as any)[key];
    (newOpts as any)[key] = value;
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
  return measureMath(text, fontSize, useTex, isMathJaxLoaded, maxWidth);
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

  const key = getCacheKey(
    text,
    fontSize,
    strokeColor,
    textAlign,
    opacity,
    useTex,
  );

  if (
    isMathJaxLoaded &&
    imageMetricsCache[key] &&
    imageMetricsCache[key] === undefined
  ) {
    imageMetricsCache[key] = measureOutputs(
      markupText(text, useTex, isMathJaxLoaded),
      getFontString({ fontSize, fontFamily }),
      isMathJaxLoaded,
    ).imageMetrics;
  }
  const imageMetrics =
    isMathJaxLoaded &&
    imageMetricsCache[key] &&
    imageMetricsCache[key] !== undefined
      ? imageMetricsCache[key]
      : measureOutputs(
          markupText(text, useTex, isMathJaxLoaded),
          getFontString({ fontSize, fontFamily }),
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
      useTex,
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
    element.useTex,
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
  elementRestored = newElementWith(elementRestored, {
    useTex: mathElement.useTex,
  });
  return elementRestored;
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
  registerActionsMath();
  registerAuxLangData(`./textlike/${TEXT_SUBTYPE_MATH}`);
  // Call loadMathJax() here if we want to be sure it's loaded.
};

const enableActionChangeUseTex = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  const eligibleElements = getSelectedMathElements(elements, appState);

  let enabled = false;
  eligibleElements.forEach((element) => {
    if (isMathElement(element)) {
      enabled = true;
    }
  });

  return enabled;
};

const setUseTexForSelectedElements = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  useTex: boolean,
) => {
  // Operate on the selected math elements only
  const selectedElements = getSelectedMathElements(elements, appState);

  selectedElements.forEach((element) => {
    const isMathJaxLoaded = mathJaxLoaded;

    // Set the useTex field
    mutateElement(element, { useTex });
    // Mark the element for re-rendering
    invalidateShapeForElement(element);
    // Update the width/height of the element
    const metrics = measureMath(
      element.text,
      element.fontSize,
      element.useTex,
      isMathJaxLoaded,
    );
    mutateElement(element, metrics);
  });

  // Set the default value for new math-text elements.
  return {
    elements: elements.map(
      (element) =>
        selectedElements.find((ele) => ele.id === element.id) || element,
    ),
    appState: { ...appState, textOpts: { useTex } },
  };
};

const registerActionsMath = () => {
  const mathActions: Action[] = [];
  const actionChangeUseTex: Action = {
    name: "changeUseTex",
    perform: (elements, appState, useTex) => {
      if (useTex === null) {
        useTex = getFormValue(
          elements,
          appState,
          (element) => isMathElement(element) && element.useTex,
        );
        if (useTex === null) {
          useTex = getUseTex(appState);
        }
        useTex = !useTex;
      }
      const { elements: modElements, appState: modAppState } =
        setUseTexForSelectedElements(elements, appState, useTex);

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
      enableActionChangeUseTex(elements, appState),
    PanelComponentPredicate: (elements, appState) => {
      let enabled = true;
      getSelectedElements(getNonDeletedElements(elements), appState).forEach(
        (element) => {
          if (
            !isTextElement(element) ||
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
        appState.elementType === "text" &&
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
            (element) => isMathElement(element) && element.useTex,
            getUseTex(appState),
          )}
          onChange={(value) => updateData(value)}
          theme={appState.theme}
        />
      </fieldset>
    ),
  };
  mathActions.push(actionChangeUseTex);
  addTextLikeActions(mathActions);
};
