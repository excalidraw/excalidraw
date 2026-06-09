import type { LocalPoint, Radians } from "@excalidraw/math";

import type {
  FONT_FAMILY,
  ROUNDNESS,
  TEXT_ALIGN,
  THEME,
  VERTICAL_ALIGN,
} from "@excalidraw/common";

import type {
  MakeBrand,
  MarkNonNullable,
  Merge,
  ValueOf,
} from "@excalidraw/common/utility-types";

export type ChartType = "bar" | "line" | "radar";
export type FillStyle = "hachure" | "cross-hatch" | "solid" | "zigzag";
export type FontFamilyKeys = keyof typeof FONT_FAMILY;
export type FontFamilyValues = typeof FONT_FAMILY[FontFamilyKeys] | 10;
export type Theme = typeof THEME[keyof typeof THEME];
export type FontString = string & { _brand: "fontString" };
export type GroupId = string;
export type PointerType = "mouse" | "pen" | "touch";
export type StrokeRoundness = "round" | "sharp";
export type RoundnessType = ValueOf<typeof ROUNDNESS>;
export type StrokeStyle = "solid" | "dashed" | "dotted";
export type TextAlign = typeof TEXT_ALIGN[keyof typeof TEXT_ALIGN];

type VerticalAlignKeys = keyof typeof VERTICAL_ALIGN;
export type VerticalAlign = typeof VERTICAL_ALIGN[VerticalAlignKeys];
export type FractionalIndex = string & { _brand: "franctionalIndex" };

export type BoundElement = Readonly<{
  id: ExcalidrawLinearElement["id"];
  type: "arrow" | "text";
}>;

type _ExcalidrawElementBase = Readonly<{
  id: string;
  x: number;
  y: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roundness: null | { type: RoundnessType; value?: number };
  roughness: number;
  opacity: number;
  width: number;
  height: number;
  angle: Radians;
  seed: number;
  version: number;
  versionNonce: number;
  index: FractionalIndex | null;
  isDeleted: boolean;
  groupIds: readonly GroupId[];
  frameId: string | null;
  boundElements: readonly BoundElement[] | null;
  updated: number;
  link: string | null;
  locked: boolean;
  customData?: Record<string, any>;
}>;

export type ExcalidrawSelectionElement = _ExcalidrawElementBase & { type: "selection" };
export type ExcalidrawRectangleElement = _ExcalidrawElementBase & { type: "rectangle" };
export type ExcalidrawDiamondElement = _ExcalidrawElementBase & { type: "diamond" };
export type ExcalidrawEllipseElement = _ExcalidrawElementBase & { type: "ellipse" };
export type ExcalidrawEmbeddableElement = _ExcalidrawElementBase & Readonly<{ type: "embeddable" }>;

export type MagicGenerationData =
  | { status: "pending" }
  | { status: "done"; html: string }
  | { status: "error"; message?: string; code: "ERR_GENERATION_INTERRUPTED" | string };

export type ExcalidrawIframeElement = _ExcalidrawElementBase & Readonly<{
  type: "iframe";
  customData?: { generationData?: MagicGenerationData };
}>;

export type ExcalidrawIframeLikeElement = ExcalidrawIframeElement | ExcalidrawEmbeddableElement;

export type IframeData =
  | { intrinsicSize: { w: number; h: number }; error?: Error; sandbox?: { allowSameOrigin?: boolean } }
   & ({ type: "video" | "generic"; link: string } | { type: "document"; srcdoc: (theme: Theme) => string });

export type ImageCrop = { x: number; y: number; width: number; height: number; naturalWidth: number; naturalHeight: number };

export type ExcalidrawImageElement = _ExcalidrawElementBase & Readonly<{
  type: "image";
  fileId: FileId | null;
  status: "pending" | "saved" | "error";
  scale: [number, number];
  crop: ImageCrop | null;
}>;

export type InitializedExcalidrawImageElement = MarkNonNullable<ExcalidrawImageElement, "fileId">;
export type ExcalidrawFrameElement = _ExcalidrawElementBase & { type: "frame"; name: string | null };
export type ExcalidrawMagicFrameElement = _ExcalidrawElementBase & { type: "magicframe"; name: string | null };
export type ExcalidrawFrameLikeElement = ExcalidrawFrameElement | ExcalidrawMagicFrameElement;

export type ExcalidrawGenericElement = ExcalidrawSelectionElement | ExcalidrawRectangleElement | ExcalidrawDiamondElement | ExcalidrawEllipseElement;
export type ExcalidrawFlowchartNodeElement = ExcalidrawRectangleElement | ExcalidrawDiamondElement | ExcalidrawEllipseElement;
export type ExcalidrawRectanguloidElement = ExcalidrawRectangleElement | ExcalidrawImageElement | ExcalidrawTextElement | ExcalidrawFreeDrawElement | ExcalidrawIframeLikeElement | ExcalidrawFrameLikeElement | ExcalidrawEmbeddableElement | ExcalidrawSelectionElement;

export type ExcalidrawElement = ExcalidrawGenericElement | ExcalidrawTextElement | ExcalidrawLinearElement | ExcalidrawArrowElement | ExcalidrawFreeDrawElement | ExcalidrawImageElement | ExcalidrawFrameElement | ExcalidrawMagicFrameElement | ExcalidrawIframeElement | ExcalidrawEmbeddableElement;
export type ExcalidrawNonSelectionElement = Exclude<ExcalidrawElement, ExcalidrawSelectionElement>;

export type Ordered<TElement extends ExcalidrawElement> = TElement & { index: FractionalIndex };
export type OrderedExcalidrawElement = Ordered<ExcalidrawElement>;
export type NonDeleted<TElement extends ExcalidrawElement> = TElement & { isDeleted: boolean };
export type NonDeletedExcalidrawElement = NonDeleted<ExcalidrawElement>;

export type ExcalidrawTextElement = _ExcalidrawElementBase & Readonly<{
  type: "text";
  fontSize: number;
  fontFamily: FontFamilyValues;
  text: string;
  textAlign: TextAlign;
  verticalAlign: VerticalAlign;
  containerId: ExcalidrawGenericElement["id"] | null;
  originalText: string;
  autoResize: boolean;
  lineHeight: number & { _brand: "unitlessLineHeight" };
}>;

export type ExcalidrawBindableElement = ExcalidrawRectangleElement | ExcalidrawDiamondElement | ExcalidrawEllipseElement | ExcalidrawTextElement | ExcalidrawImageElement | ExcalidrawIframeElement | ExcalidrawEmbeddableElement | ExcalidrawFrameElement | ExcalidrawMagicFrameElement;
export type ExcalidrawTextContainer = ExcalidrawRectangleElement | ExcalidrawDiamondElement | ExcalidrawEllipseElement | ExcalidrawArrowElement;
export type ExcalidrawTextElementWithContainer = { containerId: ExcalidrawTextContainer["id"] } & ExcalidrawTextElement;

export type FixedPoint = [number, number];
export type BindMode = "inside" | "orbit" | "skip";
export type FixedPointBinding = { elementId: ExcalidrawBindableElement["id"]; fixedPoint: FixedPoint; mode: BindMode };

type Index = number;
export type PointsPositionUpdates = Map<Index, { point: LocalPoint; isDragging?: boolean }>;

export type CardinalityArrowhead = "cardinality_one" | "cardinality_many" | "cardinality_one_or_many" | "cardinality_exactly_one" | "cardinality_zero_or_one" | "cardinality_zero_or_many";
export type ArrowheadLegacy = "dot" | "crowfoot_one" | "crowfoot_many" | "crowfoot_one_or_many";
export type Arrowhead = "arrow" | "bar" | "circle" | "circle_outline" | "triangle" | "triangle_outline" | "diamond" | "diamond_outline" | CardinalityArrowhead;
export type AnyArrowhead = Arrowhead | ArrowheadLegacy;

export type ExcalidrawLinearElement = _ExcalidrawElementBase & Readonly<{
  type: "line" | "arrow";
  points: readonly LocalPoint[];
  startBinding: FixedPointBinding | null;
  endBinding: FixedPointBinding | null;
  startArrowhead: Arrowhead | null;
  endArrowhead: Arrowhead | null;
}>;

export type ExcalidrawLineElement = ExcalidrawLinearElement & Readonly<{ type: "line"; polygon: boolean }>;
export type FixedSegment = { start: LocalPoint; end: LocalPoint; index: Index };
export type ExcalidrawArrowElement = ExcalidrawLinearElement & Readonly<{ type: "arrow"; elbowed: boolean }>;

export type ExcalidrawElbowArrowElement = Merge<ExcalidrawArrowElement, {
  elbowed: true;
  fixedSegments: readonly FixedSegment[] | null;
  startBinding: FixedPointBinding | null;
  endBinding: FixedPointBinding | null;
  startIsSpecial: boolean | null;
  endIsSpecial: boolean | null;
}>;

export type ExcalidrawFreeDrawElement = _ExcalidrawElementBase & Readonly<{ type: "freedraw"; points: readonly LocalPoint[]; pressures: readonly number[]; simulatePressure: boolean }>;

export type FileId = string & { _brand: "FileId" };
export type ExcalidrawElementType = ExcalidrawElement["type"];

export type ElementsMap = Map<ExcalidrawElement["id"], ExcalidrawElement>;
export type NonDeletedElementsMap = Map<ExcalidrawElement["id"], NonDeletedExcalidrawElement> & MakeBrand<"NonDeletedElementsMap">;
export type SceneElementsMap = Map<ExcalidrawElement["id"], Ordered<ExcalidrawElement>> & MakeBrand<"SceneElementsMap">;
export type NonDeletedSceneElementsMap = Map<ExcalidrawElement["id"], Ordered<NonDeletedExcalidrawElement>> & MakeBrand<"NonDeletedSceneElementsMap">;

export type ElementsMapOrArray = readonly ExcalidrawElement[] | Readonly<ElementsMap>;
export type ExcalidrawLinearElementSubType = "line" | "sharpArrow" | "curvedArrow" | "elbowArrow";
export type ConvertibleGenericTypes = "rectangle" | "diamond" | "ellipse";
export type ConvertibleLinearTypes = ExcalidrawLinearElementSubType;
export type ConvertibleTypes = ConvertibleGenericTypes | ConvertibleLinearTypes;