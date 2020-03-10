import { newElement } from "./newElement";

/**
 * ExcalidrawElement should be JSON serializable and (eventually) contain
 * no computed data. The list of all ExcalidrawElements should be shareable
 * between peers and contain no state local to the peer.
 */
export type ExcalidrawElement = Readonly<ReturnType<typeof newElement>>;
export type MutableExcalidrawElement = ReturnType<typeof newElement>;

export type MutableExcalidrawTextElement = MutableExcalidrawElement & {
  type: "text";
  font: string;
  text: string;
  // for backward compatibility
  actualBoundingBoxAscent?: number;
  baseline: number;
};

export type ExcalidrawTextElement = Readonly<MutableExcalidrawTextElement>;

export type PointerType = "mouse" | "pen" | "touch";
