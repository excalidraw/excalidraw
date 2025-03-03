import type { GlobalPoint, LineSegment } from "../../math";
import type { ExcalidrawElement } from "../element/types";

export type ElementsSegmentsMap = Map<string, LineSegment<GlobalPoint>[]>;

export type LassoWorkerInput = {
  lassoPath: GlobalPoint[];
  elements: readonly ExcalidrawElement[];
  elementsSegments: ElementsSegmentsMap;
  intersectedElements: Set<ExcalidrawElement["id"]>;
  enclosedElements: Set<ExcalidrawElement["id"]>;
  simplifyDistance?: number;
};

export type LassoWorkerOutput = {
  selectedElementIds: string[];
};
