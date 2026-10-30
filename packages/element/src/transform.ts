import {
  clamp,
  isFiniteNumber,
  pointFrom,
  PRECISION,
  vectorFromPoint,
  vectorNormalize,
  type GlobalPoint,
  type LocalPoint,
  type Radians,
} from "@excalidraw/math";

import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  TEXT_ALIGN,
  VERTICAL_ALIGN,
  getSizeFromPoints,
  randomId,
  arrayToMap,
  assertNever,
  cloneJSON,
  getFontString,
  getUpdatedTimestamp,
  isDevEnv,
  toBrandedType,
  getLineHeight,
  DEFAULT_STICKY_NOTE_SIZE,
  isTransparent,
  DEFAULT_ZOOM,
} from "@excalidraw/common";

import type { MarkOptional } from "@excalidraw/common/utility-types";
import type { Zoom } from "@excalidraw/excalidraw/types";

import {
  bindBindingElement,
  bindBindingElementToFixedPoint,
  calculateFixedPointForNonElbowArrowBinding,
  getBoundEndExtension,
  isEndBoundBeyondBindingArea,
  unbindBindingElement,
  updateBoundArrow,
} from "./binding";
import {
  newArrowElement,
  newElement,
  newEmbeddableElement,
  newFrameElement,
  newFreeDrawElement,
  newIframeElement,
  newImageElement,
  newLinearElement,
  newMagicFrameElement,
  newTextElement,
  type ElementConstructorOpts,
  newStickyNoteElement,
  normalizeStickyNoteGeometry,
} from "./newElement";
import { normalizeStickyNoteStrokeColor } from "./stickyNote";
import { measureText, normalizeText } from "./textMeasurements";
import {
  isArrowElement,
  isBindableElement,
  isElbowArrow,
  isStickyNoteElement,
} from "./typeChecks";

import { syncInvalidIndices } from "./fractionalIndex";

import {
  DEFAULT_BOUND_TEXT_LABEL_POSITION,
  getBoundTextElement,
  redrawTextBoundingBox,
} from "./textElement";

import { LinearElementEditor } from "./linearElementEditor";

import { getArrowheadSize, getCommonBounds } from "./bounds";

import { Scene } from "./Scene";

import type { RenderEnvironment } from "./renderEnvironment";

import type {
  Arrowhead,
  ElementsMap,
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  ExcalidrawElement,
  ExcalidrawFrameElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawGenericElement,
  ExcalidrawIframeLikeElement,
  ExcalidrawImageElement,
  ExcalidrawLinearElement,
  ExcalidrawMagicFrameElement,
  ExcalidrawSelectionElement,
  ExcalidrawTextElement,
  FileId,
  FontFamilyValues,
  NonDeleted,
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
  Ordered,
  PointsPositionUpdates,
  TextAlign,
  VerticalAlign,
  ExcalidrawStickyNoteElement,
} from "./types";

/**
 * Options for elements generated from a skeleton fragment (bound labels and
 * binding endpoints). Such elements are always constructed fresh, hence they
 * never carry a creation time of their own.
 */
type FragmentConstructorOpts = MarkOptional<
  Omit<ElementConstructorOpts, "created">,
  "x" | "y"
>;

export type ValidLinearElement = {
  type: "arrow" | "line";
  x: number;
  y: number;
  label?: {
    text: string;
    fontSize?: number;
    fontFamily?: FontFamilyValues;
    textAlign?: TextAlign;
    verticalAlign?: VerticalAlign;
    /** where along an arrow's path (0-1) the label is centered */
    labelPosition?: ExcalidrawTextElement["labelPosition"];
  } & FragmentConstructorOpts;
  end?:
    | (
        | (
            | {
                type: Exclude<
                  ExcalidrawBindableElement["type"],
                  | "image"
                  | "text"
                  | "frame"
                  | "magicframe"
                  | "embeddable"
                  | "iframe"
                >;
                id?: ExcalidrawGenericElement["id"];
              }
            | {
                id: ExcalidrawGenericElement["id"];
                type?: Exclude<
                  ExcalidrawBindableElement["type"],
                  | "image"
                  | "text"
                  | "frame"
                  | "magicframe"
                  | "embeddable"
                  | "iframe"
                >;
              }
          )
        | ((
            | {
                type: "text";
                text: string;
              }
            | {
                type?: "text";
                id: ExcalidrawTextElement["id"];
                text: string;
              }
          ) &
            Partial<Omit<ExcalidrawTextElement, "created">>)
      ) &
        FragmentConstructorOpts;
  start?:
    | (
        | (
            | {
                type: Exclude<
                  ExcalidrawBindableElement["type"],
                  | "image"
                  | "text"
                  | "frame"
                  | "magicframe"
                  | "embeddable"
                  | "iframe"
                >;
                id?: ExcalidrawGenericElement["id"];
              }
            | {
                id: ExcalidrawGenericElement["id"];
                type?: Exclude<
                  ExcalidrawBindableElement["type"],
                  | "image"
                  | "text"
                  | "frame"
                  | "magicframe"
                  | "embeddable"
                  | "iframe"
                >;
              }
          )
        | ((
            | {
                type: "text";
                text: string;
              }
            | {
                type?: "text";
                id: ExcalidrawTextElement["id"];
                text: string;
              }
          ) &
            Partial<Omit<ExcalidrawTextElement, "created">>)
      ) &
        FragmentConstructorOpts;
} & Partial<ExcalidrawLinearElement>;

export type ValidContainer =
  | {
      type: Exclude<ExcalidrawGenericElement["type"], "selection">;
      id?: ExcalidrawGenericElement["id"];
      label?: {
        text: string;
        fontSize?: number;
        fontFamily?: FontFamilyValues;
        textAlign?: TextAlign;
        verticalAlign?: VerticalAlign;
      } & FragmentConstructorOpts;
    } & ElementConstructorOpts;

/**
 * A sticky note: an always-filled note whose label auto-fits. `label.fontSize`
 * is the font ceiling the fit shrinks from; the note grows past its height
 * (kept as `baseHeight`) only once the label hits the minimum font size.
 */
export type ValidStickyNote = {
  type: "stickynote";
  id?: ExcalidrawStickyNoteElement["id"];
  label?: Extract<ValidContainer, { label?: unknown }>["label"];
} & ElementConstructorOpts &
  Partial<Pick<ExcalidrawStickyNoteElement, "baseHeight">>;

export type ExcalidrawElementSkeleton =
  | Extract<
      Exclude<ExcalidrawElement, ExcalidrawSelectionElement>,
      ExcalidrawIframeLikeElement | ExcalidrawFreeDrawElement
    >
  | ({
      type: Extract<ExcalidrawLinearElement["type"], "line">;
      x: number;
      y: number;
    } & Partial<ExcalidrawLinearElement>)
  | ValidContainer
  | ValidStickyNote
  | ValidLinearElement
  | ({
      type: "text";
      text: string;
      x: number;
      y: number;
      id?: ExcalidrawTextElement["id"];
    } & Partial<ExcalidrawTextElement>)
  | ({
      type: Extract<ExcalidrawImageElement["type"], "image">;
      x: number;
      y: number;
      fileId: FileId;
    } & Partial<ExcalidrawImageElement>)
  | ({
      type: "frame";
      children: readonly ExcalidrawElement["id"][];
      name?: string;
    } & Partial<ExcalidrawFrameElement>)
  | ({
      type: "magicframe";
      children: readonly ExcalidrawElement["id"][];
      name?: string;
    } & Partial<ExcalidrawMagicFrameElement>);

const DEFAULT_LINEAR_ELEMENT_PROPS = {
  width: 100,
  height: 0,
};

const DEFAULT_DIMENSION = 100;

const bindTextToContainer = (
  container: ExcalidrawElement,
  textProps: { text: string } & FragmentConstructorOpts &
    Pick<Partial<ExcalidrawTextElement>, "labelPosition">,
  scene: Scene,
  renderEnvironment?: RenderEnvironment,
) => {
  // a note and its label share one ink: a label that sets its own color
  // gives it to the note (the footer paints with it); transparent falls
  // back to the note's
  const stickyInk = isStickyNoteElement(container)
    ? normalizeStickyNoteStrokeColor(
        textProps.strokeColor && !isTransparent(textProps.strokeColor)
          ? textProps.strokeColor
          : container.strokeColor,
      )
    : null;
  const textElement: ExcalidrawTextElement = newTextElement({
    x: 0,
    y: 0,
    textAlign: TEXT_ALIGN.CENTER,
    verticalAlign: VERTICAL_ALIGN.MIDDLE,
    ...textProps,
    containerId: container.id,
    strokeColor: stickyInk ?? (textProps.strokeColor || container.strokeColor),
    // normalized as `restore` does
    labelPosition: isArrowElement(container)
      ? isFiniteNumber(textProps.labelPosition)
        ? clamp(textProps.labelPosition, 0, 1)
        : DEFAULT_BOUND_TEXT_LABEL_POSITION
      : null,
    // normalized as `restore` does: arrow labels aren't rotated
    ...(isArrowElement(container) && { angle: 0 as Radians }),
    renderEnvironment,
  });

  Object.assign(container, {
    boundElements: (container.boundElements || []).concat({
      type: "text",
      id: textElement.id,
    }),
    ...(stickyInk && stickyInk !== container.strokeColor
      ? { strokeColor: stickyInk }
      : null),
  });

  // the caller measures an arrow's label once, along its arrow as placed
  // (binding shortens a bound one)
  if (!isArrowElement(container)) {
    redrawTextBoundingBox(textElement, container, scene, renderEnvironment);
  }

  return [container, textElement] as const;
};

// where to create a shape for an arrow end: centered on its end segment as
// extended past the end, with the end on its outline, so the arrow points
// into it (left to right if the segment has no length)
const getArrowEndShapePosition = (
  arrow: ExcalidrawLinearElement,
  startOrEnd: "start" | "end",
  type: ExcalidrawElement["type"] | undefined,
  width: number,
  height: number,
) => {
  const { points } = arrow;
  const [endPoint, nextPoint] =
    startOrEnd === "start"
      ? [points[0], points[1]]
      : [points[points.length - 1], points[points.length - 2]];
  let dx = nextPoint ? endPoint[0] - nextPoint[0] : 0;
  let dy = nextPoint ? endPoint[1] - nextPoint[1] : 0;
  const length = Math.hypot(dx, dy);
  if (length) {
    dx /= length;
    dy /= length;
  } else {
    dx = startOrEnd === "start" ? -1 : 1;
  }

  // from the center to the outline, along the segment
  const a = width / 2;
  const b = height / 2;
  let distance;
  if (type === "ellipse" || type === "diamond") {
    const denominator =
      type === "ellipse"
        ? Math.hypot(b * dx, a * dy)
        : b * Math.abs(dx) + a * Math.abs(dy);
    distance = denominator ? (a * b) / denominator : 0;
  } else {
    distance = Math.min(
      dx ? a / Math.abs(dx) : Infinity,
      dy ? b / Math.abs(dy) : Infinity,
    );
  }

  return {
    x: arrow.x + endPoint[0] + dx * distance - a,
    y: arrow.y + endPoint[1] + dy * distance - b,
  };
};

const bindLinearElementToElement = (
  linearElement: NonDeleted<ExcalidrawArrowElement>,
  start: ValidLinearElement["start"],
  end: ValidLinearElement["end"],
  elementStore: ElementStore,
  scene: Scene,
  zoom: Zoom,
  renderEnvironment?: RenderEnvironment,
): {
  linearElement: ExcalidrawLinearElement;
  startBoundElement?: ExcalidrawElement;
  endBoundElement?: ExcalidrawElement;
} => {
  let startBoundElement;
  let endBoundElement;

  Object.assign(linearElement, {
    startBinding: linearElement?.startBinding || null,
    endBinding: linearElement.endBinding || null,
  });

  if (start) {
    const width = start?.width ?? DEFAULT_DIMENSION;
    const height = start?.height ?? DEFAULT_DIMENSION;

    let existingElement;
    if (start.id) {
      existingElement = elementStore.getElement(start.id);
      if (!existingElement) {
        console.error(`No element for start binding with id ${start.id} found`);
      }
    }

    const startType = existingElement ? existingElement.type : start.type;
    const startPosition = getArrowEndShapePosition(
      linearElement,
      "start",
      startType,
      width,
      height,
    );
    const startX = start.x || startPosition.x;
    const startY = start.y || startPosition.y;

    if (startType) {
      if (startType === "text") {
        let text = "";
        if (existingElement && existingElement.type === "text") {
          text = existingElement.text;
        } else if (start.type === "text") {
          text = start.text;
        }
        if (!text) {
          console.error(
            `No text found for start binding text element for ${linearElement.id}`,
          );
        }
        startBoundElement = newTextElement({
          x: startX,
          y: startY,
          type: "text",
          ...existingElement,
          ...start,
          text,
          renderEnvironment,
        });
        // to position the text correctly when coordinates not provided
        const position = getArrowEndShapePosition(
          linearElement,
          "start",
          "text",
          startBoundElement.width,
          startBoundElement.height,
        );
        Object.assign(startBoundElement, {
          x: start.x || position.x,
          y: start.y || position.y,
        });
      } else {
        switch (startType) {
          case "rectangle":
          case "ellipse":
          case "diamond": {
            startBoundElement = newElement({
              x: startX,
              y: startY,
              width,
              height,
              ...existingElement,
              ...start,
              type: startType,
            });
            break;
          }
          default: {
            assertNever(
              linearElement as never,
              `Unhandled element start type "${start.type}"`,
              true,
            );
          }
        }
      }

      bindBindingElement(
        linearElement,
        startBoundElement as NonDeleted<ExcalidrawBindableElement>,
        "orbit",
        "start",
        scene,
        zoom,
      );
    }
  }
  if (end) {
    const height = end?.height ?? DEFAULT_DIMENSION;
    const width = end?.width ?? DEFAULT_DIMENSION;

    let existingElement;
    if (end.id) {
      existingElement = elementStore.getElement(end.id);
      if (!existingElement) {
        console.error(`No element for end binding with id ${end.id} found`);
      }
    }
    const endType = existingElement ? existingElement.type : end.type;
    const endPosition = getArrowEndShapePosition(
      linearElement,
      "end",
      endType,
      width,
      height,
    );
    const endX = end.x || endPosition.x;
    const endY = end.y || endPosition.y;

    if (endType) {
      if (endType === "text") {
        let text = "";
        if (existingElement && existingElement.type === "text") {
          text = existingElement.text;
        } else if (end.type === "text") {
          text = end.text;
        }

        if (!text) {
          console.error(
            `No text found for end binding text element for ${linearElement.id}`,
          );
        }
        endBoundElement = newTextElement({
          x: endX,
          y: endY,
          type: "text",
          ...existingElement,
          ...end,
          text,
          renderEnvironment,
        });
        // to position the text correctly when coordinates not provided
        const position = getArrowEndShapePosition(
          linearElement,
          "end",
          "text",
          endBoundElement.width,
          endBoundElement.height,
        );
        Object.assign(endBoundElement, {
          // an existing text keeps its x, as it always has
          x: end.x || (existingElement ? endBoundElement.x : position.x),
          y: end.y || position.y,
        });
      } else {
        switch (endType) {
          case "rectangle":
          case "ellipse":
          case "diamond": {
            endBoundElement = newElement({
              x: endX,
              y: endY,
              width,
              height,
              ...existingElement,
              ...end,
              type: endType,
            });
            break;
          }
          default: {
            assertNever(
              linearElement as never,
              `Unhandled element end type "${endType}"`,
              true,
            );
          }
        }
      }

      bindBindingElement(
        linearElement,
        endBoundElement as NonDeleted<ExcalidrawBindableElement>,
        "orbit",
        "end",
        scene,
        zoom,
      );
    }
  }

  return {
    linearElement,
    startBoundElement,
    endBoundElement,
  };
};

class ElementStore {
  excalidrawElements = new Map<string, ExcalidrawElement>();

  add = (ele?: ExcalidrawElement) => {
    if (!ele) {
      return;
    }

    this.excalidrawElements.set(ele.id, ele);
  };

  getElements = () => {
    // programmatically created elements are always non-deleted
    return syncInvalidIndices(
      Array.from(this.excalidrawElements.values()),
    ) as Ordered<NonDeletedExcalidrawElement>[];
  };

  getElementsMap = () => {
    return toBrandedType<NonDeletedSceneElementsMap>(
      arrayToMap(this.getElements()),
    );
  };

  getElement = (id: string) => {
    return this.excalidrawElements.get(id);
  };
}

// a label point on a stretch placing trimmed off its arrow projects onto the
// arrow's end, centering the label on its endpoint (or arrowhead): keep it as
// close to there as it can be while clear of them
const clampLabelPositionOffEnds = (
  arrow: ExcalidrawArrowElement,
  label: ExcalidrawTextElement,
  labelPosition: number,
  elementsMap: ElementsMap,
) => {
  // on the arrow as placed: keep it where it was put, as on unplaced arrows
  if (labelPosition > PRECISION && labelPosition < 1 - PRECISION) {
    return labelPosition;
  }
  const length = LinearElementEditor.getPathLength(arrow, elementsMap);
  // how far the label's center has to stay from the end leaving `from` for
  // `to`: half the label along the arrow there, past its arrowhead
  const margin = (
    from: LocalPoint,
    to: LocalPoint,
    arrowhead: Arrowhead | null,
  ) => {
    const [dx, dy] = vectorNormalize(vectorFromPoint(to, from));
    return (
      (Math.abs(dx) * label.width + Math.abs(dy) * label.height) / 2 +
      (arrowhead ? getArrowheadSize(arrowhead) : 0)
    );
  };
  const { points } = arrow;
  const min = margin(points[0], points[1], arrow.startArrowhead) / length;
  const max =
    1 -
    margin(
      points[points.length - 1],
      points[points.length - 2],
      arrow.endArrowhead,
    ) /
      length;

  // too short to clear both ends: as close to both as it can be
  return min < max ? clamp(labelPosition, min, max) : 0.5;
};

export const convertToExcalidrawElements = (
  elementsSkeleton: ExcalidrawElementSkeleton[] | null,
  opts?: { regenerateIds?: boolean; renderEnvironment?: RenderEnvironment },
) => {
  if (!elementsSkeleton) {
    return [];
  }
  const elements = cloneJSON(elementsSkeleton);
  const elementStore = new ElementStore();
  const elementsWithIds = new Map<string, ExcalidrawElementSkeleton>();
  const oldToNewElementIdMap = new Map<string, string>();

  // Create individual elements
  // regenerated ids mean new instances, hence a fresh creation time as well
  const created = getUpdatedTimestamp();

  for (const element of elements) {
    let excalidrawElement: ExcalidrawElement;
    const originalId = element.id;
    if (opts?.regenerateIds !== false) {
      Object.assign(element, { id: randomId(), created });
    }

    switch (element.type) {
      case "rectangle":
      case "ellipse":
      case "diamond": {
        const width =
          element?.label?.text && element.width === undefined
            ? 0
            : element?.width || DEFAULT_DIMENSION;
        const height =
          element?.label?.text && element.height === undefined
            ? 0
            : element?.height || DEFAULT_DIMENSION;
        excalidrawElement = newElement({
          ...element,
          width,
          height,
        });

        break;
      }
      case "line": {
        const width = element.width || DEFAULT_LINEAR_ELEMENT_PROPS.width;
        const height = element.height || DEFAULT_LINEAR_ELEMENT_PROPS.height;
        excalidrawElement = newLinearElement({
          width,
          height,
          points: [pointFrom(0, 0), pointFrom(width, height)],
          ...element,
        });

        break;
      }
      case "arrow": {
        const width = element.width || DEFAULT_LINEAR_ELEMENT_PROPS.width;
        const height = element.height || DEFAULT_LINEAR_ELEMENT_PROPS.height;
        excalidrawElement = newArrowElement({
          width,
          height,
          endArrowhead: "arrow",
          points: [pointFrom(0, 0), pointFrom(width, height)],
          ...element,
          type: "arrow",
        });

        Object.assign(
          excalidrawElement,
          getSizeFromPoints(excalidrawElement.points),
        );
        break;
      }
      case "text": {
        const fontFamily = element?.fontFamily || DEFAULT_FONT_FAMILY;
        const fontSize = element?.fontSize || DEFAULT_FONT_SIZE;
        const lineHeight = element?.lineHeight || getLineHeight(fontFamily);
        const text = element.text ?? "";
        const normalizedText = normalizeText(text);
        const metrics = measureText(
          normalizedText,
          getFontString({ fontFamily, fontSize }),
          lineHeight,
          opts?.renderEnvironment,
        );

        excalidrawElement = newTextElement({
          width: metrics.width,
          height: metrics.height,
          fontFamily,
          fontSize,
          ...element,
          renderEnvironment: opts?.renderEnvironment,
        });
        break;
      }
      case "image": {
        excalidrawElement = newImageElement({
          width: element?.width || DEFAULT_DIMENSION,
          height: element?.height || DEFAULT_DIMENSION,
          ...element,
        });

        break;
      }
      case "frame": {
        excalidrawElement = newFrameElement({
          x: 0,
          y: 0,
          ...element,
        });
        break;
      }
      case "magicframe": {
        excalidrawElement = newMagicFrameElement({
          x: 0,
          y: 0,
          ...element,
        });
        break;
      }
      case "freedraw": {
        excalidrawElement = newFreeDrawElement({ ...element });
        break;
      }
      case "iframe": {
        excalidrawElement = newIframeElement({ ...element });
        break;
      }
      case "stickynote": {
        const width = element.width || DEFAULT_STICKY_NOTE_SIZE;
        const height = element.height || DEFAULT_STICKY_NOTE_SIZE;
        // finalized geometry (min size, baseHeight ≤ height) — only a
        // pointer-down draft is exempt from it
        excalidrawElement = normalizeStickyNoteGeometry(
          newStickyNoteElement({
            ...element,
            type: "stickynote",
            width,
            height,
            baseHeight: element.baseHeight ?? height,
          }),
        );
        break;
      }
      case "embeddable": {
        excalidrawElement = newEmbeddableElement({ ...element });
        break;
      }

      default: {
        excalidrawElement = element;
        assertNever(
          element,
          `Unhandled element type "${(element as any).type}"`,
          true,
        );
      }
    }
    const existingElement = elementStore.getElement(excalidrawElement.id);
    if (existingElement) {
      console.error(`Duplicate id found for ${excalidrawElement.id}`);
    } else {
      elementStore.add(excalidrawElement);
      elementsWithIds.set(excalidrawElement.id, element);
      if (originalId) {
        oldToNewElementIdMap.set(originalId, excalidrawElement.id);
      }
    }
  }

  const elementsMap = elementStore.getElementsMap();
  // we don't have a real scene, so we just use a temp scene to query and mutate
  // elements (a snapshot of the store: resynced below once the store is complete)
  const scene = new Scene(elementsMap);
  // where on the arrows as given their labels' `labelPosition` puts them
  const labelPoints = new Map<ExcalidrawTextElement["id"], GlobalPoint>();
  // arrow labels yet to be measured, along their arrows
  const unmeasuredArrowLabels = new Map<
    ExcalidrawTextElement["id"],
    [ExcalidrawArrowElement, ExcalidrawTextElement]
  >();

  // Add labels and arrow bindings
  for (const [id, element] of elementsWithIds) {
    const excalidrawElement = elementStore.getElement(id)!;

    switch (element.type) {
      case "rectangle":
      case "ellipse":
      case "diamond":
      case "stickynote":
      case "arrow": {
        if (element.label?.text) {
          // for a sticky note this runs the sticky fit (via
          // `redrawTextBoundingBox`): the label's font size becomes its ceiling
          let [container, text] = bindTextToContainer(
            excalidrawElement,
            element?.label,
            scene,
            opts?.renderEnvironment,
          );
          elementStore.add(container);
          elementStore.add(text);
          if (isArrowElement(container)) {
            unmeasuredArrowLabels.set(text.id, [container, text]);
          }

          // given or default alike: omitting it is the same as giving 0.5
          if (isArrowElement(container) && text.labelPosition != null) {
            const labelPoint = LinearElementEditor.getPointAtPathParameter(
              container,
              text.labelPosition,
              elementsMap,
            );
            if (labelPoint) {
              labelPoints.set(text.id, labelPoint);
            }
          }

          if (isArrowElement(container)) {
            const originalStart =
              element.type === "arrow" ? element?.start : undefined;
            const originalEnd =
              element.type === "arrow" ? element?.end : undefined;
            if (originalStart && originalStart.id) {
              const newStartId = oldToNewElementIdMap.get(originalStart.id);
              if (newStartId) {
                Object.assign(originalStart, { id: newStartId });
              }
            }
            if (originalEnd && originalEnd.id) {
              const newEndId = oldToNewElementIdMap.get(originalEnd.id);
              if (newEndId) {
                Object.assign(originalEnd, { id: newEndId });
              }
            }
            const { linearElement, startBoundElement, endBoundElement } =
              bindLinearElementToElement(
                container as NonDeleted<ExcalidrawArrowElement>,
                originalStart,
                originalEnd,
                elementStore,
                scene,
                DEFAULT_ZOOM,
                opts?.renderEnvironment,
              );
            container = linearElement;
            elementStore.add(linearElement);
            elementStore.add(startBoundElement);
            elementStore.add(endBoundElement);
          }
        } else {
          switch (element.type) {
            case "arrow": {
              const { start, end } = element;
              if (start && start.id) {
                const newStartId = oldToNewElementIdMap.get(start.id);
                Object.assign(start, { id: newStartId });
              }
              if (end && end.id) {
                const newEndId = oldToNewElementIdMap.get(end.id);
                Object.assign(end, { id: newEndId });
              }
              const { linearElement, startBoundElement, endBoundElement } =
                bindLinearElementToElement(
                  excalidrawElement as NonDeleted<ExcalidrawArrowElement>,
                  start,
                  end,
                  elementStore,
                  scene,
                  DEFAULT_ZOOM,
                  opts?.renderEnvironment,
                );

              elementStore.add(linearElement);
              elementStore.add(startBoundElement);
              elementStore.add(endBoundElement);
              break;
            }
          }
        }
        break;
      }
    }
  }

  // Excalidraw places the ends of bound arrows itself whenever it updates
  // their bindings (e.g. on undo/redo, or moving what they're bound to), so
  // place them now, or they'd move then (before sizing frames around them).
  // The store has gained the labels and the elements bound arrows were
  // created to bind to since the scene was built, so resync it first
  scene.replaceAllElements(elementStore.getElementsMap());
  const placedElementsMap = scene.getNonDeletedElementsMap();
  // arrows unbound below, by what they were bound to: they still connect it
  // (e.g. they're framed with it)
  const unboundArrowIds = new Map<ExcalidrawElement["id"], string[]>();
  for (const arrow of scene.getNonDeletedElements()) {
    if (!isArrowElement(arrow)) {
      continue;
    }
    // users can't (re)bind an end given (e.g. by a layout engine) beyond the
    // binding area of what it's bound to, so don't leave it bound there,
    // unless it just falls short of it: then extend it onto it. Decide for
    // both ends as given, as moving either end of an elbow arrow reroutes it
    // from both its bindings, which could move the other end onto its element
    const extendedEnds: PointsPositionUpdates = new Map();
    const extendedEndPoints = new Map<"start" | "end", GlobalPoint>();
    for (const startOrEnd of ["start", "end"] as const) {
      if (
        !isEndBoundBeyondBindingArea(
          arrow,
          startOrEnd,
          placedElementsMap,
          DEFAULT_ZOOM,
        )
      ) {
        continue;
      }
      const extendedEnd = getBoundEndExtension(
        arrow,
        startOrEnd,
        placedElementsMap,
      );
      if (extendedEnd) {
        extendedEndPoints.set(startOrEnd, extendedEnd);
        extendedEnds.set(startOrEnd === "start" ? 0 : arrow.points.length - 1, {
          point: LinearElementEditor.pointFromAbsoluteCoords(
            arrow,
            extendedEnd,
            placedElementsMap,
          ),
        });
        continue;
      }
      const elementId = unbindBindingElement(arrow, startOrEnd, scene);
      if (elementId) {
        unboundArrowIds.set(elementId, [
          ...(unboundArrowIds.get(elementId) ?? []),
          arrow.id,
        ]);
      }
    }
    if (extendedEnds.size) {
      // moving an end reroutes elbow arrows from both their bindings, which
      // may have been made before what they're bound to was sized (see below),
      // so rebind them first: extended ends where they're extended to
      if (isElbowArrow(arrow)) {
        for (const startOrEnd of ["start", "end"] as const) {
          const binding =
            startOrEnd === "start" ? arrow.startBinding : arrow.endBinding;
          const bindableElement =
            binding && placedElementsMap.get(binding.elementId);
          if (!bindableElement || !isBindableElement(bindableElement)) {
            continue;
          }
          const extendedEnd = extendedEndPoints.get(startOrEnd);
          if (extendedEnd) {
            bindBindingElementToFixedPoint(
              arrow,
              bindableElement,
              startOrEnd,
              calculateFixedPointForNonElbowArrowBinding(
                arrow,
                bindableElement,
                startOrEnd,
                placedElementsMap,
                extendedEnd,
              ).fixedPoint,
              scene,
            );
          } else {
            bindBindingElement(
              arrow,
              bindableElement,
              binding.mode,
              startOrEnd,
              scene,
              DEFAULT_ZOOM,
            );
          }
        }
      }
      // once unbound, so elbow arrows aren't rerouted to what they were
      // bound to
      LinearElementEditor.movePoints(arrow, scene, extendedEnds);
    }
    for (const startOrEnd of ["start", "end"] as const) {
      // it was bound before what it's bound to was sized if that came later
      // (e.g. to fit its label), so its fixed point may be off (e.g. the
      // center of a 0x0 element): rebind it against the element as sized
      const binding =
        startOrEnd === "start" ? arrow.startBinding : arrow.endBinding;
      const bindableElement =
        binding && placedElementsMap.get(binding.elementId);
      if (bindableElement && isBindableElement(bindableElement)) {
        bindBindingElement(
          arrow,
          bindableElement,
          binding.mode,
          startOrEnd,
          scene,
          DEFAULT_ZOOM,
        );
      }
    }
    if (
      ![arrow.startBinding, arrow.endBinding].some(
        (binding) => binding && placedElementsMap.has(binding.elementId),
      )
    ) {
      continue;
    }
    // also wraps and measures its label, along it as placed. Nothing it's
    // bound to moved, so it keeps its midpoints where given, even if it's
    // bound to one element at both ends
    updateBoundArrow(
      arrow,
      scene,
      placedElementsMap,
      opts?.renderEnvironment,
      false,
    );

    const label = getBoundTextElement(arrow, placedElementsMap);
    if (!label) {
      continue;
    }
    unmeasuredArrowLabels.delete(label.id);
    // placing an arrow shortens its path, so its label's `labelPosition` would
    // no longer put it where it was placed (e.g. by a layout engine)
    const labelPoint = labelPoints.get(label.id);
    if (labelPoint) {
      const labelPosition = LinearElementEditor.getPathParameterAtPoint(
        arrow,
        labelPoint,
        placedElementsMap,
      );
      if (labelPosition !== null) {
        scene.mutateElement(label, {
          labelPosition: clampLabelPositionOffEnds(
            arrow,
            label,
            labelPosition,
            placedElementsMap,
          ),
        });
      }
    }
    // the editor derives arrow labels' x/y from their arrows as it renders
    // them, but placing (and rewrapping) leaves them stale, and they're
    // returned as data, so store them where they're rendered
    scene.mutateElement(
      label,
      LinearElementEditor.getBoundTextElementPosition(
        arrow,
        label,
        placedElementsMap,
      ),
    );
  }
  // the labels of arrows not placed, along them as given
  for (const [arrow, label] of unmeasuredArrowLabels.values()) {
    redrawTextBoundingBox(label, arrow, scene, opts?.renderEnvironment);
  }

  // Once all the excalidraw elements are created, we can add frames since we
  // need to calculate coordinates and dimensions of frame which is possible after all
  // frame children are processed.
  for (const [id, element] of elementsWithIds) {
    if (element.type !== "frame" && element.type !== "magicframe") {
      continue;
    }
    const frame = elementStore.getElement(id);

    if (!frame) {
      throw new Error(`Excalidraw element with id ${id} doesn't exist`);
    }
    const childrenElements: ExcalidrawElement[] = [];

    element.children.forEach((id) => {
      const newElementId = oldToNewElementIdMap.get(id);
      if (!newElementId) {
        throw new Error(`Element with ${id} wasn't mapped correctly`);
      }

      const elementInFrame = elementStore.getElement(newElementId);
      if (!elementInFrame) {
        throw new Error(`Frame element with id ${newElementId} doesn't exist`);
      }
      Object.assign(elementInFrame, { frameId: frame.id });

      [
        ...(elementInFrame.boundElements ?? []).map(({ id }) => id),
        ...(unboundArrowIds.get(elementInFrame.id) ?? []),
      ].forEach((boundElementId) => {
        const ele = elementStore.getElement(boundElementId);
        if (!ele) {
          throw new Error(
            `Bound element with id ${boundElementId} doesn't exist`,
          );
        }
        Object.assign(ele, { frameId: frame.id });
        childrenElements.push(ele);
      });

      childrenElements.push(elementInFrame);
    });

    let [minX, minY, maxX, maxY] = getCommonBounds(childrenElements);

    const PADDING = 10;
    minX = minX - PADDING;
    minY = minY - PADDING;
    maxX = maxX + PADDING;
    maxY = maxY + PADDING;

    const frameX = frame?.x || minX;
    const frameY = frame?.y || minY;
    const frameWidth = frame?.width || maxX - minX;
    const frameHeight = frame?.height || maxY - minY;

    Object.assign(frame, {
      x: frameX,
      y: frameY,
      width: frameWidth,
      height: frameHeight,
    });
    if (
      isDevEnv() &&
      element.children.length &&
      (frame?.x || frame?.y || frame?.width || frame?.height)
    ) {
      console.info(
        "User provided frame attributes are being considered, if you find this inaccurate, please remove any of the attributes - x, y, width and height so frame coordinates and dimensions are calculated automatically",
      );
    }
  }

  return elementStore.getElements();
};
