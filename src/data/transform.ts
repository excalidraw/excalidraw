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
  VALID_CONTAINER_TYPES,
  getDefaultLineHeight,
  measureText,
  normalizeText,
} from "../element/textElement";
import {
  ExcalidrawBindableElement,
  ExcalidrawElement,
  ExcalidrawGenericElement,
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

const bindTextToContainer = (
  containerProps: ValidContainer | ValidLinearElement,
  textProps: { text: string } & MarkOptional<ElementConstructorOpts, "x" | "y">,
) => {
  let container;
  if (containerProps.type === "arrow") {
    const width = containerProps.width || 300;
    const height = containerProps.height || 0;
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
    //@ts-ignore
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
  const width = linearElement.width || 300;
  const height = linearElement.height || 0;
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
    const width = start?.width ?? 100;
    const height = start?.height ?? 100;
    const existingElement = start.id
      ? excalidrawElements.get().find((ele) => ele?.id === start.id)
      : undefined;
    const startX = start.x || excliadrawLinearElement.x - width;
    const startY = start.y || excliadrawLinearElement.y - height / 2;

    if (start.type === "text") {
      startBoundElement = newTextElement({
        x: startX,
        y: startY,
        ...existingElement,
        ...start,
      });
      // to position the text correctly when coordinates not provided
      mutateElement(startBoundElement, {
        x: start.x || excliadrawLinearElement.x - startBoundElement.width,
        y: start.y || excliadrawLinearElement.y - startBoundElement.height / 2,
      });
    } else {
      startBoundElement = newElement({
        x: startX,
        y: startY,
        width,
        height,
        ...existingElement,
        ...start,
      });
    }

    bindLinearElement(
      excliadrawLinearElement,
      startBoundElement as ExcalidrawBindableElement,
      "start",
    );
  }
  if (end) {
    const height = end?.height ?? 100;
    const width = end?.width ?? 100;

    const existingElement = end.id
      ? excalidrawElements.get().find((ele) => ele?.id === end.id)
      : undefined;
    const endX =
      end.x || excliadrawLinearElement.x + excliadrawLinearElement.width;
    const endY = end.y || excliadrawLinearElement.y - height / 2;

    if (end.type === "text") {
      endBoundElement = newTextElement({
        x: endX,
        y: endY,
        ...existingElement,
        ...end,
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
      }) as ExcalidrawBindableElement;
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
      VALID_CONTAINER_TYPES.has(elementWithid.type) &&
      //@ts-ignore
      elementWithid?.label?.text
    ) {
      let [container, text] = bindTextToContainer(
        //@ts-ignore
        elementWithid,
        //@ts-ignore
        elementWithid.label,
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
      } else {
        excalidrawElement = {
          ...elementWithid,
          width:
            elementWithid?.width ||
            (ELEMENTS_SUPPORTING_PROGRAMMATIC_API.includes(elementWithid.type)
              ? 100
              : 0),
          height:
            elementWithid?.height ||
            (ELEMENTS_SUPPORTING_PROGRAMMATIC_API.includes(elementWithid.type)
              ? 100
              : 0),
        } as ExcalidrawGenericElement;
        excalidrawElements.push(excalidrawElement);
      }
    }
  });
  return excalidrawElements.get();
};
