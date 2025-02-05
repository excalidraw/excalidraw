/**
 * all things related to lasso selection
 * - lasso selection
 * - intersection and enclosure checks
 */

import {
  type GlobalPoint,
  type LineSegment,
  type LocalPoint,
  type Polygon,
  pointFrom,
  pointsEqual,
  polygonFromPoints,
  segmentsIntersectAt,
} from "../math";
import { isPointInShape } from "../utils/collision";
import {
  type GeometricShape,
  polylineFromPoints,
} from "../utils/geometry/shape";
import { AnimatedTrail } from "./animated-trail";
import { type AnimationFrameHandler } from "./animation-frame-handler";
import type App from "./components/App";
import { getElementLineSegments } from "./element/bounds";
import type { ElementsMap, ExcalidrawElement } from "./element/types";
import type { InteractiveCanvasRenderConfig } from "./scene/types";
import type { InteractiveCanvasAppState } from "./types";
import { easeOut } from "./utils";

export type LassoPath = {
  x: number;
  y: number;
  points: LocalPoint[];
  intersectedElements: Set<ExcalidrawElement["id"]>;
  enclosedElements: Set<ExcalidrawElement["id"]>;
};

export const renderLassoSelection = (
  lassoPath: LassoPath,
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
  selectionColor: InteractiveCanvasRenderConfig["selectionColor"],
) => {
  context.save();
  context.translate(
    lassoPath.x + appState.scrollX,
    lassoPath.y + appState.scrollY,
  );

  const firstPoint = lassoPath.points[0];

  if (firstPoint) {
    context.beginPath();
    context.moveTo(firstPoint[0], firstPoint[1]);

    for (let i = 1; i < lassoPath.points.length; i++) {
      context.lineTo(lassoPath.points[i][0], lassoPath.points[i][1]);
    }

    context.strokeStyle = selectionColor;
    context.lineWidth = 3 / appState.zoom.value;

    if (
      lassoPath.points.length >= 3 &&
      pointsEqual(
        lassoPath.points[0],
        lassoPath.points[lassoPath.points.length - 1],
      )
    ) {
      context.closePath();
    }
    context.stroke();
  }

  context.restore();
};

// export class LassoSelection {
//   static createLassoPath = (x: number, y: number): LassoPath => {
//     return {
//       x,
//       y,
//       points: [],
//       intersectedElements: new Set(),
//       enclosedElements: new Set(),
//     };
//   };

//   static updateLassoPath = (
//     lassoPath: LassoPath,
//     pointerCoords: { x: number; y: number },
//     elementsMap: ElementsMap,
//   ): LassoPath => {
//     const points = lassoPath.points;
//     const dx = pointerCoords.x - lassoPath.x;
//     const dy = pointerCoords.y - lassoPath.y;

//     const lastPoint = points.length > 0 && points[points.length - 1];
//     const discardPoint =
//       lastPoint && lastPoint[0] === dx && lastPoint[1] === dy;

//     if (!discardPoint) {
//       const nextLassoPath = {
//         ...lassoPath,
//         points: [...points, pointFrom<LocalPoint>(dx, dy)],
//       };

//       // nextLassoPath.enclosedElements.clear();

//       // const enclosedLassoPath = LassoSelection.closeLassoPath(
//       //   nextLassoPath,
//       //   elementsMap,
//       // );

//       // for (const [id, element] of elementsMap) {
//       //   if (!lassoPath.intersectedElements.has(element.id)) {
//       //     const intersects = intersect(nextLassoPath, element, elementsMap);
//       //     if (intersects) {
//       //       lassoPath.intersectedElements.add(element.id);
//       //     } else {
//       //       // check if the lasso path encloses the element
//       //       const enclosed = enclose(enclosedLassoPath, element, elementsMap);
//       //       if (enclosed) {
//       //         lassoPath.enclosedElements.add(element.id);
//       //       }
//       //     }
//       //   }
//       // }

//       return nextLassoPath;
//     }

//     return lassoPath;
//   };

//   private static closeLassoPath = (
//     lassoPath: LassoPath,
//     elementsMap: ElementsMap,
//   ) => {
//     const finalPoints = [...lassoPath.points, lassoPath.points[0]];
//     // TODO: check if the lasso path encloses or intersects with any element

//     const finalLassoPath = {
//       ...lassoPath,
//       points: finalPoints,
//     };

//     return finalLassoPath;
//   };

//   static finalizeLassoPath = (
//     lassoPath: LassoPath,
//     elementsMap: ElementsMap,
//   ) => {
//     const enclosedLassoPath = LassoSelection.closeLassoPath(
//       lassoPath,
//       elementsMap,
//     );

//     enclosedLassoPath.enclosedElements.clear();
//     enclosedLassoPath.intersectedElements.clear();

//     // for (const [id, element] of elementsMap) {
//     //   const intersects = intersect(enclosedLassoPath, element, elementsMap);
//     //   if (intersects) {
//     //     enclosedLassoPath.intersectedElements.add(element.id);
//     //   } else {
//     //     const enclosed = enclose(enclosedLassoPath, element, elementsMap);
//     //     if (enclosed) {
//     //       enclosedLassoPath.enclosedElements.add(element.id);
//     //     }
//     //   }
//     // }

//     return enclosedLassoPath;
//   };
// }

const intersectionTest = (
  lassoPath: GlobalPoint[],
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): boolean => {
  const elementLineSegments = getElementLineSegments(element, elementsMap);
  const lassoSegments = lassoPath.reduce((acc, point, index) => {
    if (index === 0) {
      return acc;
    }
    const prevPoint = pointFrom<GlobalPoint>(
      lassoPath[index - 1][0],
      lassoPath[index - 1][1],
    );
    const currentPoint = pointFrom<GlobalPoint>(point[0], point[1]);
    acc.push([prevPoint, currentPoint] as LineSegment<GlobalPoint>);
    return acc;
  }, [] as LineSegment<GlobalPoint>[]);

  for (const lassoSegment of lassoSegments) {
    for (const elementSegment of elementLineSegments) {
      if (segmentsIntersectAt(lassoSegment, elementSegment)) {
        return true;
      }
    }
  }

  return false;
};

const enclosureTest = (
  lassoPath: GlobalPoint[],
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): boolean => {
  const polyline = polylineFromPoints(lassoPath);

  const closedPathShape: GeometricShape<GlobalPoint> = {
    type: "polygon",
    data: polygonFromPoints(polyline.flat()),
  } as {
    type: "polygon";
    data: Polygon<GlobalPoint>;
  };

  const elementSegments = getElementLineSegments(element, elementsMap);

  for (const segment of elementSegments) {
    if (segment.some((point) => isPointInShape(point, closedPathShape))) {
      return true;
    }
  }

  return false;
};

export class LassoTrail extends AnimatedTrail {
  private intersectedElements: Set<ExcalidrawElement["id"]> = new Set();
  private enclosedElements: Set<ExcalidrawElement["id"]> = new Set();

  constructor(animationFrameHandler: AnimationFrameHandler, app: App) {
    super(animationFrameHandler, app, {
      simplify: 0,
      streamline: 0.4,
      sizeMapping: (c) => {
        const DECAY_TIME = Infinity;
        const DECAY_LENGTH = 5000;
        const t = Math.max(
          0,
          1 - (performance.now() - c.pressure) / DECAY_TIME,
        );
        const l =
          (DECAY_LENGTH -
            Math.min(DECAY_LENGTH, c.totalLength - c.currentIndex)) /
          DECAY_LENGTH;

        return Math.min(easeOut(l), easeOut(t));
      },
      fill: () => "rgb(0,118,255)",
    });
  }

  startPath(x: number, y: number) {
    super.startPath(x, y);
    this.intersectedElements.clear();
    this.enclosedElements.clear();
  }

  addPointToPath(x: number, y: number) {
    super.addPointToPath(x, y);
    const lassoPath = super
      .getCurrentTrail()
      ?.originalPoints?.map((p) => pointFrom<GlobalPoint>(p[0], p[1]));
    if (lassoPath) {
      // TODO: further OPT: do not check elements that are "far away"
      const elementsMap = this.app.scene.getNonDeletedElementsMap();
      const closedPath = polygonFromPoints(lassoPath);
      // need to clear the enclosed elements as path might change
      this.enclosedElements.clear();
      for (const [, element] of elementsMap) {
        if (!this.intersectedElements.has(element.id)) {
          const intersects = intersectionTest(lassoPath, element, elementsMap);
          if (intersects) {
            this.intersectedElements.add(element.id);
          } else {
            // TODO: check bounding box is at least in the lasso path area first
            // BUT: need to compare bounding box check with enclosure check performance
            const enclosed = enclosureTest(closedPath, element, elementsMap);
            if (enclosed) {
              this.enclosedElements.add(element.id);
            }
          }
        }
      }
    }

    return {
      intersectedElementIds: this.intersectedElements,
      enclosedElementIds: this.enclosedElements,
    };
  }

  endPath(): void {
    super.endPath();
    super.clearTrails();
    this.intersectedElements.clear();
    this.enclosedElements.clear();
  }
}
