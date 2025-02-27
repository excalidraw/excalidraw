import { pointsOnBezierCurves } from "points-on-curve";
import {
  type Curve,
  type GlobalPoint,
  type LineSegment,
  type Radians,
  lineSegment,
  pointFrom,
  pointRotateRads,
} from "../../math";
import { AnimatedTrail } from "../animated-trail";
import { type AnimationFrameHandler } from "../animation-frame-handler";
import type App from "../components/App";
import { LinearElementEditor } from "../element/linearElementEditor";
import { isFrameLikeElement, isLinearElement } from "../element/typeChecks";
import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawEllipseElement,
  ExcalidrawLinearElement,
  ExcalidrawRectanguloidElement,
  NonDeleted,
} from "../element/types";
import { getFrameChildren } from "../frame";
import { selectGroupsForSelectedElements } from "../groups";
import { getElementShape } from "../shapes";
import { arrayToMap, easeOut } from "../utils";
import type { LassoWorkerInput, LassoWorkerOutput } from "./worker";
import {
  deconstructDiamondElement,
  deconstructRectanguloidElement,
} from "../element/utils";
import { getElementAbsoluteCoords } from "../element";

export class LassoTrail extends AnimatedTrail {
  private intersectedElements: Set<ExcalidrawElement["id"]> = new Set();
  private enclosedElements: Set<ExcalidrawElement["id"]> = new Set();
  private worker: Worker | null = null;
  private elementsSegments: Map<string, LineSegment<GlobalPoint>[]> | null =
    null;

  constructor(animationFrameHandler: AnimationFrameHandler, app: App) {
    super(animationFrameHandler, app, {
      animateTrail: true,
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
      fill: () => "rgba(0,118,255)",
    });
  }

  startPath(x: number, y: number) {
    // clear any existing trails just in case
    this.endPath();

    super.startPath(x, y);
    this.intersectedElements.clear();
    this.enclosedElements.clear();

    this.worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });

    this.worker.onmessage = (event: MessageEvent<LassoWorkerOutput>) => {
      const { selectedElementIds } = event.data;

      this.app.setState((prevState) => {
        const nextSelectedElementIds = selectedElementIds.reduce((acc, id) => {
          acc[id] = true;
          return acc;
        }, {} as Record<ExcalidrawElement["id"], true>);

        for (const [id] of Object.entries(nextSelectedElementIds)) {
          const element = this.app.scene.getNonDeletedElement(id);
          if (element && isFrameLikeElement(element)) {
            const elementsInFrame = getFrameChildren(
              this.app.scene.getNonDeletedElementsMap(),
              element.id,
            );
            for (const child of elementsInFrame) {
              delete nextSelectedElementIds[child.id];
            }
          }
        }

        const nextSelection = selectGroupsForSelectedElements(
          {
            editingGroupId: prevState.editingGroupId,
            selectedElementIds: nextSelectedElementIds,
          },
          this.app.scene.getNonDeletedElements(),
          prevState,
          this.app,
        );

        const selectedIds = [...Object.keys(nextSelection.selectedElementIds)];
        const selectedGroupIds = [
          ...Object.keys(nextSelection.selectedGroupIds),
        ];

        return {
          selectedElementIds: nextSelection.selectedElementIds,
          selectedGroupIds: nextSelection.selectedGroupIds,
          selectedLinearElement:
            selectedIds.length === 1 &&
            !selectedGroupIds.length &&
            isLinearElement(this.app.scene.getNonDeletedElement(selectedIds[0]))
              ? new LinearElementEditor(
                  this.app.scene.getNonDeletedElement(
                    selectedIds[0],
                  ) as NonDeleted<ExcalidrawLinearElement>,
                )
              : null,
        };
      });
    };

    this.worker.onerror = (error) => {
      console.error("Worker error:", error);
    };
  }

  addPointToPath = (x: number, y: number) => {
    super.addPointToPath(x, y);

    this.app.setState({
      lassoSelection: {
        points:
          (this.getCurrentTrail()?.originalPoints?.map((p) =>
            pointFrom<GlobalPoint>(p[0], p[1]),
          ) as readonly GlobalPoint[]) ?? null,
      },
    });

    this.updateSelection();
  };

  private updateSelection = () => {
    const lassoPath = super
      .getCurrentTrail()
      ?.originalPoints?.map((p) => pointFrom<GlobalPoint>(p[0], p[1]));

    if (!this.elementsSegments) {
      this.elementsSegments = new Map();
      const visibleElementsMap = arrayToMap(this.app.visibleElements);
      for (const element of this.app.visibleElements) {
        const segments = getElementLineSegments(element, visibleElementsMap);
        this.elementsSegments.set(element.id, segments);
      }
    }

    if (lassoPath) {
      const message: LassoWorkerInput = {
        lassoPath,
        elements: this.app.visibleElements,
        elementsSegments: this.elementsSegments,
        intersectedElements: this.intersectedElements,
        enclosedElements: this.enclosedElements,
      };

      this.worker?.postMessage(message);
    }
  };

  endPath(): void {
    super.endPath();
    super.clearTrails();
    this.intersectedElements.clear();
    this.enclosedElements.clear();
    this.elementsSegments = null;
    this.app.setState({
      lassoSelection: null,
    });
    this.worker?.terminate();
  }
}

/**
 * Given an element, return the line segments that make up the element.
 *
 * Uses helpers from /math
 */
const getElementLineSegments = (
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
): LineSegment<GlobalPoint>[] => {
  const shape = getElementShape(element, elementsMap);
  const [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(
    element,
    elementsMap,
  );
  const center = pointFrom<GlobalPoint>(cx, cy);

  if (shape.type === "polycurve") {
    const curves = shape.data;
    const points = curves
      .map((curve) => pointsOnBezierCurves(curve, 10))
      .flat();
    let i = 0;
    const segments: LineSegment<GlobalPoint>[] = [];
    while (i < points.length - 1) {
      segments.push(
        lineSegment(
          pointFrom(points[i][0], points[i][1]),
          pointFrom(points[i + 1][0], points[i + 1][1]),
        ),
      );
      i++;
    }

    return segments;
  } else if (shape.type === "polyline") {
    return shape.data as LineSegment<GlobalPoint>[];
  } else if (isRectanguloidElement(element)) {
    const [sides, corners] = deconstructRectanguloidElement(element);
    const cornerSegments: LineSegment<GlobalPoint>[] = corners
      .map((corner) => getSegmentsOnCurve(corner, center, element.angle))
      .flat();
    const rotatedSides = getRotatedSides(sides, center, element.angle);
    return [...rotatedSides, ...cornerSegments];
  } else if (element.type === "diamond") {
    const [sides, corners] = deconstructDiamondElement(element);
    const cornerSegments = corners
      .map((corner) => getSegmentsOnCurve(corner, center, element.angle))
      .flat();
    const rotatedSides = getRotatedSides(sides, center, element.angle);

    return [...rotatedSides, ...cornerSegments];
  } else if (shape.type === "polygon") {
    const points = shape.data as GlobalPoint[];
    const segments: LineSegment<GlobalPoint>[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      segments.push(lineSegment(points[i], points[i + 1]));
    }
    return segments;
  } else if (shape.type === "ellipse") {
    return getSegmentsOnEllipse(element as ExcalidrawEllipseElement);
  }

  const [nw, ne, sw, se, , , w, e] = (
    [
      [x1, y1],
      [x2, y1],
      [x1, y2],
      [x2, y2],
      [cx, y1],
      [cx, y2],
      [x1, cy],
      [x2, cy],
    ] as GlobalPoint[]
  ).map((point) => pointRotateRads(point, center, element.angle));

  return [
    lineSegment(nw, ne),
    lineSegment(sw, se),
    lineSegment(nw, sw),
    lineSegment(ne, se),
    lineSegment(nw, e),
    lineSegment(sw, e),
    lineSegment(ne, w),
    lineSegment(se, w),
  ];
};

const isRectanguloidElement = (
  element: ExcalidrawElement,
): element is ExcalidrawRectanguloidElement => {
  return (
    element != null &&
    (element.type === "rectangle" ||
      element.type === "image" ||
      element.type === "iframe" ||
      element.type === "embeddable" ||
      element.type === "frame" ||
      element.type === "magicframe" ||
      (element.type === "text" && !element.containerId))
  );
};

const getRotatedSides = (
  sides: LineSegment<GlobalPoint>[],
  center: GlobalPoint,
  angle: Radians,
) => {
  return sides.map((side) => {
    return lineSegment(
      pointRotateRads<GlobalPoint>(side[0], center, angle),
      pointRotateRads<GlobalPoint>(side[1], center, angle),
    );
  });
};

const getSegmentsOnCurve = (
  curve: Curve<GlobalPoint>,
  center: GlobalPoint,
  angle: Radians,
): LineSegment<GlobalPoint>[] => {
  const points = pointsOnBezierCurves(curve, 10);
  let i = 0;
  const segments: LineSegment<GlobalPoint>[] = [];
  while (i < points.length - 1) {
    segments.push(
      lineSegment(
        pointRotateRads<GlobalPoint>(
          pointFrom(points[i][0], points[i][1]),
          center,
          angle,
        ),
        pointRotateRads<GlobalPoint>(
          pointFrom(points[i + 1][0], points[i + 1][1]),
          center,
          angle,
        ),
      ),
    );
    i++;
  }

  return segments;
};

const getSegmentsOnEllipse = (
  ellipse: ExcalidrawEllipseElement,
): LineSegment<GlobalPoint>[] => {
  const center = pointFrom<GlobalPoint>(
    ellipse.x + ellipse.width / 2,
    ellipse.y + ellipse.height / 2,
  );

  const a = ellipse.width / 2;
  const b = ellipse.height / 2;

  const segments: LineSegment<GlobalPoint>[] = [];
  const points: GlobalPoint[] = [];
  const n = 90;
  const deltaT = (Math.PI * 2) / n;

  for (let i = 0; i < n; i++) {
    const t = i * deltaT;
    const x = center[0] + a * Math.cos(t);
    const y = center[1] + b * Math.sin(t);
    points.push(pointRotateRads(pointFrom(x, y), center, ellipse.angle));
  }

  for (let i = 0; i < points.length - 1; i++) {
    segments.push(lineSegment(points[i], points[i + 1]));
  }

  segments.push(lineSegment(points[points.length - 1], points[0]));
  return segments;
};
