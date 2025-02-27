import type { GlobalPoint, LineSegment } from "../../math/types";
import { polygonFromPoints, polygonIncludesPoint } from "../../math/polygon";
import type { ExcalidrawElement } from "../element/types";
import { lineSegment, lineSegmentIntersectionPoints } from "../../math/segment";
import { simplify } from "points-on-curve";

// variables to track processing state and latest input data
// for "backpressure" purposes
let isProcessing: boolean = false;
let latestInputData: LassoWorkerInput | null = null;

self.onmessage = (event: MessageEvent<LassoWorkerInput>) => {
  if (!event.data) {
    self.postMessage({
      error: "No data received",
      selectedElementIds: [],
    });
    return;
  }

  latestInputData = event.data;

  if (!isProcessing) {
    processInputData();
  }
};

// function to process the latest data
const processInputData = () => {
  // If no data to process, return
  if (!latestInputData) {
    return;
  }

  // capture the current data to process and reset latestData
  const dataToProcess = latestInputData;
  latestInputData = null; // reset to avoid re-processing the same data
  isProcessing = true;

  try {
    const { lassoPath, elements, intersectedElements, enclosedElements } =
      dataToProcess;

    if (!Array.isArray(lassoPath) || !Array.isArray(elements)) {
      throw new Error("Invalid input: lassoPath and elements must be arrays");
    }

    if (
      !(intersectedElements instanceof Set) ||
      !(enclosedElements instanceof Set)
    ) {
      throw new Error(
        "Invalid input: intersectedElements and enclosedElements must be Sets",
      );
    }

    const result = updateSelection(dataToProcess);
    self.postMessage(result);
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : "Unknown error occurred",
      selectedElementIds: [],
    });
  } finally {
    isProcessing = false;
    // if new data arrived during processing, process it
    // as we're done with processing the previous data
    if (latestInputData) {
      processInputData();
    }
  }
};

type ElementsSegments = Map<string, LineSegment<GlobalPoint>[]>;

export type LassoWorkerInput = {
  lassoPath: GlobalPoint[];
  elements: readonly ExcalidrawElement[];
  elementsSegments: ElementsSegments;
  intersectedElements: Set<ExcalidrawElement["id"]>;
  enclosedElements: Set<ExcalidrawElement["id"]>;
};

export type LassoWorkerOutput = {
  selectedElementIds: string[];
};

export const updateSelection = (input: LassoWorkerInput): LassoWorkerOutput => {
  const {
    lassoPath,
    elements,
    elementsSegments,
    intersectedElements,
    enclosedElements,
  } = input;
  // simplify the path to reduce the number of points
  const path = simplify(lassoPath, 2) as GlobalPoint[];
  // close the path to form a polygon for enclosure check
  const closedPath = polygonFromPoints(path);
  // as the path might not enclose a shape anymore, clear before checking
  enclosedElements.clear();
  for (const element of elements) {
    if (
      !intersectedElements.has(element.id) &&
      !enclosedElements.has(element.id)
    ) {
      const enclosed = enclosureTest(closedPath, element, elementsSegments);
      if (enclosed) {
        enclosedElements.add(element.id);
      } else {
        const intersects = intersectionTest(
          closedPath,
          element,
          elementsSegments,
        );
        if (intersects) {
          intersectedElements.add(element.id);
        }
      }
    }
  }

  const results = [...intersectedElements, ...enclosedElements];

  return {
    selectedElementIds: results,
  };
};

const enclosureTest = (
  lassoPath: GlobalPoint[],
  element: ExcalidrawElement,
  elementsSegments: ElementsSegments,
): boolean => {
  const lassoPolygon = polygonFromPoints(lassoPath);
  const segments = elementsSegments.get(element.id);
  if (!segments) {
    return false;
  }

  return segments.some((segment) => {
    return segment.some((point) => polygonIncludesPoint(point, lassoPolygon));
  });
};

const intersectionTest = (
  lassoPath: GlobalPoint[],
  element: ExcalidrawElement,
  elementsSegments: ElementsSegments,
): boolean => {
  const elementSegments = elementsSegments.get(element.id);
  if (!elementSegments) {
    return false;
  }

  const lassoSegments = lassoPath.reduce((acc, point, index) => {
    if (index === 0) {
      return acc;
    }
    acc.push(lineSegment(lassoPath[index - 1], point));
    return acc;
  }, [] as LineSegment<GlobalPoint>[]);

  return lassoSegments.some((lassoSegment) =>
    elementSegments.some(
      (elementSegment) =>
        lineSegmentIntersectionPoints(lassoSegment, elementSegment) !== null,
    ),
  );
};
