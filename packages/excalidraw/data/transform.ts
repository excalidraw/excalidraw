import { pointFrom, type LocalPoint } from "@excalidraw/math";

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
  isDevEnv,
  toBrandedType,
  getLineHeight,
} from "@excalidraw/common";

import {
  bindLinearElement,
  calculateFixedPointForElbowArrowBinding,
  getBindingSideMidPoint,
  isElbowArrow,
} from "@excalidraw/element";
import {
  newArrowElement,
  newElement,
  newFrameElement,
  newImageElement,
  newLinearElement,
  newMagicFrameElement,
  newTextElement,
} from "@excalidraw/element";
import { measureText, normalizeText } from "@excalidraw/element";
import { isArrowElement } from "@excalidraw/element";

import { syncInvalidIndices } from "@excalidraw/element";

import { LinearElementEditor } from "@excalidraw/element";

import { getCommonBounds } from "@excalidraw/element";

import { Scene } from "@excalidraw/element";

import type { ElementConstructorOpts } from "@excalidraw/element";

import type {
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
} from "@excalidraw/element/types";

import type { MarkOptional } from "@excalidraw/common/utility-types";

import { adjustBoundTextSize } from "../components/ConvertElementTypePopup";

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
  scene: Scene,
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

  adjustBoundTextSize(container as any, textElement as any, scene, false);

  return [container, textElement] as const;
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

const createBoundElement = (
  binding: ValidLinearElement["start"] | ValidLinearElement["end"],
  linearElement: ExcalidrawArrowElement,
  edge: "start" | "end",
  elementStore: ElementStore,
): ExcalidrawElement | undefined => {
  if (!binding) {
    return undefined;
  }

  const width = binding?.width ?? DEFAULT_DIMENSION;
  const height = binding?.height ?? DEFAULT_DIMENSION;

  let existingElement;
  if (binding.id) {
    existingElement = elementStore.getElement(binding.id);
    if (!existingElement) {
      console.error(
        `No element for ${edge} binding with id ${binding.id} found`,
      );
      return undefined;
    }
  }

  const x =
    binding.x ||
    (edge === "start"
      ? linearElement.x - width
      : linearElement.x + linearElement.width);
  const y = binding.y || linearElement.y - height / 2;
  const elementType = existingElement ? existingElement.type : binding.type;

  if (!elementType) {
    return undefined;
  }

  if (elementType === "text") {
    let text = "";
    if (existingElement && existingElement.type === "text") {
      text = existingElement.text;
    } else if (binding.type === "text") {
      text = binding.text;
    }
    if (!text) {
      console.error(
        `No text found for ${edge} binding text element for ${linearElement.id}`,
      );
      return undefined;
    }
    const textElement = newTextElement({
      x,
      y,
      type: "text",
      ...existingElement,
      ...binding,
      text,
    });
    // to position the text correctly when coordinates not provided
    Object.assign(textElement, {
      x:
        binding.x ||
        (edge === "start" ? linearElement.x - textElement.width : x),
      y: binding.y || linearElement.y - textElement.height / 2,
    });
    return textElement;
  }
  switch (elementType) {
    case "rectangle":
    case "ellipse":
    case "diamond": {
      return newElement({
        x,
        y,
        width,
        height,
        ...existingElement,
        ...binding,
        type: elementType,
      });
    }
    default: {
      assertNever(
        elementType as never,
        `Unhandled element ${edge} type "${elementType}"`,
        true,
      );
      return undefined;
    }
  }
};

const bindLinearElementToElement = (
  linearElement: ExcalidrawArrowElement,
  start: ValidLinearElement["start"],
  end: ValidLinearElement["end"],
  elementStore: ElementStore,
  scene: Scene,
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
    startBoundElement = createBoundElement(
      start,
      linearElement,
      "start",
      elementStore,
    );
    if (startBoundElement) {
      elementStore.add(startBoundElement);
      scene.replaceAllElements(elementStore.getElementsMap());
      bindLinearElement(
        linearElement,
        startBoundElement as ExcalidrawBindableElement,
        "start",
        scene,
      );
    }
  }

  if (end) {
    endBoundElement = createBoundElement(
      end,
      linearElement,
      "end",
      elementStore,
    );
    if (endBoundElement) {
      elementStore.add(endBoundElement);
      scene.replaceAllElements(elementStore.getElementsMap());
      bindLinearElement(
        linearElement,
        endBoundElement as ExcalidrawBindableElement,
        "end",
        scene,
      );
    }
  }

  if (linearElement.points.length < 2) {
    return {
      linearElement,
      startBoundElement,
      endBoundElement,
    };
  }

  // update start/end points by 0.5 so bindings don't overlap with start/end bound element coordinates.
  if (!isElbowArrow(linearElement)) {
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

    Object.assign(
      linearElement,
      LinearElementEditor.getNormalizeElementPointsAndCoords({
        ...linearElement,
        points: newPoints,
      }),
    );
  }

  return {
    linearElement,
    startBoundElement,
    endBoundElement,
  };
};

const adjustElbowArrowPoints = (elements: ExcalidrawElement[]) => {
  const elementsMap = arrayToMap(elements) as NonDeletedSceneElementsMap;
  const scene = new Scene(elementsMap);

  elements.forEach((element) => {
    if (isElbowArrow(element) && (element.startBinding || element.endBinding)) {
      if (element.endBinding && element.endBinding.elementId) {
        const midPoint = getBindingSideMidPoint(
          element.endBinding,
          elementsMap,
        );

        const endBindableElement = elementsMap.get(
          element.endBinding.elementId,
        ) as ExcalidrawBindableElement;

        if (midPoint) {
          LinearElementEditor.movePoints(
            element,
            scene,
            new Map([
              [
                element.points.length - 1,
                {
                  point: pointFrom(
                    midPoint[0] - element.x,
                    midPoint[1] - element.y,
                  ),
                  isDragging: true,
                },
              ],
            ]),
          );

          const newFixedPoint = calculateFixedPointForElbowArrowBinding(
            element,
            endBindableElement,
            "end",
          ).fixedPoint;

          if (newFixedPoint) {
            Object.assign(element.endBinding, {
              fixedPoint: newFixedPoint,
            });
          }
        }
      }

      if (element.startBinding && element.startBinding.elementId) {
        const midPoint = getBindingSideMidPoint(
          element.startBinding,
          elementsMap,
        );

        const startBindableElement = elementsMap.get(
          element.startBinding.elementId,
        ) as ExcalidrawBindableElement;

        if (midPoint) {
          LinearElementEditor.movePoints(
            element,
            scene,
            new Map([
              [
                0,
                {
                  point: pointFrom(
                    midPoint[0] - element.x,
                    midPoint[1] - element.y,
                  ),
                  isDragging: true,
                },
              ],
            ]),
          );

          const newFixedPoint = calculateFixedPointForElbowArrowBinding(
            element,
            startBindableElement,
            "start",
          ).fixedPoint;
          if (newFixedPoint) {
            Object.assign(element.startBinding, {
              fixedPoint: newFixedPoint,
            });
          }
        }
      }
    }
  });
};

export const convertToExcalidrawElements = (
  elementsSkeleton: ExcalidrawElementSkeleton[] | null,
  opts?: { regenerateIds: boolean; useElbow?: boolean },
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

        if (!opts?.useElbow) {
          excalidrawElement = newArrowElement({
            width,
            height,
            endArrowhead: "arrow",
            points: [pointFrom(0, 0), pointFrom(width, height)],
            ...element,
            type: "arrow",
            elbowed: opts?.useElbow,
          });
          Object.assign(
            excalidrawElement,
            getSizeFromPoints(excalidrawElement.points),
          );
        } else {
          excalidrawElement = newArrowElement({
            width,
            height,
            endArrowhead: "arrow",
            ...element,
            type: "arrow",
            elbowed: opts?.useElbow,
            roundness: null,
          });
        }
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
  // we don't have a real scene, so we just use a temp scene to query and mutate elements
  const scene = new Scene(elementsMap);

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
            scene,
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
                scene,
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
                  scene,
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

  const finalElements = elementStore.getElements();

  // Adjust elbow arrow points now that all elements are in the scene
  if (opts?.useElbow) {
    adjustElbowArrowPoints(finalElements);
  }

  return finalElements;
};
