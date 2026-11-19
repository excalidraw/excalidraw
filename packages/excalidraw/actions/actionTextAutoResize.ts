import { getFontString, KEYS, matchKey } from "@excalidraw/common";
import { pointFrom, pointRotateRads } from "@excalidraw/math";

import {
  getElementBounds,
  getTextAnchorRatios,
  isBoundToContainer,
  isExcalidrawElement,
  isNonDeletedElement,
  newElementWith,
  updateBoundElements,
  wrapText,
} from "@excalidraw/element";
import { measureText } from "@excalidraw/element";

import { isTextElement } from "@excalidraw/element";

import { CaptureUpdateAction } from "@excalidraw/history";

import type { GlobalPoint } from "@excalidraw/math";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { getSelectedElements } from "../scene";

import { register } from "./register";

import type { AppClassProperties, AppState } from "../types";

/** the selected free texts (a container's text follows its container) */
const getSelectedFreeTexts = (
  elements: readonly ExcalidrawElement[],
  appState: Readonly<AppState>,
) =>
  getSelectedElements(elements, appState).filter(
    (element) => isTextElement(element) && !isBoundToContainer(element),
  );

/**
 * Room past its text for a text made to keep its width (px). One exactly as
 * wide as its longest line is on the verge of wrapping, and Chrome lays the
 * editor's text out in 1/64px steps, rounding each run of it up — a line
 * being split into more runs as it's edited. The line can so come out a hair
 * wider there than measured here, and wrap in the editor alone.
 */
const KEPT_TEXT_WIDTH_SLACK = 1;

/**
 * The text with auto-resizing toggled: growing with its content again,
 * unwrapped — or keeping its width (and some: see `KEPT_TEXT_WIDTH_SLACK`),
 * wrapping at it, which is at most the width a typed text stops growing at
 * (see `AppText.getMaxTextWidth()`), even for a text already wider.
 */
const toggleTextAutoResize = (
  text: ExcalidrawTextElement,
  autoResize: boolean,
  app: AppClassProperties,
) => {
  const font = getFontString(text);
  const width = autoResize
    ? null
    : Math.min(
        text.width + KEPT_TEXT_WIDTH_SLACK,
        app.text.getMaxTextWidth(
          app.text.getTextViewportOffsets(
            getElementBounds(text, app.scene.getNonDeletedElementsMap()),
          ),
        ),
      );
  const nextText =
    width === null
      ? text.originalText
      : wrapText(text.originalText, font, width, app.renderEnvironment);
  const metrics = measureText(
    nextText,
    font,
    text.lineHeight,
    app.renderEnvironment,
  );
  const nextWidth = width ?? metrics.width;

  // (un)wrapping resizes the box, so keep the point the text's alignment pins
  // — otherwise a right-aligned or centred text slides sideways, and one
  // bound to an arrow endpoint drags the arrow with it. Keep it where it is
  // on the canvas, that is: a rotated text turns about the center of its
  // box, which the resize moves.
  const anchor = getTextAnchorRatios(text);
  /** the anchor from the center of a box of the given size, rotated */
  const getAnchorOffset = (width: number, height: number) =>
    pointRotateRads(
      pointFrom<GlobalPoint>(
        width * (anchor.x - 0.5),
        height * (anchor.y - 0.5),
      ),
      pointFrom<GlobalPoint>(0, 0),
      text.angle,
    );
  const [offsetX, offsetY] = getAnchorOffset(text.width, text.height);
  const [nextOffsetX, nextOffsetY] = getAnchorOffset(nextWidth, metrics.height);

  return newElementWith(text, {
    autoResize,
    width: nextWidth,
    height: metrics.height,
    x: text.x + (text.width - nextWidth) / 2 + offsetX - nextOffsetX,
    y: text.y + (text.height - metrics.height) / 2 + offsetY - nextOffsetY,
    text: nextText,
  });
};

export const isTextAutoResizeShortcut = (
  event: KeyboardEvent | React.KeyboardEvent<Element>,
) =>
  event.altKey &&
  !event[KEYS.CTRL_OR_CMD] &&
  !event.shiftKey &&
  matchKey(event, KEYS.W);

export const actionTextAutoResize = register({
  name: "autoResize",
  label: "labels.autoResize",
  icon: null,
  trackEvent: { category: "element" },
  predicate: (elements, appState, _: unknown) => {
    const selectedElements = getSelectedElements(elements, appState);
    return (
      selectedElements.length === 1 &&
      isTextElement(selectedElements[0]) &&
      !selectedElements[0].autoResize
    );
  },
  /**
   * Toggles auto-resizing of the given text (e.g. the one being edited), or
   * else of the selected free texts: on if any of them wraps, else off.
   */
  perform: (elements, appState, targetElement, app) => {
    const targetIds = new Set(
      (isExcalidrawElement(targetElement) &&
      isTextElement(targetElement) &&
      !isBoundToContainer(targetElement)
        ? [targetElement]
        : getSelectedFreeTexts(elements, appState)
      ).map((element) => element.id),
    );
    const targets = elements.filter(
      (element) => targetIds.has(element.id) && isTextElement(element),
    ) as ExcalidrawTextElement[];

    if (!targets.length) {
      return false;
    }

    const autoResize = targets.some((text) => !text.autoResize);
    const toggled = new Map(
      targets
        .filter((text) => text.autoResize !== autoResize)
        .map((text) => [text.id, toggleTextAutoResize(text, autoResize, app)]),
    );

    // the anchor only pins one point of the box, so any other arrow bound to
    // a text still has to be re-routed to its new geometry. The scene holds
    // the texts as they were, hence handing the new ones over explicitly.
    for (const text of toggled.values()) {
      if (isNonDeletedElement(text)) {
        updateBoundElements(text, app.scene, {
          changedElements: new Map([[text.id, text]]),
          renderEnvironment: app.renderEnvironment,
        });
      }
    }

    return {
      appState,
      elements: elements.map((element) => toggled.get(element.id) ?? element),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  keyTest: (event, appState, elements) =>
    isTextAutoResizeShortcut(event) &&
    getSelectedFreeTexts(elements, appState).length > 0,
});
