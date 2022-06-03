import { BOUND_TEXT_PADDING, SVG_NS, VERTICAL_ALIGN } from "../../constants";
import { getFontFamilyString, getFontString, isRTL } from "../../utils";
import { ExcalidrawTextElement, NonDeleted } from "../../element/types";
import { ElementUpdate } from "../../element/mutateElement";
import {
  getApproxLineHeight,
  measureText,
  wrapText,
} from "../../element/textElement";
import {
  registerTextLikeDisabledPanelComponents,
  registerTextLikeMethod,
  registerTextLikeShortcutNames,
  registerTextLikeSubtypeName,
} from "../";

import { TEXT_SUBTYPE_DEFAULT } from "../types";

import {
  isTextShortcutNameText,
  TextOptsText,
  TextShortcutNameText,
} from "./types";

const textShortcutMap: Record<TextShortcutNameText, string[]> = { "": [""] };

type ExcalidrawTextElementText = ExcalidrawTextElement &
  Readonly<{
    subtype: typeof TEXT_SUBTYPE_DEFAULT;
  }>;

const cleanTextElementUpdateText = (
  updates: ElementUpdate<ExcalidrawTextElementText>,
): ElementUpdate<ExcalidrawTextElementText> => {
  const newUpdates = {};
  for (const key in updates) {
    if (key === "textOpts") {
      (newUpdates as any)[key] = {};
    } else {
      (newUpdates as any)[key] = (updates as any)[key];
    }
  }
  return newUpdates;
};

const measureTextElementText = (
  element: Omit<
    ExcalidrawTextElementText,
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
    textOpts?: TextOptsText;
  },
  maxWidth?: number | null,
) => {
  const fontSize =
    next?.fontSize !== undefined ? next.fontSize : element.fontSize;
  const text = next?.text !== undefined ? next.text : element.text;

  return measureText(
    text,
    getFontString({ fontSize, fontFamily: element.fontFamily }),
    maxWidth,
  );
};

const renderTextElementText = (
  element: NonDeleted<ExcalidrawTextElementText>,
  context: CanvasRenderingContext2D,
  renderCb?: () => void,
) => {
  const rtl = isRTL(element.text);
  context.canvas.setAttribute("dir", rtl ? "rtl" : "ltr");
  context.save();
  context.font = getFontString(element);
  context.fillStyle = element.strokeColor;
  context.textAlign = element.textAlign as CanvasTextAlign;

  // Canvas does not support multiline text by default
  const lines = element.text.replace(/\r\n?/g, "\n").split("\n");
  const lineHeight = element.containerId
    ? getApproxLineHeight(getFontString(element))
    : element.height / lines.length;
  let verticalOffset = element.height - element.baseline;
  if (element.verticalAlign === VERTICAL_ALIGN.BOTTOM) {
    verticalOffset = BOUND_TEXT_PADDING;
  }

  const horizontalOffset =
    element.textAlign === "center"
      ? element.width / 2
      : element.textAlign === "right"
      ? element.width
      : 0;
  for (let index = 0; index < lines.length; index++) {
    context.fillText(
      lines[index],
      horizontalOffset,
      (index + 1) * lineHeight - verticalOffset,
    );
  }
  context.restore();
};

const renderSvgTextElementText = (
  svgRoot: SVGElement,
  node: SVGElement,
  element: NonDeleted<ExcalidrawTextElementText>,
): void => {
  const lines = element.text.replace(/\r\n?/g, "\n").split("\n");
  const lineHeight = element.height / lines.length;
  const verticalOffset = element.height - element.baseline;
  const horizontalOffset =
    element.textAlign === "center"
      ? element.width / 2
      : element.textAlign === "right"
      ? element.width
      : 0;
  const direction = isRTL(element.text) ? "rtl" : "ltr";
  const textAnchor =
    element.textAlign === "center"
      ? "middle"
      : element.textAlign === "right" || direction === "rtl"
      ? "end"
      : "start";
  for (let i = 0; i < lines.length; i++) {
    const text = svgRoot.ownerDocument!.createElementNS(SVG_NS, "text");
    text.textContent = lines[i];
    text.setAttribute("x", `${horizontalOffset}`);
    text.setAttribute("y", `${(i + 1) * lineHeight - verticalOffset}`);
    text.setAttribute("font-family", getFontFamilyString(element));
    text.setAttribute("font-size", `${element.fontSize}px`);
    text.setAttribute("fill", element.strokeColor);
    text.setAttribute("text-anchor", textAnchor);
    text.setAttribute("style", "white-space: pre;");
    text.setAttribute("direction", direction);
    node.appendChild(text);
  }
};

const restoreTextElementText = (
  element: ExcalidrawTextElement,
  elementRestored: ExcalidrawTextElement,
): ExcalidrawTextElement => {
  return elementRestored;
};

export const wrapTextElementText = (
  element: Omit<
    ExcalidrawTextElementText,
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
    textOpts?: TextOptsText;
  },
): string => {
  const fontSize =
    next?.fontSize !== undefined ? next.fontSize : element.fontSize;
  const text = next?.text !== undefined ? next.text : element.originalText;

  return wrapText(
    text,
    getFontString({ fontSize, fontFamily: element.fontFamily }),
    containerWidth,
  );
};

export const registerTextElementSubtype = (
  onSubtypesLoaded?: (isTextElementSubtype: Function) => void,
) => {
  registerTextLikeShortcutNames(textShortcutMap, isTextShortcutNameText);
  registerTextLikeSubtypeName(TEXT_SUBTYPE_DEFAULT);
  registerTextLikeDisabledPanelComponents(TEXT_SUBTYPE_DEFAULT, []);
  registerTextLikeMethod("clean", {
    subtype: TEXT_SUBTYPE_DEFAULT,
    method: cleanTextElementUpdateText,
    default: true,
  });
  registerTextLikeMethod("measure", {
    subtype: TEXT_SUBTYPE_DEFAULT,
    method: measureTextElementText,
    default: true,
  });
  registerTextLikeMethod("render", {
    subtype: TEXT_SUBTYPE_DEFAULT,
    method: renderTextElementText,
    default: true,
  });
  registerTextLikeMethod("renderSvg", {
    subtype: TEXT_SUBTYPE_DEFAULT,
    method: renderSvgTextElementText,
    default: true,
  });
  registerTextLikeMethod("restore", {
    subtype: TEXT_SUBTYPE_DEFAULT,
    method: restoreTextElementText,
    default: true,
  });
  registerTextLikeMethod("wrap", {
    subtype: TEXT_SUBTYPE_DEFAULT,
    method: wrapTextElementText,
    default: true,
  });
};
