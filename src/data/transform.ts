import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  TEXT_ALIGN,
  VERTICAL_ALIGN,
} from "../constants";
import {
  newElement,
  newLinearElement,
  redrawTextBoundingBox,
} from "../element";
import { bindLinearElement } from "../element/binding";
import {
  ElementConstructorOpts,
  newImageElement,
  newTextElement,
} from "../element/newElement";
import {
  getDefaultLineHeight,
  measureText,
  normalizeText,
} from "../element/textElement";
import {
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  ExcalidrawElement,
  ExcalidrawEmbeddableElement,
  ExcalidrawFrameElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawGenericElement,
  ExcalidrawImageElement,
  ExcalidrawLinearElement,
  ExcalidrawSelectionElement,
  ExcalidrawTextElement,
  FileId,
  FontFamilyValues,
  TextAlign,
  VerticalAlign,
} from "../element/types";
import { MarkOptional } from "../utility-types";
import { assertNever, getFontString } from "../utils";

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
                  "image" | "text" | "frame" | "embeddable"
                >;
                id?: ExcalidrawGenericElement["id"];
              }
            | {
                id: ExcalidrawGenericElement["id"];
                type?: Exclude<
                  ExcalidrawBindableElement["type"],
                  "image" | "text" | "frame" | "embeddable"
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
                  "image" | "text" | "frame" | "embeddable"
                >;
                id?: ExcalidrawGenericElement["id"];
              }
            | {
                id: ExcalidrawGenericElement["id"];
                type?: Exclude<
                  ExcalidrawBindableElement["type"],
                  "image" | "text" | "frame" | "embeddable"
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
      | ExcalidrawEmbeddableElement
      | ExcalidrawFreeDrawElement
      | ExcalidrawFrameElement
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
    } & Partial<ExcalidrawImageElement>);

const DEFAULT_LINEAR_ELEMENT_PROPS = {
  width: 300,
  height: 0,
};

const DEFAULT_DIMENSION = 100;

const bindTextToContainer = (
  container: ExcalidrawElement,
  textProps: { text: string } & MarkOptional<ElementConstructorOpts, "x" | "y">,
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

  redrawTextBoundingBox(textElement, container);
  return [container, textElement] as const;
};

const bindLinearElementToElement = (
  linearElement: ExcalidrawArrowElement,
  start: ValidLinearElement["start"],
  end: ValidLinearElement["end"],
  elementStore: ElementStore,
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
    return Array.from(this.excalidrawElements.values());
  };

  getElement = (id: string) => {
    return this.excalidrawElements.get(id);
  };
}

export const convertToExcalidrawElements = (
  elements: ExcalidrawElementSkeleton[] | null,
) => {
  if (!elements) {
    return [];
  }

  const elementStore = new ElementStore();
  const elementsWithIds = new Map<string, ExcalidrawElementSkeleton>();

  // Create individual elements
  for (const element of elements) {
    let excalidrawElement: ExcalidrawElement;
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
          points: [
            [0, 0],
            [width, height],
          ],
          ...element,
        });

        break;
      }
      case "arrow": {
        const width = element.width || DEFAULT_LINEAR_ELEMENT_PROPS.width;
        const height = element.height || DEFAULT_LINEAR_ELEMENT_PROPS.height;
        excalidrawElement = newLinearElement({
          width,
          height,
          endArrowhead: "arrow",
          points: [
            [0, 0],
            [width, height],
          ],
          ...element,
        });
        break;
      }
      case "text": {
        const fontFamily = element?.fontFamily || DEFAULT_FONT_FAMILY;
        const fontSize = element?.fontSize || DEFAULT_FONT_SIZE;
        const lineHeight =
          element?.lineHeight || getDefaultLineHeight(fontFamily);
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
      case "freedraw":
      case "frame":
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
    }
  }

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
          );
          elementStore.add(container);
          elementStore.add(text);

          if (container.type === "arrow") {
            const originalStart =
              element.type === "arrow" ? element?.start : undefined;
            const originalEnd =
              element.type === "arrow" ? element?.end : undefined;
            const { linearElement, startBoundElement, endBoundElement } =
              bindLinearElementToElement(
                container as ExcalidrawArrowElement,
                originalStart,
                originalEnd,
                elementStore,
              );
            container = linearElement;
            elementStore.add(linearElement);
            elementStore.add(startBoundElement);
            elementStore.add(endBoundElement);
          }
        } else {
          switch (element.type) {
            case "arrow": {
              const { linearElement, startBoundElement, endBoundElement } =
                bindLinearElementToElement(
                  excalidrawElement as ExcalidrawArrowElement,
                  element.start,
                  element.end,
                  elementStore,
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
  return elementStore.getElements();
};
