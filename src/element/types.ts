import { newElement } from "./newElement";

export type ExcalidrawElement = ReturnType<typeof newElement>;
export type ExcalidrawTextElement = ExcalidrawElement & {
  type: "text";
  font: string;
  text: string;
  actualBoundingBoxAscent: number;
};
