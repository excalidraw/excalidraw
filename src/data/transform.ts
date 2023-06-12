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
import { mutateElement } from "../element/mutateElement";
import {
  ElementConstructorOpts,
  newTextElement,
  regenerateId,
} from "../element/newElement";
import {
  getDefaultLineHeight,
  measureText,
  normalizeText,
} from "../element/textElement";
import {
  ExcalidrawBindableElement,
  ExcalidrawElement,
  ExcalidrawGenericElement,
  ExcalidrawImageElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
} from "../element/types";
import { MarkOptional } from "../utility-types";
import { getFontString } from "../utils";
import { ImportedDataState, ValidContainer, ValidLinearElement } from "./types";

export const ELEMENTS_SUPPORTING_PROGRAMMATIC_API = [
  "rectangle",
  "ellipse",
  "diamond",
  "text",
  "arrow",
  "line",
];

const DEFAULT_LINEAR_ELEMENT_PROPS = {
  width: 300,
  height: 0,
};

const DEFAULT_DIMENSION = 100;

const bindTextToContainer = (
  containerProps: ValidContainer | ({ type: "arrow" } & ValidLinearElement),
  textProps: { text: string } & MarkOptional<ElementConstructorOpts, "x" | "y">,
) => {
  let container;
  if (containerProps.type === "arrow") {
    const width = containerProps.width || DEFAULT_LINEAR_ELEMENT_PROPS.width;
    const height = containerProps.height || DEFAULT_LINEAR_ELEMENT_PROPS.height;
    container = newLinearElement({
      width,
      height,
      endArrowhead: "arrow",
      points: [
        [0, 0],
        [width, height],
      ],
      ...containerProps,
    });
  } else {
    container = newElement({
      ...containerProps,
    });
  }
  const textElement: ExcalidrawTextElement = newTextElement({
    x: 0,
    y: 0,
    textAlign: TEXT_ALIGN.CENTER,
    verticalAlign: VERTICAL_ALIGN.MIDDLE,
    ...textProps,
    containerId: container.id,
    strokeColor: textProps.strokeColor || container.strokeColor,
  });

  mutateElement(container, {
    boundElements: (container.boundElements || []).concat({
      type: "text",
      id: textElement.id,
    }),
  });

  redrawTextBoundingBox(textElement, container);

  return [container, textElement];
};

const bindLinearElementToElement = (
  linearElement: ValidLinearElement,
): {
  linearElement: ExcalidrawLinearElement;
  startBoundElement?: ExcalidrawElement;
  endBoundElement?: ExcalidrawElement;
} => {
  const {
    start,
    end,
    type,
    endArrowhead = linearElement.type === "arrow" ? "arrow" : null,
    ...rest
  } = linearElement;
  const width = linearElement.width || DEFAULT_LINEAR_ELEMENT_PROPS.width;
  const height = linearElement.height || DEFAULT_LINEAR_ELEMENT_PROPS.height;
  const excliadrawLinearElement = newLinearElement({
    type,
    width,
    height,
    points: [
      [0, 0],
      [width, height],
    ],
    endArrowhead,
    ...rest,
  });

  let startBoundElement;
  let endBoundElement;

  mutateElement(excliadrawLinearElement, {
    startBinding: linearElement?.startBinding || null,
    endBinding: linearElement.endBinding || null,
  });

  if (start) {
    const width = start?.width ?? DEFAULT_DIMENSION;
    const height = start?.height ?? DEFAULT_DIMENSION;
    let existingElement;
    if (start.id) {
      existingElement = excalidrawElements
        .get()
        .find((ele) => ele?.id === start.id) as Exclude<
        ExcalidrawBindableElement,
        ExcalidrawImageElement
      >;
      if (!existingElement) {
        console.error(`No element for start binding with id ${start.id} found`);
      }
    }

    const startX = start.x || excliadrawLinearElement.x - width;
    const startY = start.y || excliadrawLinearElement.y - height / 2;
    const startType = existingElement ? existingElement.type : start.type;

    if (startType) {
      if (startType === "text") {
        let text = "";
        if (existingElement && existingElement.type === "text") {
          text = existingElement.text;
        } else if (start.type === "text") {
          text = start.text;
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
        mutateElement(startBoundElement, {
          x: start.x || excliadrawLinearElement.x - startBoundElement.width,
          y:
            start.y || excliadrawLinearElement.y - startBoundElement.height / 2,
        });
      } else {
        startBoundElement = newElement({
          x: startX,
          y: startY,
          width,
          height,
          ...existingElement,
          ...start,
          type: startType,
        });
      }

      bindLinearElement(
        excliadrawLinearElement,
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
      existingElement = excalidrawElements
        .get()
        .find((ele) => ele?.id === end.id) as Exclude<
        ExcalidrawBindableElement,
        ExcalidrawImageElement
      >;
      if (!existingElement) {
        console.error(`No element for end binding with id ${end.id} found`);
      }
    }
    const endX =
      end.x || excliadrawLinearElement.x + excliadrawLinearElement.width;
    const endY = end.y || excliadrawLinearElement.y - height / 2;
    const endType = existingElement ? existingElement.type : end.type;

    if (endType) {
      if (endType === "text") {
        let text = "";
        if (existingElement && existingElement.type === "text") {
          text = existingElement.text;
        } else if (end.type === "text") {
          text = end.text;
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
        mutateElement(endBoundElement, {
          y: end.y || excliadrawLinearElement.y - endBoundElement.height / 2,
        });
      } else {
        endBoundElement = newElement({
          x: endX,
          y: endY,
          width,
          height,
          ...existingElement,
          ...end,
          type: endType,
        }) as ExcalidrawBindableElement;
      }
    }
    bindLinearElement(
      excliadrawLinearElement,
      endBoundElement as ExcalidrawBindableElement,
      "end",
    );
  }
  return {
    linearElement: excliadrawLinearElement,
    startBoundElement,
    endBoundElement,
  };
};

const excalidrawElements = (() => {
  const res: ExcalidrawElement[] = [];
  const elementMap = new Map<string, number>();

  const push = (ele?: ExcalidrawElement) => {
    if (!ele) {
      return;
    }
    const index = elementMap.get(ele.id);
    if (index !== undefined && index >= 0) {
      res[index] = ele;
    } else {
      res.push(ele);
      const index = res.length - 1;
      elementMap.set(ele.id, index);
    }
  };
  const clear = () => {
    res.length = 0;
    elementMap.clear();
  };
  const get = () => {
    return res;
  };
  const hasElementWithId = (id: string) => {
    const index = elementMap.get(id);
    return index !== undefined && index >= 0;
  };
  return {
    push,
    clear,
    get,
    hasElementWithId,
  };
})();

export const convertToExcalidrawElements = (
  elements: ImportedDataState["elements"],
): ExcalidrawElement[] => {
  excalidrawElements.clear();
  if (!elements) {
    return [];
  }
  elements.forEach((element) => {
    if (!element) {
      return;
    }

    let elementId = element.id || regenerateId(null);

    // To make sure every element has a unique id
    while (excalidrawElements.hasElementWithId(elementId)) {
      elementId = regenerateId(elementId);
    }

    if (!ELEMENTS_SUPPORTING_PROGRAMMATIC_API.includes(element.type)) {
      excalidrawElements.push(element as ExcalidrawElement);

      return;
    }
    const elementWithid = { ...element, id: elementId };

    if (
      (elementWithid.type === "rectangle" ||
        elementWithid.type === "ellipse" ||
        elementWithid.type === "diamond" ||
        elementWithid.type === "arrow") &&
      elementWithid?.label?.text
    ) {
      let [container, text] = bindTextToContainer(
        elementWithid as
          | ValidContainer
          | ({
              type: "arrow";
            } & ValidLinearElement),
        elementWithid?.label,
      );
      excalidrawElements.push(container);
      excalidrawElements.push(text);
      if (container.type === "arrow") {
        const originalStart =
          elementWithid.type === "arrow" ? elementWithid?.start : undefined;
        const originalEnd =
          elementWithid.type === "arrow" ? elementWithid?.end : undefined;
        const { linearElement, startBoundElement, endBoundElement } =
          bindLinearElementToElement({
            ...container,
            start: originalStart,
            end: originalEnd,
          });
        container = linearElement;
        excalidrawElements.push(linearElement);
        excalidrawElements.push(startBoundElement);
        excalidrawElements.push(endBoundElement);
      }
    } else {
      let excalidrawElement;
      if (elementWithid.type === "text") {
        const fontFamily = elementWithid?.fontFamily || DEFAULT_FONT_FAMILY;
        const fontSize = elementWithid?.fontSize || DEFAULT_FONT_SIZE;
        const lineHeight =
          elementWithid?.lineHeight || getDefaultLineHeight(fontFamily);
        const text = elementWithid.text ?? "";
        const normalizedText = normalizeText(text);
        const metrics = measureText(
          normalizedText,
          getFontString({ fontFamily, fontSize }),
          lineHeight,
        );
        excalidrawElement = {
          width: metrics.width,
          height: metrics.height,
          fontFamily,
          fontSize,
          ...elementWithid,
        };

        excalidrawElements.push(excalidrawElement as ExcalidrawTextElement);
      } else if (elementWithid.type === "arrow") {
        const { linearElement, startBoundElement, endBoundElement } =
          bindLinearElementToElement(elementWithid);
        excalidrawElements.push(linearElement);
        excalidrawElements.push(startBoundElement);
        excalidrawElements.push(endBoundElement);
        if (startBoundElement && !elementWithid?.start?.id) {
          excalidrawElements.push(startBoundElement);
        }
        if (endBoundElement && !elementWithid?.end?.id) {
          excalidrawElements.push(endBoundElement);
        }
      } else if (elementWithid.type === "line") {
        const width = elementWithid.width || DEFAULT_LINEAR_ELEMENT_PROPS.width;
        const height =
          elementWithid.height || DEFAULT_LINEAR_ELEMENT_PROPS.height;
        const lineElement = newLinearElement({
          width,
          height,
          points: [
            [0, 0],
            [width, height],
          ],
          ...elementWithid,
        });
        excalidrawElements.push(lineElement);
      } else {
        excalidrawElement = {
          ...elementWithid,
          width: elementWithid?.width || DEFAULT_DIMENSION,
          height: elementWithid?.height || DEFAULT_DIMENSION,
        } as ExcalidrawGenericElement;
        excalidrawElements.push(excalidrawElement);
      }
    }
  });
  return excalidrawElements.get();
};
