import { Point } from "../types";
import { FONT_FAMILY } from "../constants";

export type GroupId = string;

type _ExcalidrawElementBase = Readonly<{
  id: string;
  x: number;
  y: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: string;
  strokeWidth: number;
  strokeStyle: "solid" | "dashed" | "dotted";
  roughness: number;
  opacity: number;
  width: number;
  height: number;
  angle: number;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  groupIds: readonly GroupId[];
}>;

export type ExcalidrawSelectionElement = _ExcalidrawElementBase & {
  type: "selection";
};
/**
 * These are elements that don't have any additional properties.
 */
export type ExcalidrawGenericElement =
  | ExcalidrawSelectionElement
  | (_ExcalidrawElementBase & {
      type: "rectangle" | "diamond" | "ellipse";
    });

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
    fontSize: number;
    fontFamily: FontFamily;
    text: string;
    baseline: number;
    textAlign: TextAlign;
  }>;

export type ExcalidrawLinearElement = _ExcalidrawElementBase &
  Readonly<{
    type: "arrow" | "line" | "draw";
    points: readonly Point[];
    lastCommittedPoint?: Point | null;
  }>;

export type PointerType = "mouse" | "pen" | "touch";

export type TextAlign = "left" | "center" | "right";

export type FontFamily = keyof typeof FONT_FAMILY;
export type FontString = string & { _brand: "fontString" };
