import { ExcalidrawElement, ExcalidrawTextElement } from "./element/types";

// Subtype Names
export type Subtype = string;

// Subtype Methods
export type SubtypeMethods = {
  measureText: (
    element: Pick<
      ExcalidrawTextElement,
      | "subtype"
      | "customData"
      | "fontSize"
      | "fontFamily"
      | "text"
      | "lineHeight"
    >,
    next?: {
      fontSize?: number;
      text?: string;
      customData?: ExcalidrawElement["customData"];
    },
  ) => { width: number; height: number; baseline: number };
  wrapText: (
    element: Pick<
      ExcalidrawTextElement,
      | "subtype"
      | "customData"
      | "fontSize"
      | "fontFamily"
      | "originalText"
      | "lineHeight"
    >,
    containerWidth: number,
    next?: {
      fontSize?: number;
      text?: string;
      customData?: ExcalidrawElement["customData"];
    },
  ) => string;
};

type MethodMap = { subtype: Subtype; methods: Partial<SubtypeMethods> };
const methodMaps = [] as Array<MethodMap>;

// Use `getSubtypeMethods` to call subtype-specialized methods, like `render`.
export const getSubtypeMethods = (
  subtype: Subtype | undefined,
): Partial<SubtypeMethods> | undefined => {
  const map = methodMaps.find((method) => method.subtype === subtype);
  return map?.methods;
};
