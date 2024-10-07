// Some imports
import fallbackMathJaxLangData from "./locales/en.json";
import { FONT_FAMILY, SVG_NS } from "../../../constants";
import { getFontString, getFontFamilyString, isRTL } from "../../../utils";
import {
  getBoundTextElement,
  getBoundTextMaxWidth,
  getContainerElement,
  getTextWidth,
  measureText,
  wrapText,
} from "../../../element/textElement";
import {
  hasBoundTextElement,
  isTextElement,
} from "../../../element/typeChecks";
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  NonDeleted,
} from "../../../element/types";
import { getLineHeight } from "../../../fonts";
import { newElementWith } from "../../../element/mutateElement";
import { getElementAbsoluteCoords } from "../../../element/bounds";
import Scene from "../../../scene/Scene";

// Imports for actions
import type { LangLdr } from "../../../i18n";
import { registerCustomLangData, t } from "../../../i18n";
import type { Action } from "../../../actions/types";
import { makeCustomActionName } from "../../../actions/types";
import type { AppClassProperties, AppState } from "../../../types";
import {
  changeProperty,
  getFormValue,
} from "../../../actions/actionProperties";
import { getSelectedElements } from "../../../scene";
import { getNonDeletedElements, redrawTextBoundingBox } from "../../../element";
import { ButtonIconSelect } from "../../../components/ButtonIconSelect";

// Subtype imports
import type { SubtypeLoadedCb, SubtypeMethods, SubtypePrepFn } from "../";
import { mathSubtypeIcon } from "./icon";
import { getMathSubtypeRecord } from "./types";
import { SubtypeButton } from "../../../components/Subtypes";

const mathSubtype = getMathSubtypeRecord().subtype;
const FONT_FAMILY_MATH = FONT_FAMILY.Helvetica;
type MathProps = Record<"useTex" | "mathOnly", boolean>;

type ExcalidrawMathElement = ExcalidrawTextElement &
  Readonly<{
    subtype: typeof mathSubtype;
  }>;

const isMathElement = (
  element: ExcalidrawElement | null,
): element is ExcalidrawMathElement => {
  return (
    isTextElement(element) &&
    "subtype" in element &&
    element.subtype === mathSubtype
  );
};

class GetMathProps {
  private useTex: boolean = true;
  private mathOnly: boolean = false;
  getUseTex = (appState?: AppState): boolean => {
    const mathProps =
      appState?.customData && appState.customData[`${mathSubtype}`];
    if (mathProps !== undefined) {
      this.useTex = mathProps.useTex !== undefined ? mathProps.useTex : true;
    }
    return this.useTex;
  };

  getMathOnly = (appState?: AppState): boolean => {
    const mathProps =
      appState?.customData && appState.customData[`${mathSubtype}`];
    if (mathProps !== undefined) {
      this.mathOnly =
        mathProps.mathOnly !== undefined ? mathProps.mathOnly : false;
    }
    return this.mathOnly;
  };

  ensureMathProps = (props: ExcalidrawElement["customData"]): MathProps => {
    const mathProps: MathProps = {
      useTex:
        props !== undefined && props.useTex !== undefined
          ? props.useTex
          : this.useTex,
      mathOnly:
        props !== undefined && props.mathOnly !== undefined
          ? props.mathOnly
          : this.mathOnly,
    };
    return mathProps;
  };
}
const getMathProps = new GetMathProps();

const deEscapeTex = (text: string, mathProps: MathProps): string => {
  return mathProps.useTex ? text.replaceAll("\\$", "$") : text;
};

const getStartDelimiter = (useTex: boolean, desktop = false): string => {
  return useTex ? (desktop ? "\\(" : "$") : "`";
};

const getEndDelimiter = (useTex: boolean, desktop = false): string => {
  return useTex ? (desktop ? "\\)" : "$") : "`";
};

const mathJax = {} as {
  adaptor: any;
  amHtml: any;
  texHtml: any;
  visitor: any;
  mmlSvg: any;
  mmlSre: any;
  amFixes: any;
};

let mathJaxLoaded = false;
let mathJaxLoading = false;
let mathJaxLoadedCallback: SubtypeLoadedCb | undefined;

// Configure use or non-use of speech-rule-engine
const useSRE = false;

let errorSvg: string;
let errorAria: string;

const loadMathJax = async () => {
  const continueLoading = !mathJaxLoading;
  if (!mathJaxLoaded) {
    mathJaxLoading = true;

    // MathJax components we use
    const AsciiMath = (await import("mathjax-full/js/input/asciimath"))
      .AsciiMath;
    const TeX = (await import("mathjax-full/js/input/tex")).TeX;
    const SVG = (await import("mathjax-full/js/output/svg")).SVG;
    const liteAdaptor = (await import("mathjax-full/js/adaptors/liteAdaptor"))
      .liteAdaptor;
    const RegisterHTMLHandler = (await import("mathjax-full/js/handlers/html"))
      .RegisterHTMLHandler;

    // Components for MathJax accessibility
    const MathML = (await import("mathjax-full/js/input/mathml")).MathML;
    const SerializedMmlVisitor = (
      await import("mathjax-full/js/core/MmlTree/SerializedMmlVisitor")
    ).SerializedMmlVisitor;
    const Sre = useSRE
      ? (await import("mathjax-full/js/a11y/sre")).Sre
      : undefined;

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
    const LiteElement = (await import("mathjax-full/js/adaptors/lite/Element"))
      .LiteElement;
    const LiteText = (await import("mathjax-full/js/adaptors/lite/Text"))
      .LiteText;
    const LiteDocument = (
      await import("mathjax-full/js/adaptors/lite/Document")
    ).LiteDocument;

    // Configure AsciiMath to use the "display" option.  See
    // https://github.com/mathjax/MathJax/issues/2520#issuecomment-1128831182.
    const MathJax = (
      await import(
        /* @vite-ignore */ "mathjax-full/js/input/asciimath/mathjax2/legacy/MathJax"
      )
    ).MathJax;
    mathJax.amFixes = MathJax.InputJax.AsciiMath.AM.Augment;

    // Load the document creator last
    const mathjax = (await import("mathjax-full/js/mathjax")).mathjax;

    type E = typeof LiteElement;
    type T = typeof LiteText;
    type D = typeof LiteDocument;
    if (mathJaxLoading && !continueLoading) {
      return;
    }

    // Set up shared components
    mathJax.adaptor = liteAdaptor();
    mathJax.visitor = new SerializedMmlVisitor();
    RegisterHTMLHandler(mathJax.adaptor);

    // Set up input components
    const asciimath = new AsciiMath<E | T, T, D>({});
    const tex = new TeX<E | T, T, D>({ packages: texPackages });

    // Set up output components
    const mml = new MathML<E | T, T, D>();
    const svg = new SVG<E | T, T, D>({ fontCache: "local" });

    // AsciiMath input
    mathJax.amHtml = mathjax.document("", { InputJax: asciimath });

    // LaTeX input
    mathJax.texHtml = mathjax.document("", { InputJax: tex });

    // Capture the MathML for accessibility purposes
    mathJax.mmlSvg = mathjax.document("", {
      InputJax: mml,
      OutputJax: svg,
    });

    const mathJaxReady = function () {
      mathJax.mmlSre = Sre;

      // Error indicator
      const errorMML = mathJax.visitor.visitTree(
        mathJax.texHtml.convert("ERR", { display: false }),
      );
      errorSvg = mathJax.adaptor.outerHTML(mathJax.mmlSvg.convert(errorMML));
      errorAria = useSRE ? mathJax.mmlSre.toSpeech(errorMML) : "ERR";

      // Clear any caches from before loading MathJax
      clearCaches();

      // Finalize loading MathJax
      mathJaxLoaded = true;

      if (mathJaxLoadedCallback !== undefined) {
        mathJaxLoadedCallback(isMathElement);
      }
    };

    if (useSRE) {
      // Set up a custom loader to use our local mathmaps
      const custom = (locale: string) => {
        return new Promise<string>((resolve, reject) => {
          try {
            const mathmap = JSON.stringify(
              import(
                /* @vite-ignore */ `mathjax-full/es5/sre/mathmaps/${locale}.json`
              ),
            );
            resolve(mathmap);
          } catch (e) {
            reject("");
          }
        });
      };
      global.SREfeature = { custom };

      // Configure MathJax for accessibility
      Sre?.setupEngine({ speech: "shallow", custom: true }).then(() => {
        mathJaxReady();
      });
    } else {
      mathJaxReady();
    }
  }
};

// Round `x` to `n` decimal places
const roundDec = (x: number, n: number) => {
  const powOfTen = Math.pow(10, n);
  return Math.round(x * powOfTen) / powOfTen;
};

const splitMath = (text: string, mathProps: MathProps) => {
  const desktopStartDelimiter = getStartDelimiter(mathProps.useTex, true);
  const desktopEndDelimiter = getEndDelimiter(mathProps.useTex, true);
  const webStartDelimiter = getStartDelimiter(mathProps.useTex);
  const webEndDelimiter = getEndDelimiter(mathProps.useTex);

  const desktopStyle = text.indexOf(desktopStartDelimiter) >= 0;
  const startDelimiter = desktopStyle
    ? desktopStartDelimiter
    : webStartDelimiter;
  const endDelimiter = desktopStyle ? desktopEndDelimiter : webEndDelimiter;

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
    const delim = inText ? startDelimiter : endDelimiter;
    curIndex = text.indexOf(delim, oldIndex);
    // Avoid splitting at escaped "$" characters
    if (!desktopStyle) {
      while (curIndex > 0 && text.charAt(curIndex - 1) === "\\") {
        curIndex = text.indexOf(delim, curIndex + 1);
      }
    }
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
  mathProps: MathProps,
  isMathJaxLoaded: boolean,
) => {
  const startDelimiter = getStartDelimiter(mathProps.useTex, true);
  const endDelimiter = getEndDelimiter(mathProps.useTex, true);
  let inText = true;
  let joined = "";
  for (let index = 0; index < text.length; index++) {
    const space = index > 0 ? " " : "";
    joined +=
      mathProps.mathOnly && isMathJaxLoaded
        ? `${space}${text[index]}`
        : inText
        ? text[index]
        : startDelimiter + text[index] + endDelimiter;
    inText = !inText;
  }
  return joined;
};

const getMathNewline = (mathProps: MathProps) => {
  return mathProps.useTex && mathProps.mathOnly ? "\\newline" : "\n";
};

// This lets math input run across multiple newlines.
// Basically, replace with a space each newline between the delimiters.
// Do so unless it's AsciiMath in math-only mode.
const consumeMathNewlines = (
  text: string,
  mathProps: MathProps,
  isMathJaxLoaded: boolean,
) => {
  if (!isMathJaxLoaded) {
    return text;
  }
  const tempText = splitMath(text.replace(/\r\n?/g, "\n"), mathProps);
  if (mathProps.useTex || !mathProps.mathOnly) {
    for (let i = 0; i < tempText.length; i++) {
      if (i % 2 === 1 || mathProps.mathOnly) {
        tempText[i] = tempText[i].replace(/\n/g, " ");
      }
    }
  }
  return joinMath(tempText, mathProps, isMathJaxLoaded);
};

// Cache the SVGs from MathJax
const mathJaxSvgCacheAM = {} as {
  [key: string]: { svg: string; aria: string };
};
const mathJaxSvgCacheTex = {} as {
  [key: string]: { svg: string; aria: string };
};
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
    imageMetrics: { width: number; height: number };
  };
};
// Cache the SVGs for renderSvgMathElement()
const svgCache = {} as { [key: string]: string };
// Cache the rendered MathJax images for renderMathElement()
const imageCache = {} as { [key: string]: HTMLImageElement };
// Cache the MathJax-wrapped text strings for wrapMathElement()
const wrappedMathCache: { [key: string]: string } = {};

const clearCaches = () => {
  for (const key in mathJaxSvgCacheAM) {
    delete mathJaxSvgCacheAM[key];
  }
  for (const key in mathJaxSvgCacheTex) {
    delete mathJaxSvgCacheTex[key];
  }
  for (const key in metricsCache) {
    delete metricsCache[key];
  }
  for (const key in svgCache) {
    delete svgCache[key];
  }
  for (const key in imageCache) {
    delete imageCache[key];
  }
  for (const key in wrappedMathCache) {
    delete wrappedMathCache[key];
  }
};

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
  mathProps: MathProps,
  isMathJaxLoaded: boolean,
): { svg: string; aria: string } => {
  const useTex = mathProps.useTex;
  const key = `${mathProps.mathOnly}${text}`;
  if (
    isMathJaxLoaded &&
    (useTex ? mathJaxSvgCacheTex[key] : mathJaxSvgCacheAM[key])
  ) {
    return useTex ? mathJaxSvgCacheTex[key] : mathJaxSvgCacheAM[key];
  }
  loadMathJax();
  try {
    const userOptions = { display: mathProps.mathOnly };
    // For some reason this needs to be set before each call to the AsciiMath
    // input jax to render display/inline correctly.
    if (isMathJaxLoaded && !useTex) {
      mathJax.amFixes({ displaystyle: mathProps.mathOnly });
    }
    // Intermediate MathML
    const mmlString = isMathJaxLoaded
      ? mathJax.visitor.visitTree(
          useTex
            ? mathJax.texHtml.convert(text, userOptions)
            : mathJax.amHtml.convert(text, userOptions),
        )
      : text;
    let mmlError = false;
    if (isMathJaxLoaded) {
      const errDiv = document.createElement("div");
      errDiv.innerHTML = mmlString;
      mmlError =
        errDiv.children[0].children.length > 0 &&
        errDiv.children[0].children[0].nodeName === "merror";
    }
    // For rendering
    const htmlString = isMathJaxLoaded
      ? mmlError
        ? errorSvg
        : mathJax.adaptor.outerHTML(mathJax.mmlSvg.convert(mmlString))
      : text;
    // For accessibility
    const ariaString = isMathJaxLoaded
      ? mmlError
        ? errorAria
        : useSRE
        ? mathJax.mmlSre.toSpeech(mmlString)
        : text
      : mmlString;
    if (isMathJaxLoaded) {
      if (useTex) {
        mathJaxSvgCacheTex[key] = { svg: htmlString, aria: ariaString };
      } else {
        mathJaxSvgCacheAM[key] = { svg: htmlString, aria: ariaString };
      }
    }
    return { svg: htmlString, aria: ariaString };
  } catch {
    if (isMathJaxLoaded) {
      return { svg: errorSvg, aria: errorAria };
    }
    return { svg: text, aria: text };
  }
};

const markupText = (
  text: string,
  mathProps: MathProps,
  isMathJaxLoaded: boolean,
) => {
  const lines = consumeMathNewlines(text, mathProps, isMathJaxLoaded).split(
    isMathJaxLoaded ? getMathNewline(mathProps) : "\n",
  );
  const markup = [] as Array<string>[];
  const aria = [] as Array<string>[];
  for (let index = 0; index < lines.length; index++) {
    markup.push([]);
    aria.push([]);
    if (!isMathJaxLoaded) {
      // Run lines[index] through math2Svg so loadMathJax() gets called
      const math = math2Svg(lines[index], mathProps, isMathJaxLoaded);
      markup[index].push(math.svg);
      aria[index].push(math.aria);
      continue;
    }
    // Don't split by the delimiter in math-only mode
    const lineArray =
      mathProps.mathOnly || !isMathJaxLoaded
        ? [lines[index]]
        : splitMath(lines[index], mathProps);
    for (let i = 0; i < lineArray.length; i++) {
      // Don't guard the following as "isMathJaxLoaded && i % 2 === 1"
      // in order to ensure math2Svg() actually gets called, and thus
      // loadMathJax().
      if (i % 2 === 1 || mathProps.mathOnly) {
        const math = math2Svg(lineArray[i], mathProps, isMathJaxLoaded);
        markup[index].push(math.svg);
        aria[index].push(math.aria);
      } else {
        const text = deEscapeTex(lineArray[i], mathProps);
        markup[index].push(text);
        aria[index].push(text);
      }
    }
    if (lineArray.length === 0) {
      markup[index].push("");
      aria[index].push("");
    }
  }
  return { markup, aria };
};

const getCacheKey = (
  text: string,
  fontSize: number,
  strokeColor: String,
  textAlign: string,
  opacity: Number,
  mathProps: MathProps,
) => {
  const key = `${text}, ${fontSize}, ${strokeColor}, ${textAlign}, ${opacity}, ${mathProps.useTex}, ${mathProps.mathOnly}`;
  return key;
};

const measureMarkup = (
  markup: Array<string | Element>,
  fontSize: number,
  lineHeight: ExcalidrawTextElement["lineHeight"],
  mathProps: MathProps,
  isMathJaxLoaded: boolean,
  maxWidth?: number | null,
) => {
  const font = getFontString({ fontSize, fontFamily: FONT_FAMILY_MATH });
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.whiteSpace = "pre";
  container.style.font = font;
  container.style.minHeight = "1em";

  if (maxWidth) {
    container.style.maxWidth = `${String(maxWidth)}px`;
    container.style.overflow = "hidden";
    container.style.wordBreak = "break-word";
    container.style.lineHeight = `${String(lineHeight)}`;
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
      container.append(deEscapeTex(markup[i] as string, mathProps));
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
        mathProps.mathOnly);
    // The mjx-container element or the Text node
    const child = container.childNodes[i] as HTMLElement | Text;
    if (isMathJaxLoaded && (mathProps.mathOnly || childIsSvg)) {
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
        const constrainedText = maxWidth
          ? wrapText(text, font, maxWidth)
          : text;
        const textMetrics = measureText(constrainedText, font, lineHeight);
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
  let width = 0;
  let height = measureText(" ", font, lineHeight).height;
  childMetrics.forEach((metrics) => (width += metrics.width));
  childMetrics.forEach(
    (metrics) => (height = Math.max(height, metrics.height)),
  );
  return { width, height, baseline, childMetrics };
};

const getMetrics = (
  markup: string[][],
  fontSize: number,
  lineHeight: ExcalidrawTextElement["lineHeight"],
  mathProps: MathProps,
  isMathJaxLoaded: boolean,
  maxWidth?: number | null,
) => {
  let key = `${fontSize} ${mathProps.useTex} ${mathProps.mathOnly} ${isMathJaxLoaded} ${maxWidth}`;
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
      fontSize,
      lineHeight,
      mathProps,
      isMathJaxLoaded,
      maxWidth,
    );

    markupMetrics.push(childMetrics);
    lineMetrics.push({ width, height, baseline });
    imageWidth = Math.max(imageWidth, width);
    imageHeight += height;
  }
  const imageMetrics = {
    width: imageWidth,
    height: imageHeight,
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
  lineHeight: ExcalidrawTextElement["lineHeight"],
  textAlign: string,
  mathProps: MathProps,
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
  parentWidth?: number,
): string => {
  const mathLines = consumeMathNewlines(text, mathProps, isMathJaxLoaded).split(
    isMathJaxLoaded ? getMathNewline(mathProps) : "\n",
  );
  const { markup, aria } = markupText(text, mathProps, isMathJaxLoaded);
  const metrics = getMetrics(
    markup,
    fontSize,
    lineHeight,
    mathProps,
    isMathJaxLoaded,
  );
  const width = parentWidth ?? metrics.imageMetrics.width;

  let y = -1;
  for (let index = 0; index < markup.length; index++) {
    const lineMetrics = metrics.lineMetrics[index];
    const lineMarkupMetrics = metrics.markupMetrics[index];
    const rtl = isRTL(mathLines[index]);
    const x =
      textAlign === "right"
        ? width - lineMetrics.width + 1
        : textAlign === "left"
        ? 0
        : (width - lineMetrics.width + 1) / 2;
    // Drop any empty strings from this line to match childMetrics
    const content = markup[index].filter((value) => value !== "");
    for (let i = 0; i < content.length; i += 1) {
      const mjx = textAsMjxContainer(
        content[mathProps.mathOnly ? 0 : i],
        isMathJaxLoaded,
      );
      // If we got an mjx-container, then assume it contains an SVG child
      const childIsSvg = mjx !== null;
      const svg = childIsSvg ? (mjx.children[0] as SVGSVGElement) : null;
      const childRtl = childIsSvg
        ? false
        : isRTL(content[mathProps.mathOnly ? 0 : i]);
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
  let ariaText = "";
  for (let i = 0; i < aria.length; i++) {
    if (i > 0) {
      ariaText = `${ariaText} `;
    }
    for (let j = 0; j < aria[i].length; j++) {
      ariaText = `${ariaText}${aria[i][j]}`;
    }
  }
  return ariaText;
};

const getImageMetrics = (
  text: string,
  fontSize: number,
  lineHeight: ExcalidrawTextElement["lineHeight"],
  mathProps: MathProps,
  isMathJaxLoaded: boolean,
  maxWidth?: number | null,
) => {
  const markup = markupText(text, mathProps, isMathJaxLoaded).markup;
  return getMetrics(
    markup,
    fontSize,
    lineHeight,
    mathProps,
    isMathJaxLoaded,
    maxWidth,
  ).imageMetrics;
};

const getSelectedMathElements = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
  app: AppClassProperties,
): NonDeleted<ExcalidrawMathElement>[] => {
  const selectedElements = getSelectedElements(
    getNonDeletedElements(elements),
    appState,
  );
  if (appState.editingTextElement) {
    selectedElements.push(appState.editingTextElement);
  }
  const eligibleElements = selectedElements.filter(
    (element, index, eligibleElements) =>
      isMathElement(element) ||
      (hasBoundTextElement(element) &&
        isMathElement(
          getBoundTextElement(
            element,
            app.scene.getElementsMapIncludingDeleted(),
          ),
        )),
  ) as NonDeleted<ExcalidrawMathElement>[];
  return eligibleElements;
};

// Be sure customData is defined with proper values for ExcalidrawMathElements
const ensureMathElement = (element: Partial<ExcalidrawElement>) => {
  if (!isMathElement(element as Required<ExcalidrawElement>)) {
    return;
  }
  const mathProps = getMathProps.ensureMathProps(element.customData);
  (element as any).customData = {
    ...element.customData,
    useTex: mathProps.useTex,
    mathOnly: mathProps.mathOnly,
  } as ExcalidrawElement["customData"];
};

const cleanMathElementUpdate = function (updates) {
  const oldUpdates = {};
  for (const key in updates) {
    if (key !== "fontFamily" && key !== "lineHeight") {
      (oldUpdates as any)[key] = (updates as any)[key];
    }
    if (key === "customData") {
      const mathProps = getMathProps.ensureMathProps((updates as any)[key]);
      (updates as any)[key] = {
        ...(updates as any)[key],
        useTex: mathProps.useTex,
        mathOnly: mathProps.mathOnly,
      };
    } else {
      (updates as any)[key] = (updates as any)[key];
    }
  }
  (updates as any).fontFamily = FONT_FAMILY_MATH;
  (updates as any).lineHeight = getLineHeight(FONT_FAMILY_MATH);
  return oldUpdates;
} as SubtypeMethods["clean"];

const getMathEditorStyle = function (element) {
  if (isMathElement(element)) {
    return { background: undefined };
  }
  return {};
} as SubtypeMethods["getEditorStyle"];

const measureMathElement = function (element, next) {
  ensureMathElement(element);
  const isMathJaxLoaded = mathJaxLoaded;
  if (!isMathJaxLoaded && isMathElement(element as ExcalidrawElement)) {
    const { width, height } = element as ExcalidrawMathElement;
    return { width, height };
  }
  const fontSize = next?.fontSize ?? element.fontSize;
  const lineHeight = element.lineHeight;
  const text = next?.text ?? element.text;
  const customData = next?.customData ?? element.customData;
  const mathProps = getMathProps.ensureMathProps(customData);
  const metrics = getImageMetrics(
    text,
    fontSize,
    lineHeight,
    mathProps,
    isMathJaxLoaded,
  );
  return metrics;
} as SubtypeMethods["measureText"];

const renderMathElement = function (element, elementMap, context) {
  ensureMathElement(element);
  const isMathJaxLoaded = mathJaxLoaded;
  const _element = element as NonDeleted<ExcalidrawMathElement>;
  const text = _element.text;
  const fontSize = _element.fontSize;
  const lineHeight = _element.lineHeight;
  const strokeColor = _element.strokeColor;
  const textAlign = _element.textAlign;
  const opacity = _element.opacity / 100;
  const mathProps = getMathProps.ensureMathProps(_element.customData);

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
      context.font = getFontString({ fontSize, fontFamily: FONT_FAMILY_MATH });
      context.fillStyle = _element.strokeColor;
      context.textAlign = _element.textAlign as CanvasTextAlign;
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
        mathProps,
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
              Scene.getScene(element)?.triggerUpdate();
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
  const container = getContainerElement(_element, elementMap);
  const parentWidth = container
    ? getBoundTextMaxWidth(container, _element)
    : undefined;

  const offsetX =
    (_element.width - (container ? parentWidth! : _element.width)) *
    (textAlign === "right" ? 1 : textAlign === "center" ? 1 / 2 : 0);

  context.save();
  context.translate(offsetX, 0);
  element.customData!.ariaLabel = renderMath(
    text,
    fontSize,
    lineHeight,
    textAlign,
    mathProps,
    isMathJaxLoaded,
    doSetupChild,
    doRenderChild,
    parentWidth,
  );
  context.restore();
} as SubtypeMethods["render"];

const renderSvgMathElement = function (
  svgRoot,
  addToRoot,
  element,
  elementsMap,
  opt,
) {
  ensureMathElement(element);
  const isMathJaxLoaded = mathJaxLoaded;

  const _element = element as NonDeleted<ExcalidrawMathElement>;
  const mathProps = getMathProps.ensureMathProps(_element.customData);
  const text = _element.text;
  const fontSize = _element.fontSize;
  const lineHeight = _element.lineHeight;
  const strokeColor = _element.strokeColor;
  const textAlign = _element.textAlign;
  const opacity = _element.opacity / 100;
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
  const cx = (x2 - x1) / 2 - (element.x - x1);
  const cy = (y2 - y1) / 2 - (element.y - y1);
  const degree = (180 * element.angle) / Math.PI;

  const node = svgRoot.ownerDocument!.createElementNS(SVG_NS, "g");
  node.setAttribute(
    "transform",
    `translate(${opt?.offsetX || 0} ${
      opt?.offsetY || 0
    }) rotate(${degree} ${cx} ${cy})`,
  );

  const key = getCacheKey(
    text,
    fontSize,
    strokeColor,
    textAlign,
    opacity,
    mathProps,
  );
  if (isMathJaxLoaded && svgCache[key]) {
    const cachedDiv = svgRoot.ownerDocument!.createElement("div");
    cachedDiv.innerHTML = svgCache[key];
    node.appendChild(cachedDiv.firstElementChild!);
    addToRoot(node, element);
    return;
  }

  const tempSvg = svgRoot.ownerDocument!.createElementNS(SVG_NS, "svg");
  const groupNode = tempSvg.ownerDocument.createElementNS(SVG_NS, "g");

  const font = getFontFamilyString({ fontFamily: FONT_FAMILY_MATH });
  groupNode.setAttribute("font-family", `${font}`);
  groupNode.setAttribute("font-size", `${fontSize}px`);
  groupNode.setAttribute("color", `${strokeColor}`);
  if (opacity !== 1) {
    groupNode.setAttribute("stroke-opacity", `${opacity}`);
    groupNode.setAttribute("fill-opacity", `${opacity}`);
  }
  tempSvg.appendChild(groupNode);

  const container = getContainerElement(_element, elementsMap);
  const parentWidth = container
    ? getBoundTextMaxWidth(container, _element)
    : undefined;

  const offsetX =
    (_element.width - (container ? parentWidth! : _element.width)) *
    (textAlign === "right" ? 1 : textAlign === "center" ? 1 / 2 : 0);

  const { width, height } = getImageMetrics(
    text,
    fontSize,
    lineHeight,
    mathProps,
    isMathJaxLoaded,
    parentWidth,
  );

  let childNode = {} as SVGSVGElement | SVGTextElement;
  const doSetupChild: (
    childIsSvg: boolean,
    svg: SVGSVGElement | null,
    text: string,
    rtl: boolean,
    childRtl: boolean,
    lineHeight: number,
  ) => void = function (childIsSvg, svg, text, rtl, childRtl, lineHeight) {
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
    childNode.setAttribute("x", `${x + offsetX}`);
    childNode.setAttribute("y", `${y}`);
    groupNode.appendChild(childNode);
  };
  element.customData!.ariaLabel = renderMath(
    text,
    fontSize,
    lineHeight,
    textAlign,
    mathProps,
    isMathJaxLoaded,
    doSetupChild,
    doRenderChild,
    parentWidth,
  );

  tempSvg.setAttribute("version", "1.1");
  tempSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  tempSvg.setAttribute("width", `${width}`);
  tempSvg.setAttribute("height", `${height}`);
  if (isMathJaxLoaded) {
    svgCache[key] = tempSvg.outerHTML;
  }
  node.appendChild(tempSvg);
  addToRoot(node, element);
} as SubtypeMethods["renderSvg"];

const wrapMathElement = function (element, containerWidth, next) {
  ensureMathElement(element);
  const isMathJaxLoaded = mathJaxLoaded;
  const fontSize =
    next?.fontSize !== undefined ? next.fontSize : element.fontSize;
  const lineHeight = element.lineHeight;
  const text = next?.text !== undefined ? next.text : element.originalText;
  const customData = next?.customData ?? element.customData;
  const mathProps = getMathProps.ensureMathProps(customData);

  const font = getFontString({ fontSize, fontFamily: FONT_FAMILY_MATH });

  // Use regular text-wrapping for math-only mode
  if (mathProps.mathOnly) {
    return wrapText(text, font, containerWidth);
  }

  const maxWidth = containerWidth;

  const markup = markupText(text, mathProps, isMathJaxLoaded).markup;
  const metrics = getMetrics(
    markup,
    fontSize,
    lineHeight,
    mathProps,
    isMathJaxLoaded,
  );

  const lines = consumeMathNewlines(text, mathProps, isMathJaxLoaded).split(
    isMathJaxLoaded ? getMathNewline(mathProps) : "\n",
  );
  const wrappedLines: string[] = [];
  const spaceWidth = getTextWidth(" ", font);
  for (let index = 0; index < lines.length; index++) {
    const mathLineKey = `${containerWidth} ${fontSize} ${mathProps.useTex} ${mathProps.mathOnly} ${lines[index]}`;
    if (isMathJaxLoaded && wrappedMathCache[mathLineKey] !== undefined) {
      wrappedLines.push(...wrappedMathCache[mathLineKey].split("\n"));
      continue;
    }
    const currLineNum = wrappedLines.length;
    const lineArray = splitMath(lines[index], mathProps).filter(
      (value) => value !== "",
    );
    const markupArray = markup[index].filter((value) => value !== "");
    let curWidth = 0;
    wrappedLines.push("");
    // The following two boolean variables are to handle edge cases
    let nlByText = false;
    let nlByMath = false;
    for (let i = 0; i < lineArray.length; i++) {
      const isSvg =
        textAsMjxContainer(markupArray[i], isMathJaxLoaded) !== null;
      if (isSvg) {
        const lineItem =
          getStartDelimiter(mathProps.useTex) +
          lineArray[i] +
          getEndDelimiter(mathProps.useTex);
        const itemWidth = metrics.markupMetrics[index][i].width;
        if (itemWidth > maxWidth) {
          // If the math svg is greater than maxWidth, make its source
          // text be a new line and start on the next line.  Don't try
          // to split the math rendering into multiple lines.
          if (nlByText) {
            wrappedLines.pop();
            nlByText = false;
          }
          wrappedLines.push(lineItem);
          wrappedLines.push("");
          curWidth = 0;
          nlByMath = true;
        } else if (curWidth <= maxWidth && curWidth + itemWidth > maxWidth) {
          // If the math svg would push us past maxWidth, start a
          // new line and continue on that new line.  Store the math
          // svg's width in curWidth.
          wrappedLines.push(lineItem);
          curWidth = itemWidth;
          nlByMath = false;
        } else {
          // If the math svg would not push us past maxWidth, then
          // just append its source text to the current line.  Add
          // the math svg's width to curWidth.
          wrappedLines[wrappedLines.length - 1] += lineItem;
          curWidth += itemWidth;
          nlByMath = false;
        }
      } else {
        // Don't have spaces at the start of a wrapped line.  But
        // allow them at the start of new lines from the originalText.
        const lineItem =
          curWidth > 0 || i === 0 ? lineArray[i] : lineArray[i].trimStart();
        // Append words one-by-one until we would be over maxWidth;
        // then let wrapText() take effect.
        const words = lineItem.split(" ");
        let wordsIndex = 0;
        while (curWidth <= maxWidth && wordsIndex < words.length) {
          const wordWidth = getTextWidth(words[wordsIndex], font);
          if (nlByMath && wordWidth + spaceWidth > maxWidth) {
            wrappedLines.pop();
            nlByMath = false;
          }
          if (curWidth + wordWidth + spaceWidth <= maxWidth) {
            wrappedLines[wrappedLines.length - 1] += words[wordsIndex];
            curWidth += wordWidth;
            wordsIndex++;
            // Only append a space if we wouldn't go over maxWidth
            // and we haven't appended the last word yet.
            if (
              curWidth + spaceWidth <= maxWidth &&
              wordsIndex < words.length
            ) {
              wrappedLines[wrappedLines.length - 1] += " ";
              curWidth += spaceWidth;
            } else {
              break;
            }
          } else {
            break;
          }
        }
        const toWrap = words.slice(wordsIndex).join(" ").trimStart();
        if (toWrap !== "") {
          wrappedLines.push(
            ...wrapText(toWrap, font, containerWidth).split("\n"),
          );
          // Set curWidth to the width of the last wrapped line
          curWidth = getTextWidth(wrappedLines[wrappedLines.length - 1], font);
          // This means wrapText() caused us to start a new line
          if (curWidth === 0) {
            nlByText = true;
          }
        }
      }
    }
    if (isMathJaxLoaded) {
      wrappedMathCache[mathLineKey] = wrappedLines
        .slice(currLineNum)
        .join("\n");
    }
  }

  if (wrappedLines[0] === "") {
    wrappedLines.splice(0, 1);
  }
  return wrappedLines.join("\n");
} as SubtypeMethods["wrapText"];

const ensureMathJaxLoaded = async function (callback) {
  await loadMathJax();
  if (callback) {
    callback();
  }
} as SubtypeMethods["ensureLoaded"];

const enableActionChangeMathProps = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  app: AppClassProperties,
) => {
  const eligibleElements = getSelectedMathElements(elements, appState, app);

  let enabled = false;
  eligibleElements.forEach((element) => {
    if (
      isMathElement(element) ||
      (hasBoundTextElement(element) &&
        isMathElement(
          getBoundTextElement(
            element,
            app.scene.getElementsMapIncludingDeleted(),
          ),
        ))
    ) {
      enabled = true;
    }
  });

  if (
    appState.activeTool.type === "text" &&
    appState.activeSubtypes &&
    appState.activeSubtypes.includes(mathSubtype)
  ) {
    enabled = true;
  }
  return enabled;
};

const createMathActions = () => {
  const mathActions: Action[] = [];
  const actionUseTexTrue: Action = {
    name: makeCustomActionName("useTexTrue"),
    perform: (elements, appState) => {
      const mathOnly = getMathProps.getMathOnly(appState);
      const customData = appState.customData ?? {};
      customData[`${mathSubtype}`] = { useTex: true, mathOnly };
      return {
        elements,
        appState: { ...appState, customData },
        storeAction: "capture",
      };
    },
    label: (elements, appState) =>
      getMathProps.getUseTex(appState)
        ? "labels.useTexTrueActive"
        : "labels.useTexTrueInactive",
    predicate: (...rest) => rest.length < 5 || rest[4]?.subtype === mathSubtype,
    trackEvent: false,
  };
  const actionUseTexFalse: Action = {
    name: makeCustomActionName("useTexFalse"),
    perform: (elements, appState) => {
      const mathOnly = getMathProps.getMathOnly(appState);
      const customData = appState.customData ?? {};
      customData[`${mathSubtype}`] = { useTex: false, mathOnly };
      return {
        elements,
        appState: { ...appState, customData },
        storeAction: "capture",
      };
    },
    label: (elements, appState) =>
      !getMathProps.getUseTex(appState)
        ? "labels.useTexFalseActive"
        : "labels.useTexFalseInactive",
    predicate: (...rest) => rest.length < 5 || rest[4]?.subtype === mathSubtype,
    trackEvent: false,
  };
  const actionResetUseTex: Action = {
    name: makeCustomActionName("resetUseTex"),
    perform: (elements, appState, _, app) => {
      const useTex = getMathProps.getUseTex(appState);
      const modElements = changeProperty(
        elements,
        appState,
        (oldElement) => {
          if (
            isMathElement(oldElement) &&
            (oldElement.customData === undefined ||
              oldElement.customData.useTex !== useTex)
          ) {
            const newElement: ExcalidrawTextElement = newElementWith(
              oldElement,
              {
                customData: getMathProps.ensureMathProps({
                  useTex: useTex as boolean,
                  mathOnly: oldElement.customData?.mathOnly,
                }),
              },
            );
            redrawTextBoundingBox(
              newElement,
              getContainerElement(
                oldElement,
                app.scene.getElementsMapIncludingDeleted(),
              ),
              app.scene.getElementsMapIncludingDeleted(),
            );
            return newElement;
          }

          return oldElement;
        },
        true,
      );

      return {
        elements: modElements,
        storeAction: "capture",
      };
    },
    keyTest: (event) => event.shiftKey && event.code === "KeyR",
    label: "labels.resetUseTex",
    predicate: (elements, appState, _, app) => {
      const useTex = getMathProps.getUseTex(appState);
      const mathElements = getSelectedMathElements(elements, appState, app);
      return mathElements.some((el) => {
        const e = isMathElement(el)
          ? el
          : getBoundTextElement(
              el,
              app.scene.getElementsMapIncludingDeleted(),
            )!;
        return e.customData === undefined || e.customData.useTex !== useTex;
      });
    },
    trackEvent: false,
  };
  const actionChangeMathOnly: Action = {
    name: makeCustomActionName("changeMathOnly"),
    label: t("labels.changeMathOnly"),
    perform: (elements, appState, mathOnly: boolean | null, app) => {
      if (mathOnly === null) {
        mathOnly = getFormValue(
          elements,
          appState,
          (element) => {
            const el = hasBoundTextElement(element)
              ? getBoundTextElement(
                  element,
                  app.scene.getElementsMapIncludingDeleted(),
                )
              : element;
            return isMathElement(el) && el.customData?.mathOnly;
          },
          true,
          null,
        );
        if (mathOnly === null) {
          mathOnly = getMathProps.getMathOnly(appState);
        }
      }
      const modElements = changeProperty(
        elements,
        appState,
        (oldElement) => {
          if (isMathElement(oldElement)) {
            const customData = getMathProps.ensureMathProps({
              useTex: oldElement.customData?.useTex,
              mathOnly: mathOnly as boolean,
            });
            const newElement: ExcalidrawTextElement = newElementWith(
              oldElement,
              { customData },
            );
            redrawTextBoundingBox(
              newElement,
              getContainerElement(
                oldElement,
                app.scene.getElementsMapIncludingDeleted(),
              ),
              app.scene.getElementsMapIncludingDeleted(),
            );
            return newElement;
          }

          return oldElement;
        },
        true,
      );

      const useTex = getMathProps.getUseTex(appState);
      const customData = appState.customData ?? {};
      customData[`${mathSubtype}`] = { useTex, mathOnly };
      return {
        elements: modElements,
        appState: { ...appState, customData },
        storeAction: "capture",
      };
    },
    PanelComponent: ({ elements, appState, updateData, app }) => {
      const textIcon = (text: string, selected: boolean) => {
        const color = selected
          ? "var(--button-color, var(--color-primary-darker))"
          : "var(--button-color, var(--text-primary-color))";
        return (
          <div className="buttonList">
            <span style={{ textAlign: "center", fontSize: "0.6rem", color }}>
              {text.replace(" ", "\n")}
            </span>
          </div>
        );
      };
      const value = getFormValue(
        elements,
        appState,
        (element) => {
          const el = hasBoundTextElement(element)
            ? getBoundTextElement(
                element,
                app.scene.getElementsMapIncludingDeleted(),
              )
            : element;
          return isMathElement(el)
            ? getMathProps.ensureMathProps(el.customData).mathOnly
            : null;
        },
        true,
        getMathProps.getMathOnly(appState),
      );
      return (
        <fieldset>
          <legend>{t("labels.changeMathOnly")}</legend>
          <ButtonIconSelect
            group="mathOnly"
            options={[
              {
                value: false,
                text: t("labels.mathOnlyFalse"),
                icon: textIcon(t("labels.mathOnlyFalse"), value === false),
              },
              {
                value: true,
                text: t("labels.mathOnlyTrue"),
                icon: textIcon(t("labels.mathOnlyTrue"), value === true),
              },
            ]}
            value={value}
            onChange={(value) => updateData(value)}
          />
        </fieldset>
      );
    },
    predicate: (...rest) =>
      rest[4] === undefined &&
      enableActionChangeMathProps(rest[0], rest[1], rest[3]),
    trackEvent: false,
  };
  const actionMath = SubtypeButton(mathSubtype, "text", mathSubtypeIcon, "M");
  mathActions.push(actionUseTexTrue);
  mathActions.push(actionUseTexFalse);
  mathActions.push(actionResetUseTex);
  mathActions.push(actionChangeMathOnly);
  mathActions.push(actionMath);
  return mathActions;
};

export const prepareMathSubtype = function (
  addSubtypeAction,
  addLangData,
  onSubtypeLoaded,
) {
  // Set the callback first just in case anything in this method
  // calls loadMathJax().
  mathJaxLoadedCallback = onSubtypeLoaded;

  const methods = {} as SubtypeMethods;
  methods.clean = cleanMathElementUpdate;
  methods.ensureLoaded = ensureMathJaxLoaded;
  methods.getEditorStyle = getMathEditorStyle;
  methods.measureText = measureMathElement;
  methods.render = renderMathElement;
  methods.renderSvg = renderSvgMathElement;
  methods.wrapText = wrapMathElement;
  const getLangData: LangLdr = (langCode) =>
    import(
      /* webpackChunkName: "locales/[request]" */ `./locales/${langCode}.json`
    );
  addLangData(fallbackMathJaxLangData, getLangData);
  registerCustomLangData(fallbackMathJaxLangData, getLangData);

  const actions = createMathActions();
  actions.forEach((action) => addSubtypeAction(action));
  // Call loadMathJax() here if we want to be sure it's loaded.

  return { actions, methods };
} as SubtypePrepFn;
