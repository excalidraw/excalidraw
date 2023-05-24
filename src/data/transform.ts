import { TEXT_ALIGN, VERTICAL_ALIGN } from "../constants";
import {
  newElement,
  newLinearElement,
  redrawTextBoundingBox,
} from "../element";
import { bindLinearElement } from "../element/binding";
import { mutateElement } from "../element/mutateElement";
import { ElementConstructorOpts, newTextElement } from "../element/newElement";
import { VALID_CONTAINER_TYPES } from "../element/textElement";
import {
  ExcalidrawBindableElement,
  ExcalidrawElement,
  ExcalidrawGenericElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  FontFamilyValues,
  TextAlign,
  VerticalAlign,
} from "../element/types";
import { MarkOptional } from "../utility-types";
import { ImportedDataState } from "./types";

export const ELEMENTS_SUPPORTING_PROGRAMMATIC_API = [
  "rectangle",
  "ellipse",
  "diamond",
  "text",
  "arrow",
  "line",
];

const bindTextToContainer = (
  containerProps:
    | {
        type:
          | Exclude<ExcalidrawGenericElement["type"], "selection">
          | ExcalidrawLinearElement["type"];
      } & MarkOptional<ElementConstructorOpts, "x" | "y">,
  textProps: { text: string } & MarkOptional<ElementConstructorOpts, "x" | "y">,
) => {
  let container;
  if (containerProps.type === "arrow") {
    container = newLinearElement({
      width: containerProps.width || 300,
      height: containerProps.height || 24,
      //@ts-ignore
      type: containerProps.type,
      //@ts-ignore,
      endArrowhead: containerProps.type === "arrow" ? "arrow" : null,
      //@ts-ignore
      points: [
        [0, 0],
        [300, 0],
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
  linearElement: {
    type: ExcalidrawLinearElement["type"];
    x: number;
    y: number;
    label?: {
      text: string;
      fontSize?: number;
      fontFamily?: FontFamilyValues;
      textAlign?: TextAlign;
      verticalAlign?: VerticalAlign;
    } & MarkOptional<ElementConstructorOpts, "x" | "y">;
    start?: {
      type: Exclude<
        ExcalidrawBindableElement["type"],
        "image" | "selection" | "text"
      >;
      id?: ExcalidrawGenericElement["id"];
    } & MarkOptional<ElementConstructorOpts, "x" | "y">;
    end?: {
      type: ExcalidrawGenericElement["type"];
      id?: ExcalidrawGenericElement["id"];
    } & MarkOptional<ElementConstructorOpts, "x" | "y">;
  } & Partial<ExcalidrawLinearElement>,
  elements: ImportedDataState["elements"],
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

  const excliadrawLinearElement = newLinearElement({
    type,
    width: 200,
    height: 24,
    points: [
      [0, 0],
      [200, 0],
    ],
    endArrowhead,
    ...rest,
  });

  if (!elements || !elements.length) {
    return { linearElement: excliadrawLinearElement };
  }

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
      ? elements.find((ele) => ele?.id === start.id)
      : undefined;
    startBoundElement = newElement({
      x: start.x || excliadrawLinearElement.x - width,
      y: start.y || excliadrawLinearElement.y - height / 2,
      width,
      height,
      ...existingElement,
      ...start,
    });

    bindLinearElement(
      excliadrawLinearElement,
      startBoundElement as ExcalidrawBindableElement,
      "start",
    );
  }
  if (end) {
    const height = end?.height ?? 100;
    const existingElement = end.id
      ? elements.find((ele) => ele?.id === end.id)
      : undefined;
    endBoundElement = newElement({
      x: end.x || excliadrawLinearElement.x + excliadrawLinearElement.width,
      y: end.y || excliadrawLinearElement.y - height / 2,
      width: end?.width ?? 100,
      height,
      ...existingElement,
      ...end,
    }) as ExcalidrawBindableElement;

    bindLinearElement(
      excliadrawLinearElement,
      endBoundElement as ExcalidrawBindableElement,
      "end",
    );
  }
  return {
    linearElement: excliadrawLinearElement,
    //@ts-ignore
    startBoundElement,
    //@ts-ignore
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
  };
  const get = () => {
    return res;
  };
  return {
    push,
    clear,
    get,
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
    if (!ELEMENTS_SUPPORTING_PROGRAMMATIC_API.includes(element.type)) {
      excalidrawElements.push(element as ExcalidrawElement);

      return;
    }
    //@ts-ignore
    if (VALID_CONTAINER_TYPES.has(element.type) && element?.label?.text) {
      //@ts-ignore
      let [container, text] = bindTextToContainer(element, element.label);
      excalidrawElements.push(container);
      excalidrawElements.push(text);

      if (container.type === "arrow") {
        const { linearElement, startBoundElement, endBoundElement } =
          bindLinearElementToElement(
            {
              ...container,
              //@ts-ignore
              start: element?.start,
              //@ts-ignore
              end: element?.end,
            },
            elements,
          );
        container = linearElement;
        excalidrawElements.push(linearElement);
        excalidrawElements.push(startBoundElement);
        excalidrawElements.push(endBoundElement);
      }
    } else {
      let excalidrawElement;
      if (element.type === "text") {
        excalidrawElement = {
          ...element,
        } as ExcalidrawTextElement;
        excalidrawElements.push(excalidrawElement);
      } else if (element.type === "arrow" || element.type === "line") {
        const { linearElement, startBoundElement, endBoundElement } =
          //@ts-ignore
          bindLinearElementToElement(element, elements);
        excalidrawElements.push(linearElement);
        excalidrawElements.push(startBoundElement);
        excalidrawElements.push(endBoundElement);
        //@ts-ignore
        if (startBoundElement && !element.start.id) {
          //@ts-ignore
          excalidrawElements.push(startBoundElement);
        }
        //@ts-ignore
        if (endBoundElement && !element.end.id) {
          //@ts-ignore
          excalidrawElements.push(endBoundElement);
        }
      } else {
        excalidrawElement = {
          ...element,
          width:
            element?.width ||
            (ELEMENTS_SUPPORTING_PROGRAMMATIC_API.includes(element.type)
              ? 100
              : 0),
          height:
            element?.height ||
            (ELEMENTS_SUPPORTING_PROGRAMMATIC_API.includes(element.type)
              ? 100
              : 0),
        } as ExcalidrawGenericElement;
        excalidrawElements.push(excalidrawElement);
      }
    }
  });
  return excalidrawElements.get();
};
