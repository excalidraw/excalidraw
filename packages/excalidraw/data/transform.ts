import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  TEXT_ALIGN,
  VERTICAL_ALIGN,
} from "../constants";
import {
  getCommonBounds,
  newElement,
  newLinearElement,
  redrawTextBoundingBox,
} from "../element";
import { bindLinearElement } from "../element/binding";
import type { ElementConstructorOpts } from "../element/newElement";
import {
  newArrowElement,
  newFrameElement,
  newImageElement,
  newMagicFrameElement,
  newTextElement,
} from "../element/newElement";
import { measureText, normalizeText } from "../element/textElement";
import type {
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
  NonDeletedSceneElementsMap,
  TextAlign,
  VerticalAlign,
} from "../element/types";
import type { MarkOptional } from "../utility-types";
import {
  arrayToMap,
  assertNever,
  cloneJSON,
  getFontString,
  isDevEnv,
  toBrandedType,
} from "../utils";
import { getSizeFromPoints } from "../points";
import { randomId } from "../random";
import { syncInvalidIndices } from "../fractionalIndex";
import { getLineHeight } from "../fonts";
import { isArrowElement } from "../element/typeChecks";
import { pointFrom, type LocalPoint } from "../../math";

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
  } & MarkOptional<ElementConstructorOpts, "x" | "y">;
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
            Partial<ExcalidrawTextElement>)
      ) &
        MarkOptional<ElementConstructorOpts, "x" | "y">;
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
            Partial<ExcalidrawTextElement>)
      ) &
        MarkOptional<ElementConstructorOpts, "x" | "y">;
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
      } & MarkOptional<ElementConstructorOpts, "x" | "y">;
    } & ElementConstructorOpts;

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
  textProps: { text: string } & MarkOptional<ElementConstructorOpts, "x" | "y">,
  elementsMap: ElementsMap,
) => {
  const textElement: ExcalidrawTextElement = newTextElement({
    x: 0,
    y: 0,
    textAlign: TEXT_ALIGN.CENTER,
    verticalAlign: VERTICAL_ALIGN.MIDDLE,
    ...textProps,
    containerId: container.id,
    strokeColor: textProps.strokeColor || container.strokeColor,
  });

  Object.assign(container, {
    boundElements: (container.boundElements || []).concat({
      type: "text",
      id: textElement.id,
    }),
  });

  redrawTextBoundingBox(textElement, container, elementsMap);
  return [container, textElement] as const;
};

const bindLinearElementToElement = (
  linearElement: ExcalidrawArrowElement,
  start: ValidLinearElement["start"],
  end: ValidLinearElement["end"],
  elementStore: ElementStore,
  elementsMap: NonDeletedSceneElementsMap,
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

    const startX = start.x || linearElement.x - width;
    const startY = start.y || linearElement.y - height / 2;
    const startType = existingElement ? existingElement.type : start.type;

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
        });
        // to position the text correctly when coordinates not provided
        Object.assign(startBoundElement, {
          x: start.x || linearElement.x - startBoundElement.width,
          y: start.y || linearElement.y - startBoundElement.height / 2,
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

      bindLinearElement(
        linearElement,
        startBoundElement as ExcalidrawBindableElement,
        "start",
        elementsMap,
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
    const endX = end.x || linearElement.x + linearElement.width;
    const endY = end.y || linearElement.y - height / 2;
    const endType = existingElement ? existingElement.type : end.type;

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
        });
        // to position the text correctly when coordinates not provided
        Object.assign(endBoundElement, {
          y: end.y || linearElement.y - endBoundElement.height / 2,
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

      bindLinearElement(
        linearElement,
        endBoundElement as ExcalidrawBindableElement,
        "end",
        elementsMap,
      );
    }
  }

  // Safe check to early return for single point
  if (linearElement.points.length < 2) {
    return {
      linearElement,
      startBoundElement,
      endBoundElement,
    };
  }

  // Update start/end points by 0.5 so bindings don't overlap with start/end bound element coordinates.
  const endPointIndex = linearElement.points.length - 1;
  const delta = 0.5;

  const newPoints = cloneJSON<readonly LocalPoint[]>(linearElement.points);

  // left to right so shift the arrow towards right
  if (
    linearElement.points[endPointIndex][0] >
    linearElement.points[endPointIndex - 1][0]
  ) {
    newPoints[0][0] = delta;
    newPoints[endPointIndex][0] -= delta;
  }

  // right to left so shift the arrow towards left
  if (
    linearElement.points[endPointIndex][0] <
    linearElement.points[endPointIndex - 1][0]
  ) {
    newPoints[0][0] = -delta;
    newPoints[endPointIndex][0] += delta;
  }
  // top to bottom so shift the arrow towards top
  if (
    linearElement.points[endPointIndex][1] >
    linearElement.points[endPointIndex - 1][1]
  ) {
    newPoints[0][1] = delta;
    newPoints[endPointIndex][1] -= delta;
  }

  // bottom to top so shift the arrow towards bottom
  if (
    linearElement.points[endPointIndex][1] <
    linearElement.points[endPointIndex - 1][1]
  ) {
    newPoints[0][1] = -delta;
    newPoints[endPointIndex][1] += delta;
  }

  Object.assign(linearElement, { points: newPoints });

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
    return syncInvalidIndices(Array.from(this.excalidrawElements.values()));
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

export const convertToExcalidrawElements = (
  elementsSkeleton: ExcalidrawElementSkeleton[] | null,
  opts?: { regenerateIds: boolean },
) => {
  if (!elementsSkeleton) {
    return [];
  }
  const elements = cloneJSON(elementsSkeleton);
  const elementStore = new ElementStore();
  const elementsWithIds = new Map<string, ExcalidrawElementSkeleton>();
  const oldToNewElementIdMap = new Map<string, string>();

  // Create individual elements
  for (const element of elements) {
    let excalidrawElement: ExcalidrawElement;
    const originalId = element.id;
    if (opts?.regenerateIds !== false) {
      Object.assign(element, { id: randomId() });
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
        );

        excalidrawElement = newTextElement({
          width: metrics.width,
          height: metrics.height,
          fontFamily,
          fontSize,
          ...element,
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
      case "freedraw":
      case "iframe":
      case "embeddable": {
        excalidrawElement = element;
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
  // Add labels and arrow bindings
  for (const [id, element] of elementsWithIds) {
    const excalidrawElement = elementStore.getElement(id)!;

    switch (element.type) {
      case "rectangle":
      case "ellipse":
      case "diamond":
      case "arrow": {
        if (element.label?.text) {
          let [container, text] = bindTextToContainer(
            excalidrawElement,
            element?.label,
            elementsMap,
          );
          elementStore.add(container);
          elementStore.add(text);

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
                container,
                originalStart,
                originalEnd,
                elementStore,
                elementsMap,
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
                  excalidrawElement as ExcalidrawArrowElement,
                  start,
                  end,
                  elementStore,
                  elementsMap,
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

      elementInFrame?.boundElements?.forEach((boundElement) => {
        const ele = elementStore.getElement(boundElement.id);
        if (!ele) {
          throw new Error(
            `Bound element with id ${boundElement.id} doesn't exist`,
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
