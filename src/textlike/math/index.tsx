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

const getStartDelimiter = (useTex: boolean): string => {
  return useTex ? "\\(" : "`";
};

const getEndDelimiter = (useTex: boolean): string => {
  return useTex ? "\\)" : "`";
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
    const AsciiMath = (await import("mathjax-full/js/input/asciimath.js"))
      .AsciiMath;
    const TeX = (await import("mathjax-full/js/input/tex.js")).TeX;
    const SVG = (await import("mathjax-full/js/output/svg.js")).SVG;
    const liteAdaptor = (
      await import("mathjax-full/js/adaptors/liteAdaptor.js")
    ).liteAdaptor;
    const HTMLDocument = (
      await import("mathjax-full/js/handlers/html/HTMLDocument.js")
    ).HTMLDocument;

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

    // Set up shared output components
    mathJax.adaptor = liteAdaptor();
    const svg = new SVG({ fontCache: "local" });

    // Configure AsciiMath to use the "display" option.  See
    // https://github.com/mathjax/MathJax/issues/2520#issuecomment-1128831182.
    const MathJax = (
      await require("mathjax-full/js/input/asciimath/mathjax2/legacy/MathJax")
    ).MathJax;
    MathJax.InputJax.AsciiMath.AM.Augment({ displaystyle: false });

    // AsciiMath input
    const asciimath = new AsciiMath<
      typeof LiteElement | typeof LiteText,
      typeof LiteText,
      typeof LiteDocument
    >({});
    mathJax.amHtml = new HTMLDocument<
      typeof LiteElement | typeof LiteText,
      typeof LiteText,
      typeof LiteDocument
    >("", mathJax.adaptor, {
      InputJax: asciimath,
      OutputJax: svg,
    });

    // LaTeX input
    const tex = new TeX({ packages: texPackages });
    mathJax.texHtml = new HTMLDocument<
      typeof LiteElement | typeof LiteText,
      typeof LiteText,
      typeof LiteDocument
    >("", mathJax.adaptor, {
      InputJax: tex,
      OutputJax: svg,
    });

    // Error indicator
    errorSvg = mathJax.adaptor.outerHTML(
      mathJax.texHtml.convert("ERR", { display: false }),
    );

    // Finalize loading MathJax
    mathJaxLoaded = true;
    if (mathJaxLoadedCallback !== undefined) {
      mathJaxLoadedCallback(isMathElement);
    }
  }
};

// Round `x` to `n` decimal places
const roundDec = (x: number, n: number) => {
  const powOfTen = Math.pow(10, n);
  return Math.round(x * powOfTen) / powOfTen;
};

const splitMath = (text: string, mathOpts: MathOpts) => {
  const startDelimiter = getStartDelimiter(mathOpts.useTex);
  const endDelimiter = getEndDelimiter(mathOpts.useTex);
  let curIndex = 0;
  let oldIndex = 0;
  const array = [];

  const mathFirst = text.indexOf(startDelimiter, 0) === 0;
  let inText = !mathFirst;
  if (!inText) {
    array.push("");
  }
  while (oldIndex >= 0 && curIndex >= 0) {
    oldIndex =
      curIndex +
      (inText
        ? curIndex > 0
          ? endDelimiter.length
          : 0
        : startDelimiter.length);
    curIndex = text.indexOf(inText ? startDelimiter : endDelimiter, oldIndex);
    if (curIndex >= oldIndex || (curIndex < 0 && oldIndex > 0)) {
      inText = !inText;
      array.push(
        text.substring(oldIndex, curIndex >= 0 ? curIndex : text.length),
      );
    }
  }
  if (array.length === 0 && !mathFirst) {
    array[0] = text;
  }

  return array;
};

const joinMath = (
  text: string[],
  mathOpts: MathOpts,
  isMathJaxLoaded: boolean,
) => {
  const startDelimiter = getStartDelimiter(mathOpts.useTex);
  const endDelimiter = getEndDelimiter(mathOpts.useTex);
  let inText = true;
  let joined = "";
  for (let index = 0; index < text.length; index++) {
    const space = index > 0 ? " " : "";
    joined +=
      mathOpts.mathOnly && isMathJaxLoaded
        ? `${space}${text[index]}`
        : inText
        ? text[index]
        : startDelimiter + text[index] + endDelimiter;
    inText = !inText;
  }
  return joined;
};

// This lets math input run across multiple newlines.
// Basically, replace with a space each newline between the delimiters.
// Do so unless it's AsciiMath in math-only mode.
const consumeMathNewlines = (
  text: string,
  mathOpts: MathOpts,
  isMathJaxLoaded: boolean,
) => {
  const tempText = splitMath(text.replace(/\r\n?/g, "\n"), mathOpts);
  if (mathOpts.useTex || !mathOpts.mathOnly) {
    for (let i = 0; i < tempText.length; i++) {
      if (i % 2 === 1 || mathOpts.mathOnly) {
        tempText[i] = tempText[i].replace(/\n/g, " ");
      }
    }
  }
  return joinMath(tempText, mathOpts, isMathJaxLoaded);
};

// Cache the SVGs from MathJax
const mathJaxSvgCacheAM = {} as { [key: string]: string };
const mathJaxSvgCacheTex = {} as { [key: string]: string };
// Cache the results of getMetrics()
const metricsCache = {} as {
  [key: string]: {
    markupMetrics: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>[];
    lineMetrics: Array<{ width: number; height: number; baseline: number }>;
    imageMetrics: { width: number; height: number; baseline: number };
  };
};
// Cache the SVGs for renderSvgTextElementMath()
const svgCache = {} as { [key: string]: SVGSVGElement };
// Cache the rendered MathJax images for renderTextElementMath()
const imageCache = {} as { [key: string]: HTMLImageElement };

const textAsMjxContainer = (
  text: string,
  isMathJaxLoaded: boolean,
): Element | null => {
  // Put the content in a div to check whether it is SVG or Text
  const container = document.createElement("div");
  container.innerHTML = text;
  // The mjx-container has child nodes, while Text nodes do not.
  // Check for the "viewBox" attribute to determine if it's SVG.
  const childIsSvg =
    isMathJaxLoaded &&
    container.childNodes &&
    container.childNodes.length > 0 &&
    container.childNodes[0].hasChildNodes() &&
    container.childNodes[0].childNodes[0].nodeName === "svg";
  // Conditionally return the mjx-container
  return childIsSvg ? (container.children[0] as Element) : null;
};

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
  const lines = consumeMathNewlines(text, mathOpts, isMathJaxLoaded).split(
    "\n",
  );
  const markup = [] as Array<string>[];
  for (let index = 0; index < lines.length; index++) {
    markup.push([]);
    if (!isMathJaxLoaded) {
      // Run lines[index] through math2Svg so loadMathJax() gets called
      markup[index].push(math2Svg(lines[index], mathOpts, isMathJaxLoaded));
      continue;
    }
    // Don't split by the delimiter in math-only mode
    const lineArray =
      mathOpts.mathOnly || !isMathJaxLoaded
        ? [lines[index]]
        : splitMath(lines[index], mathOpts);
    for (let i = 0; i < lineArray.length; i++) {
      // Don't guard the following as "isMathJaxLoaded && i % 2 === 1"
      // in order to ensure math2Svg() actually gets called, and thus
      // loadMathJax().
      if (i % 2 === 1 || mathOpts.mathOnly) {
        const svgString = math2Svg(lineArray[i], mathOpts, isMathJaxLoaded);
        markup[index].push(svgString);
      } else {
        markup[index].push(lineArray[i]);
      }
    }
    if (lineArray.length === 0) {
      markup[index].push("");
    }
  }
  return markup;
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

const measureMarkup = (
  markup: Array<string | Element>,
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

  // Sanitize possible HTML entered
  for (let i = 0; i < markup.length; i++) {
    // This should be an mjx-container
    if ((markup[i] as Element).hasChildNodes) {
      // Append as HTML
      container.appendChild(markup[i] as Element);
    } else {
      // Append as text
      container.append(markup[i]);
    }
  }

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
  const width = container.offsetWidth;
  const height = container.offsetHeight;

  const containerRect = container.getBoundingClientRect();
  // Compute for each SVG or Text child node of line (the last
  // child is the span element for the baseline).
  const childMetrics = [];
  let nextX = 0;
  for (let i = 0; i < container.childNodes.length - 1; i++) {
    // The mjx-container has child nodes, while Text nodes do not
    const childIsSvg =
      isMathJaxLoaded &&
      ((container.childNodes[i].hasChildNodes() &&
        container.childNodes[i].childNodes[0].nodeName === "svg") ||
        mathOpts.mathOnly);
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
    // Avoid crashes in getMetrics()
    childMetrics.push({ x: 0, y: 0, width: 0, height: 0 });
  }
  document.body.removeChild(container);
  return { width, height, baseline, childMetrics };
};

const getMetrics = (
  markup: string[][],
  fontSize: number,
  mathOpts: MathOpts,
  isMathJaxLoaded: boolean,
  maxWidth?: number | null,
) => {
  const fontString = getFontString({ fontSize, fontFamily: FONT_FAMILY_MATH });
  let key = fontString as string;
  for (let index = 0; index < markup.length; index++) {
    for (let i = 0; i < markup[index].length; i++) {
      key += markup[index][i];
    }
    if (index < markup.length - 1) {
      key += "\n";
    }
  }
  const cKey = key;
  if (isMathJaxLoaded && metricsCache[cKey]) {
    return metricsCache[cKey];
  }
  const markupMetrics = [] as Array<{
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
  for (let index = 0; index < markup.length; index++) {
    // We pass an array of mjx-containers and strings
    const lineMarkup = [] as Array<string | Element>;
    for (let i = 0; i < markup[index].length; i++) {
      const mjx = textAsMjxContainer(markup[index][i], isMathJaxLoaded);
      lineMarkup.push(mjx !== null ? mjx : markup[index][i]);
    }

    // Use the browser's measurements by temporarily attaching
    // the rendered line to the document.body.
    const { width, height, baseline, childMetrics } = measureMarkup(
      lineMarkup,
      fontString,
      mathOpts,
      isMathJaxLoaded,
      maxWidth,
    );

    markupMetrics.push(childMetrics);
    lineMetrics.push({ width, height, baseline });
    imageWidth = Math.max(imageWidth, width);
    imageHeight += height;
  }
  const lastLineMetrics = lineMetrics[lineMetrics.length - 1];
  const imageMetrics = {
    width: imageWidth,
    height: imageHeight,
    baseline: imageHeight - lastLineMetrics.height + lastLineMetrics.baseline,
  };
  const metrics = { markupMetrics, lineMetrics, imageMetrics };
  if (isMathJaxLoaded) {
    metricsCache[cKey] = metrics;
  }
  return metrics;
};

const renderMath = (
  text: string,
  fontSize: number,
  textAlign: CanvasTextAlign,
  mathOpts: MathOpts,
  isMathJaxLoaded: boolean,
  doSetupChild: (
    childIsSvg: boolean,
    svg: SVGSVGElement | null,
    text: string,
    rtl: boolean,
    childRtl: boolean,
    lineHeight: number,
  ) => void,
  doRenderChild: (x: number, y: number, width: number, height: number) => void,
) => {
  const mathLines = consumeMathNewlines(text, mathOpts, isMathJaxLoaded).split(
    "\n",
  );
  const markup = markupText(text, mathOpts, isMathJaxLoaded);
  const metrics = getMetrics(markup, fontSize, mathOpts, isMathJaxLoaded);
  const imageMetrics = metrics.imageMetrics;

  let y = 0;
  for (let index = 0; index < markup.length; index++) {
    const lineMetrics = metrics.lineMetrics[index];
    const lineMarkupMetrics = metrics.markupMetrics[index];
    const rtl = isRTL(mathLines[index]);
    const x =
      textAlign === "right"
        ? imageMetrics.width - lineMetrics.width
        : textAlign === "left"
        ? 0
        : (imageMetrics.width - lineMetrics.width) / 2;
    // Drop any empty strings from this line to match childMetrics
    const content = markup[index].filter((value) => value !== "");
    for (let i = 0; i < content.length; i += 1) {
      const mjx = textAsMjxContainer(
        content[mathOpts.mathOnly ? 0 : i],
        isMathJaxLoaded,
      );
      // If we got an mjx-container, then assume it contains an SVG child
      const childIsSvg = mjx !== null;
      const svg = childIsSvg ? (mjx.children[0] as SVGSVGElement) : null;
      const childRtl = childIsSvg
        ? false
        : isRTL(content[mathOpts.mathOnly ? 0 : i]);
      // Set up the child for rendering
      const height = lineMetrics.height;
      doSetupChild(childIsSvg, svg, content[i], rtl, childRtl, height);
      // Don't offset when we have an empty string.
      const nullContent = content.length > 0 && content[i] === "";
      const childX = nullContent ? 0 : lineMarkupMetrics[i].x;
      const childY = nullContent ? 0 : lineMarkupMetrics[i].y;
      const childWidth = nullContent ? 0 : lineMarkupMetrics[i].width;
      const childHeight = nullContent ? 0 : lineMarkupMetrics[i].height;
      // Now render the child
      doRenderChild(x + childX, y + childY, childWidth, childHeight);
    }
    y += lineMetrics.height;
  }
};

const getImageMetrics = (
  text: string,
  fontSize: number,
  mathOpts: MathOpts,
  isMathJaxLoaded: boolean,
  maxWidth?: number | null,
) => {
  const markup = markupText(text, mathOpts, isMathJaxLoaded);
  return getMetrics(markup, fontSize, mathOpts, isMathJaxLoaded, maxWidth)
    .imageMetrics;
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
  return getImageMetrics(text, fontSize, mathOpts, isMathJaxLoaded, maxWidth);
};

const renderTextElementMath = (
  element: NonDeleted<ExcalidrawTextElementMath>,
  context: CanvasRenderingContext2D,
  renderCb?: () => void,
) => {
  const isMathJaxLoaded = mathJaxLoaded;

  const text = element.text;
  const fontSize = element.fontSize;
  const strokeColor = element.strokeColor;
  const textAlign = element.textAlign;
  const opacity = element.opacity / 100;
  const useTex = element.useTex;
  const mathOnly = element.mathOnly;
  const mathOpts = getMathOpts.ensureMathOpts(useTex, mathOnly);

  let _childIsSvg: boolean;
  let _text: string;
  let _svg: SVGSVGElement;

  const doSetupChild: (
    childIsSvg: boolean,
    svg: SVGSVGElement | null,
    text: string,
    rtl: boolean,
    childRtl: boolean,
  ) => void = function (childIsSvg, svg, text, rtl, childRtl) {
    _childIsSvg = childIsSvg;
    _text = text;

    if (_childIsSvg) {
      _svg = svg!;
    } else {
      context.save();
      context.canvas.setAttribute("dir", childRtl ? "rtl" : "ltr");
      context.font = getFontString(element);
      context.fillStyle = element.strokeColor;
      context.textAlign = element.textAlign as CanvasTextAlign;
    }
  };

  const doRenderChild: (
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void = function (x, y, width, height) {
    if (_childIsSvg) {
      const key = getCacheKey(
        _text,
        fontSize,
        strokeColor,
        "left",
        1,
        mathOpts,
      );

      const _x = Math.round(x);
      const _y = Math.round(y);
      const imgKey = `${key}, ${width}, ${height}`;
      if (
        isMathJaxLoaded &&
        imageCache[imgKey] &&
        imageCache[imgKey] !== undefined
      ) {
        const img = imageCache[imgKey];
        const [width, height] = [img.naturalWidth, img.naturalHeight];
        context.drawImage(img, _x, _y, width, height);
      } else {
        const img = new Image();
        _svg.setAttribute("width", `${width}`);
        _svg.setAttribute("height", `${height}`);
        _svg.setAttribute("color", `${strokeColor}`);
        const svgString = _svg.outerHTML;
        const svg = new Blob([svgString], {
          type: "image/svg+xml;charset=utf-8",
        });
        const transformMatrix = context.getTransform();
        const reader = new FileReader();
        reader.addEventListener(
          "load",
          () => {
            img.onload = function () {
              const [width, height] = [img.naturalWidth, img.naturalHeight];
              context.save();
              context.setTransform(transformMatrix);
              context.globalAlpha = opacity;
              context.drawImage(img, _x, _y, width, height);
              context.restore();
              if (isMathJaxLoaded) {
                imageCache[imgKey] = img;
              }
              if (renderCb) {
                renderCb();
              }
            };
            img.src = reader.result as string;
          },
          false,
        );
        reader.readAsDataURL(svg);
      }
    } else {
      const childOffset =
        textAlign === "center"
          ? (width - 1) / 2
          : textAlign === "right"
          ? width - 1
          : 0;
      context.fillText(_text, x + childOffset, y);
      context.restore();
    }
  };
  renderMath(
    text,
    fontSize,
    textAlign,
    mathOpts,
    isMathJaxLoaded,
    doSetupChild,
    doRenderChild,
  );
};

const renderSvgTextElementMath = (
  svgRoot: SVGElement,
  node: SVGElement,
  element: NonDeleted<ExcalidrawTextElementMath>,
): void => {
  const isMathJaxLoaded = mathJaxLoaded;
  const mathOpts = getMathOpts.ensureMathOpts(element.useTex, element.mathOnly);
  const text = element.text;
  const fontSize = element.fontSize;
  const strokeColor = element.strokeColor;
  const textAlign = element.textAlign;
  const opacity = element.opacity / 100;

  const key = getCacheKey(
    text,
    fontSize,
    strokeColor,
    textAlign,
    opacity,
    mathOpts,
  );
  if (isMathJaxLoaded && svgCache[key]) {
    node.appendChild(svgCache[key]);
    return;
  }

  const tempSvg = svgRoot.ownerDocument!.createElementNS(SVG_NS, "svg");
  const groupNode = tempSvg.ownerDocument.createElementNS(SVG_NS, "g");

  const font = getFontFamilyString({ fontFamily: FONT_FAMILY_MATH });
  groupNode.setAttribute("font-family", `${font}`);
  groupNode.setAttribute("font-size", `${fontSize}px`);
  groupNode.setAttribute("color", `${strokeColor}`);
  groupNode.setAttribute("stroke-opacity", `${opacity}`);
  groupNode.setAttribute("fill-opacity", `${opacity}`);
  tempSvg.appendChild(groupNode);

  const { width, height } = getImageMetrics(
    text,
    fontSize,
    mathOpts,
    isMathJaxLoaded,
  );

  let _rtl: boolean;
  let childNode = {} as SVGSVGElement | SVGTextElement;
  const doSetupChild: (
    childIsSvg: boolean,
    svg: SVGSVGElement | null,
    text: string,
    rtl: boolean,
    childRtl: boolean,
    lineHeight: number,
  ) => void = function (childIsSvg, svg, text, rtl, childRtl, lineHeight) {
    _rtl = rtl;
    if (childIsSvg && text !== "") {
      childNode = svg!;

      // Scale the viewBox to have a centered height of 1.2 * lineHeight
      const rect = childNode.viewBox.baseVal;
      const scale = (1.2 * lineHeight) / rect.height;
      const goffset = roundDec(0.12 * lineHeight, 3);
      const gx = roundDec(rect.x * scale, 3) + goffset;
      const gy = roundDec(rect.y * scale, 3) + goffset;
      const gwidth = roundDec(rect.width * scale, 3);
      const gheight = roundDec(rect.height * scale, 3);
      childNode.setAttribute(
        "viewBox",
        `${-goffset} ${-goffset} ${gwidth} ${gheight}`,
      );

      // Set the transform on the svg's group node(s)
      for (let i = 0; i < childNode.childNodes.length; i++) {
        if (childNode.childNodes[i].nodeName === "g") {
          const group = childNode.childNodes[i] as SVGGElement;
          const transform = group.getAttribute("transform");
          group.setAttribute(
            "transform",
            `translate(${-gx} ${-gy}) scale(${scale}) ${transform}`,
          );
        }
      }
    } else {
      const textNode = tempSvg.ownerDocument.createElementNS(
        "http://www.w3.org/2000/svg",
        "text",
      );
      textNode.setAttribute("style", "white-space: pre;");
      textNode.setAttribute("fill", `${strokeColor}`);
      textNode.setAttribute("direction", `${childRtl ? "rtl" : "ltr"}`);
      textNode.setAttribute("text-anchor", `${childRtl ? "end" : "start"}`);
      textNode.textContent = text;
      childNode = textNode;
    }
  };
  const doRenderChild: (x: number, y: number) => void = function (x, y) {
    childNode.setAttribute("x", `${_rtl ? x : x}`);
    childNode.setAttribute("y", `${y}`);
    groupNode.appendChild(childNode);
  };
  renderMath(
    text,
    fontSize,
    textAlign,
    mathOpts,
    isMathJaxLoaded,
    doSetupChild,
    doRenderChild,
  );

  tempSvg.setAttribute("version", "1.1");
  tempSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  tempSvg.setAttribute("width", `${width}`);
  tempSvg.setAttribute("height", `${height}`);
  if (isMathJaxLoaded) {
    svgCache[key] = tempSvg;
  }
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

  const font = getFontString({ fontSize, fontFamily: FONT_FAMILY_MATH });

  const maxWidth = containerWidth - BOUND_TEXT_PADDING * 2;

  const markup = markupText(text, mathOpts, isMathJaxLoaded);
  const metrics = getMetrics(markup, fontSize, mathOpts, isMathJaxLoaded);

  const lines = consumeMathNewlines(text, mathOpts, isMathJaxLoaded).split(
    "\n",
  );
  const lineText: string[][] = [];
  const lineWidth: number[][] = [];
  const newText: string[] = [];
  let newTextIndex = 0;
  newText.push("");
  for (let index = 0; index < markup.length; index++) {
    let lineIndex = 0;
    let itemWidth = 0;
    let pushNew = false;
    lineText.push([]);
    lineWidth.push([]);
    lineText[index].push("");
    lineWidth[index].push(0);
    let lastIsSvg = false;
    const lineArray = splitMath(lines[index], mathOpts).filter(
      (value) => value !== "",
    );
    const markupArray = markup[index].filter((value) => value !== "");
    for (let i = 0; i < lineArray.length; i++) {
      const isSvg =
        textAsMjxContainer(markupArray[i], isMathJaxLoaded) !== null;
      itemWidth = 0;
      let lineItem = lineArray[i];
      if (isSvg || mathOnly) {
        itemWidth = metrics.markupMetrics[index][i].width;
        lineItem =
          getStartDelimiter(mathOpts.useTex) +
          lineItem +
          getEndDelimiter(mathOpts.useTex);
      }
      if (pushNew) {
        lineText[index].push(lineItem);
        lineWidth[index].push(itemWidth);
        lineIndex++;
      } else {
        lineText[index][lineIndex] += lineItem; // should always be text
      }
      pushNew = true;
      lastIsSvg = isSvg;
    }
    if (!lastIsSvg || mathOnly) {
      // Last one was text
      pushNew = false;
    }

    for (let i = 0; i < lineText[index].length; i++) {
      // Now get the widths for all the concatenated text strings
      if (textAsMjxContainer(lineText[index][i], isMathJaxLoaded) === null) {
        lineWidth[index][i] = getTextWidth(lineText[index][i], font);
      }
    }

    // Now move onto wrapping
    let curWidth = 0;
    for (let i = 0; i < lineText[index].length; i++) {
      if (
        textAsMjxContainer(lineText[index][i], isMathJaxLoaded) !== null ||
        mathOnly
      ) {
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
  // of getImageMetrics().
  const wrappedText = newText.join("\n");
  getImageMetrics(wrappedText, fontSize, mathOpts, isMathJaxLoaded);
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
    const metrics = getImageMetrics(
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
