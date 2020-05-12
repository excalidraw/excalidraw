import { Point } from "../types";

type _ExcalidrawElementBase = Readonly<{
  id: string;
  x: number;
  y: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  roughness: number;
  opacity: number;
  width: number;
  height: number;
  angle: number;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
}>;

export type ExcalidrawGenericElement = _ExcalidrawElementBase & {
  type: "selection" | "rectangle" | "diamond" | "ellipse";
};

/**
 * ExcalidrawElement should be JSON serializable and (eventually) contain
 * no computed data. The list of all ExcalidrawElements should be shareable
 * between peers and contain no state local to the peer.
 */
export type ExcalidrawElement =
  | ExcalidrawGenericElement
  | ExcalidrawTextElement
  | ExcalidrawLinearElement;

export type NonDeleted<TElement extends ExcalidrawElement> = TElement & {
  isDeleted: false;
};

export type NonDeletedExcalidrawElement = NonDeleted<ExcalidrawElement>;

export type ExcalidrawTextElement = _ExcalidrawElementBase &
  Readonly<{
    type: "text";
    font: string;
    text: string;
    baseline: number;
    textAlign: TextAlign;
  }>;

export type ExcalidrawLinearElement = _ExcalidrawElementBase &
  Readonly<{
    type: "arrow" | "line" | "draw";
    points: Point[];
    lastCommittedPoint?: Point | null;
  }>;

export type PointerType = "mouse" | "pen" | "touch";

export type TextAlign = "left" | "center" | "right";
