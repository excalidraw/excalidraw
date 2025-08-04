import {
  pointCenter,
  pointFrom,
  pointRotateRads,
  pointsEqual,
  type GlobalPoint,
  type LocalPoint,
  pointDistance,
  vectorFromPoint,
  curveLength,
  curvePointAtLength,
} from "@excalidraw/math";

import { getCurvePathOps } from "@excalidraw/utils/shape";

import {
  DRAGGING_THRESHOLD,
  KEYS,
  shouldRotateWithDiscreteAngle,
  getGridPoint,
  invariant,
  tupleToCoors,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import {
  deconstructLinearOrFreeDrawElement,
  isPathALoop,
  type Store,
} from "@excalidraw/element";

import type { Radians } from "@excalidraw/math";

import type {
  AppState,
  PointerCoords,
  InteractiveCanvasAppState,
  AppClassProperties,
  NullableGridSize,
  Zoom,
} from "@excalidraw/excalidraw/types";

import type { Mutable } from "@excalidraw/common/utility-types";

import {
  bindOrUnbindLinearElement,
  getHoveredElementForBinding,
  isBindingEnabled,
  maybeSuggestBindingsForLinearElementAtCoords,
} from "./binding";
import {
  getElementAbsoluteCoords,
  getElementPointsCoords,
  getMinMaxXYFromCurvePathOps,
} from "./bounds";

import { headingIsHorizontal, vectorToHeading } from "./heading";
import { mutateElement } from "./mutateElement";
import { getBoundTextElement, handleBindTextResize } from "./textElement";
import {
  isBindingElement,
  isElbowArrow,
  isFixedPointBinding,
} from "./typeChecks";

import { ShapeCache, toggleLinePolygonState } from "./shape";

import { getLockedLinearCursorAlignSize } from "./sizeHelpers";

import { isLineElement } from "./typeChecks";

import type { Scene } from "./Scene";

import type { Bounds } from "./bounds";
import type {
  NonDeleted,
  ExcalidrawLinearElement,
  ExcalidrawElement,
  PointBinding,
  ExcalidrawBindableElement,
  ExcalidrawTextElementWithContainer,
  ElementsMap,
  NonDeletedSceneElementsMap,
  FixedPointBinding,
  FixedSegment,
  ExcalidrawElbowArrowElement,
  PointsPositionUpdates,
} from "./types";

/**
 * Normalizes line points so that the start point is at [0,0]. This is
 * expected in various parts of the codebase.
 *
 * Also returns the offsets - [0,0] if no normalization needed.
 *
 * @private
 */
const getNormalizedPoints = ({
  points,
}: {
  points: ExcalidrawLinearElement["points"];
}): {
  points: LocalPoint[];
  offsetX: number;
  offsetY: number;
} => {
  const offsetX = points[0][0];
  const offsetY = points[0][1];

  return {
    points: points.map((p) => {
      return pointFrom(p[0] - offsetX, p[1] - offsetY);
    }),
    offsetX,
    offsetY,
  };
};

export class LinearElementEditor {
  public readonly elementId: ExcalidrawElement["id"] & {
    _brand: "excalidrawLinearElementId";
  };
  /** indices */
  public readonly selectedPointsIndices: readonly number[] | null;

  public readonly pointerDownState: Readonly<{
    prevSelectedPointsIndices: readonly number[] | null;
    /** index */
    lastClickedPoint: number;
    lastClickedIsEndPoint: boolean;
    origin: Readonly<{ x: number; y: number }> | null;
    segmentMidpoint: {
      value: GlobalPoint | null;
      index: number | null;
      added: boolean;
    };
  }>;

  /** whether you're dragging a point */
  public readonly isDragging: boolean;
  public readonly lastUncommittedPoint: LocalPoint | null;
  public readonly pointerOffset: Readonly<{ x: number; y: number }>;
  public readonly startBindingElement:
    | ExcalidrawBindableElement
    | null
    | "keep";
  public readonly endBindingElement: ExcalidrawBindableElement | null | "keep";
  public readonly hoverPointIndex: number;
  public readonly segmentMidPointHoveredCoords: GlobalPoint | null;
  public readonly elbowed: boolean;
  public readonly customLineAngle: number | null;
  public readonly isEditing: boolean;

  constructor(
    element: NonDeleted<ExcalidrawLinearElement>,
    elementsMap: ElementsMap,
    isEditing: boolean = false,
  ) {
    this.elementId = element.id as string & {
      _brand: "excalidrawLinearElementId";
    };
    if (!pointsEqual(element.points[0], pointFrom(0, 0))) {
      console.error("Linear element is not normalized", Error().stack);
      mutateElement(
        element,
        elementsMap,
        LinearElementEditor.getNormalizeElementPointsAndCoords(element),
      );
    }
    this.selectedPointsIndices = null;
    this.lastUncommittedPoint = null;
    this.isDragging = false;
    this.pointerOffset = { x: 0, y: 0 };
    this.startBindingElement = "keep";
    this.endBindingElement = "keep";
    this.pointerDownState = {
      prevSelectedPointsIndices: null,
      lastClickedPoint: -1,
      lastClickedIsEndPoint: false,
      origin: null,

      segmentMidpoint: {
        value: null,
        index: null,
        added: false,
      },
    };
    this.hoverPointIndex = -1;
    this.segmentMidPointHoveredCoords = null;
    this.elbowed = isElbowArrow(element) && element.elbowed;
    this.customLineAngle = null;
    this.isEditing = isEditing;
  }

  // ---------------------------------------------------------------------------
  // static methods
  // ---------------------------------------------------------------------------

  static POINT_HANDLE_SIZE = 10;

  /**
   * @param id the `elementId` from the instance of this class (so that we can
   *  statically guarantee this method returns an ExcalidrawLinearElement)
   */
  static getElement<T extends ExcalidrawLinearElement>(
    id: InstanceType<typeof LinearElementEditor>["elementId"],
    elementsMap: ElementsMap,
  ): T | null {
    const element = elementsMap.get(id);
    if (element) {
      return element as NonDeleted<T>;
    }
    return null;
  }

  static handleBoxSelection(
    event: PointerEvent,
    appState: AppState,
    setState: React.Component<any, AppState>["setState"],
    elementsMap: NonDeletedSceneElementsMap,
  ) {
    if (
      !appState.selectedLinearElement?.isEditing ||
      !appState.selectionElement
    ) {
      return false;
    }
    const { selectedLinearElement } = appState;
    const { selectedPointsIndices, elementId } = selectedLinearElement;

    const element = LinearElementEditor.getElement(elementId, elementsMap);
    if (!element) {
      return false;
    }

    const [selectionX1, selectionY1, selectionX2, selectionY2] =
      getElementAbsoluteCoords(appState.selectionElement, elementsMap);

    const pointsSceneCoords = LinearElementEditor.getPointsGlobalCoordinates(
      element,
      elementsMap,
    );

    const nextSelectedPoints = pointsSceneCoords
      .reduce((acc: number[], point, index) => {
        if (
          (point[0] >= selectionX1 &&
            point[0] <= selectionX2 &&
            point[1] >= selectionY1 &&
            point[1] <= selectionY2) ||
          (event.shiftKey && selectedPointsIndices?.includes(index))
        ) {
          acc.push(index);
        }

        return acc;
      }, [])
      .filter((index) => {
        if (
          isElbowArrow(element) &&
          index !== 0 &&
          index !== element.points.length - 1
        ) {
          return false;
        }
        return true;
      });

    setState({
      selectedLinearElement: {
        ...selectedLinearElement,
        selectedPointsIndices: nextSelectedPoints.length
          ? nextSelectedPoints
          : null,
      },
    });
  }

  /**
   * @returns whether point was dragged
   */
  static handlePointDragging(
    event: PointerEvent,
    app: AppClassProperties,
    scenePointerX: number,
    scenePointerY: number,
    linearElementEditor: LinearElementEditor,
  ): Pick<AppState, keyof AppState> | null {
    if (!linearElementEditor) {
      return null;
    }
    const { elementId } = linearElementEditor;
    const elementsMap = app.scene.getNonDeletedElementsMap();
    const element = LinearElementEditor.getElement(elementId, elementsMap);
    let customLineAngle = linearElementEditor.customLineAngle;
    if (!element) {
      return null;
    }

    if (
      isElbowArrow(element) &&
      !linearElementEditor.pointerDownState.lastClickedIsEndPoint &&
      linearElementEditor.pointerDownState.lastClickedPoint !== 0
    ) {
      return null;
    }

    const selectedPointsIndices = isElbowArrow(element)
      ? [
          !!linearElementEditor.selectedPointsIndices?.includes(0)
            ? 0
            : undefined,
          !!linearElementEditor.selectedPointsIndices?.find((idx) => idx > 0)
            ? element.points.length - 1
            : undefined,
        ].filter((idx): idx is number => idx !== undefined)
      : linearElementEditor.selectedPointsIndices;
    const lastClickedPoint = isElbowArrow(element)
      ? linearElementEditor.pointerDownState.lastClickedPoint > 0
        ? element.points.length - 1
        : 0
      : linearElementEditor.pointerDownState.lastClickedPoint;

    // point that's being dragged (out of all selected points)
    const draggingPoint = element.points[lastClickedPoint];

    if (selectedPointsIndices && draggingPoint) {
      if (
        shouldRotateWithDiscreteAngle(event) &&
        selectedPointsIndices.length === 1 &&
        element.points.length > 1
      ) {
        const selectedIndex = selectedPointsIndices[0];
        const referencePoint =
          element.points[selectedIndex === 0 ? 1 : selectedIndex - 1];
        customLineAngle =
          linearElementEditor.customLineAngle ??
          Math.atan2(
            element.points[selectedIndex][1] - referencePoint[1],
            element.points[selectedIndex][0] - referencePoint[0],
          );

        const [width, height] = LinearElementEditor._getShiftLockedDelta(
          element,
          elementsMap,
          referencePoint,
          pointFrom(scenePointerX, scenePointerY),
          event[KEYS.CTRL_OR_CMD] ? null : app.getEffectiveGridSize(),
          customLineAngle,
        );

        LinearElementEditor.movePoints(
          element,
          app.scene,
          new Map([
            [
              selectedIndex,
              {
                point: pointFrom(
                  width + referencePoint[0],
                  height + referencePoint[1],
                ),
                isDragging: selectedIndex === lastClickedPoint,
              },
            ],
          ]),
        );
      } else {
        const newDraggingPointPosition = LinearElementEditor.createPointAt(
          element,
          elementsMap,
          scenePointerX - linearElementEditor.pointerOffset.x,
          scenePointerY - linearElementEditor.pointerOffset.y,
          event[KEYS.CTRL_OR_CMD] ? null : app.getEffectiveGridSize(),
        );

        const deltaX = newDraggingPointPosition[0] - draggingPoint[0];
        const deltaY = newDraggingPointPosition[1] - draggingPoint[1];

        LinearElementEditor.movePoints(
          element,
          app.scene,
          new Map(
            selectedPointsIndices.map((pointIndex) => {
              const newPointPosition: LocalPoint =
                pointIndex === lastClickedPoint
                  ? LinearElementEditor.createPointAt(
                      element,
                      elementsMap,
                      scenePointerX - linearElementEditor.pointerOffset.x,
                      scenePointerY - linearElementEditor.pointerOffset.y,
                      event[KEYS.CTRL_OR_CMD]
                        ? null
                        : app.getEffectiveGridSize(),
                    )
                  : pointFrom(
                      element.points[pointIndex][0] + deltaX,
                      element.points[pointIndex][1] + deltaY,
                    );
              return [
                pointIndex,
                {
                  point: newPointPosition,
                  isDragging: pointIndex === lastClickedPoint,
                },
              ];
            }),
          ),
        );
      }

      const boundTextElement = getBoundTextElement(element, elementsMap);
      if (boundTextElement) {
        handleBindTextResize(element, app.scene, false);
      }

      // suggest bindings for first and last point if selected
      let suggestedBindings: ExcalidrawBindableElement[] = [];
      if (isBindingElement(element, false)) {
        const firstSelectedIndex = selectedPointsIndices[0] === 0;
        const lastSelectedIndex =
          selectedPointsIndices[selectedPointsIndices.length - 1] ===
          element.points.length - 1;
        const coords: { x: number; y: number }[] = [];

        if (!firstSelectedIndex !== !lastSelectedIndex) {
          coords.push({ x: scenePointerX, y: scenePointerY });
        } else {
          if (firstSelectedIndex) {
            coords.push(
              tupleToCoors(
                LinearElementEditor.getPointGlobalCoordinates(
                  element,
                  element.points[0],
                  elementsMap,
                ),
              ),
            );
          }

          if (lastSelectedIndex) {
            coords.push(
              tupleToCoors(
                LinearElementEditor.getPointGlobalCoordinates(
                  element,
                  element.points[
                    selectedPointsIndices[selectedPointsIndices.length - 1]
                  ],
                  elementsMap,
                ),
              ),
            );
          }
        }

        if (coords.length) {
          suggestedBindings = maybeSuggestBindingsForLinearElementAtCoords(
            element,
            coords,
            app.scene,
            app.state.zoom,
          );
        }
      }

      const newLinearElementEditor = {
        ...linearElementEditor,
        selectedPointsIndices,
        segmentMidPointHoveredCoords:
          lastClickedPoint !== 0 &&
          lastClickedPoint !== element.points.length - 1
            ? this.getPointGlobalCoordinates(
                element,
                draggingPoint,
                elementsMap,
              )
            : null,
        hoverPointIndex:
          lastClickedPoint === 0 ||
          lastClickedPoint === element.points.length - 1
            ? lastClickedPoint
            : -1,
        isDragging: true,
        customLineAngle,
      };

      return {
        ...app.state,
        selectedLinearElement: newLinearElementEditor,
        suggestedBindings,
      };
    }

    return null;
  }

  static handlePointerUp(
    event: PointerEvent,
    editingLinearElement: LinearElementEditor,
    appState: AppState,
    scene: Scene,
  ): LinearElementEditor {
    const elementsMap = scene.getNonDeletedElementsMap();
    const elements = scene.getNonDeletedElements();
    const pointerCoords = viewportCoordsToSceneCoords(event, appState);

    const { elementId, selectedPointsIndices, isDragging, pointerDownState } =
      editingLinearElement;
    const element = LinearElementEditor.getElement(elementId, elementsMap);
    if (!element) {
      return editingLinearElement;
    }

    const bindings: Mutable<
      Partial<
        Pick<
          InstanceType<typeof LinearElementEditor>,
          "startBindingElement" | "endBindingElement"
        >
      >
    > = {};

    if (isDragging && selectedPointsIndices) {
      for (const selectedPoint of selectedPointsIndices) {
        if (
          selectedPoint === 0 ||
          selectedPoint === element.points.length - 1
        ) {
          if (isPathALoop(element.points, appState.zoom.value)) {
            if (isLineElement(element)) {
              scene.mutateElement(
                element,
                {
                  ...toggleLinePolygonState(element, true),
                },
                {
                  informMutation: false,
                  isDragging: false,
                },
              );
            }
            LinearElementEditor.movePoints(
              element,
              scene,
              new Map([
                [
                  selectedPoint,
                  {
                    point:
                      selectedPoint === 0
                        ? element.points[element.points.length - 1]
                        : element.points[0],
                  },
                ],
              ]),
            );
          }

          const bindingElement = isBindingEnabled(appState)
            ? getHoveredElementForBinding(
                (selectedPointsIndices?.length ?? 0) > 1
                  ? tupleToCoors(
                      LinearElementEditor.getPointAtIndexGlobalCoordinates(
                        element,
                        selectedPoint!,
                        elementsMap,
                      ),
                    )
                  : pointerCoords,
                elements,
                elementsMap,
                appState.zoom,
                isElbowArrow(element),
                isElbowArrow(element),
              )
            : null;

          bindings[
            selectedPoint === 0 ? "startBindingElement" : "endBindingElement"
          ] = bindingElement;
        }
      }
    }

    return {
      ...editingLinearElement,
      ...bindings,
      segmentMidPointHoveredCoords: null,
      hoverPointIndex: -1,
      // if clicking without previously dragging a point(s), and not holding
      // shift, deselect all points except the one clicked. If holding shift,
      // toggle the point.
      selectedPointsIndices:
        isDragging || event.shiftKey
          ? !isDragging &&
            event.shiftKey &&
            pointerDownState.prevSelectedPointsIndices?.includes(
              pointerDownState.lastClickedPoint,
            )
            ? selectedPointsIndices &&
              selectedPointsIndices.filter(
                (pointIndex) =>
                  pointIndex !== pointerDownState.lastClickedPoint,
              )
            : selectedPointsIndices
          : selectedPointsIndices?.includes(pointerDownState.lastClickedPoint)
          ? [pointerDownState.lastClickedPoint]
          : selectedPointsIndices,
      isDragging: false,
      pointerOffset: { x: 0, y: 0 },
      customLineAngle: null,
    };
  }

  static getEditorMidPoints = (
    element: NonDeleted<ExcalidrawLinearElement>,
    elementsMap: ElementsMap,
    appState: InteractiveCanvasAppState,
  ): (GlobalPoint | null)[] => {
    const boundText = getBoundTextElement(element, elementsMap);

    // Since its not needed outside editor unless 2 pointer lines or bound text
    if (
      !isElbowArrow(element) &&
      !appState.selectedLinearElement?.isEditing &&
      element.points.length > 2 &&
      !boundText
    ) {
      return [];
    }

    const points = LinearElementEditor.getPointsGlobalCoordinates(
      element,
      elementsMap,
    );

    let index = 0;
    const midpoints: (GlobalPoint | null)[] = [];
    while (index < points.length - 1) {
      if (
        LinearElementEditor.isSegmentTooShort(
          element,
          element.points[index],
          element.points[index + 1],
          index,
          appState.zoom,
        )
      ) {
        midpoints.push(null);
        index++;
        continue;
      }
      const segmentMidPoint = LinearElementEditor.getSegmentMidPoint(
        element,
        index + 1,
      );
      midpoints.push(segmentMidPoint);
      index++;
    }

    return midpoints;
  };

  static getSegmentMidpointHitCoords = (
    linearElementEditor: LinearElementEditor,
    scenePointer: { x: number; y: number },
    appState: AppState,
    elementsMap: ElementsMap,
  ): GlobalPoint | null => {
    const { elementId } = linearElementEditor;
    const element = LinearElementEditor.getElement(elementId, elementsMap);
    if (!element) {
      return null;
    }
    const clickedPointIndex = LinearElementEditor.getPointIndexUnderCursor(
      element,
      elementsMap,
      appState.zoom,
      scenePointer.x,
      scenePointer.y,
    );
    if (!isElbowArrow(element) && clickedPointIndex >= 0) {
      return null;
    }
    const points = LinearElementEditor.getPointsGlobalCoordinates(
      element,
      elementsMap,
    );
    if (
      points.length >= 3 &&
      !appState.selectedLinearElement?.isEditing &&
      !isElbowArrow(element)
    ) {
      return null;
    }

    const threshold =
      (LinearElementEditor.POINT_HANDLE_SIZE + 1) / appState.zoom.value;

    const existingSegmentMidpointHitCoords =
      linearElementEditor.segmentMidPointHoveredCoords;
    if (existingSegmentMidpointHitCoords) {
      const distance = pointDistance(
        pointFrom(
          existingSegmentMidpointHitCoords[0],
          existingSegmentMidpointHitCoords[1],
        ),
        pointFrom(scenePointer.x, scenePointer.y),
      );
      if (distance <= threshold) {
        return existingSegmentMidpointHitCoords;
      }
    }
    let index = 0;
    const midPoints = LinearElementEditor.getEditorMidPoints(
      element,
      elementsMap,
      appState,
    );

    while (index < midPoints.length) {
      if (midPoints[index] !== null) {
        const distance = pointDistance(
          midPoints[index]!,
          pointFrom(scenePointer.x, scenePointer.y),
        );
        if (distance <= threshold) {
          return midPoints[index];
        }
      }

      index++;
    }
    return null;
  };

  static isSegmentTooShort<P extends GlobalPoint | LocalPoint>(
    element: NonDeleted<ExcalidrawLinearElement>,
    startPoint: P,
    endPoint: P,
    index: number,
    zoom: Zoom,
  ) {
    if (isElbowArrow(element)) {
      if (index >= 0 && index < element.points.length) {
        return (
          pointDistance(startPoint, endPoint) * zoom.value <
          LinearElementEditor.POINT_HANDLE_SIZE / 2
        );
      }

      return false;
    }

    let distance = pointDistance(startPoint, endPoint);
    if (element.points.length > 2 && element.roundness) {
      const [lines, curves] = deconstructLinearOrFreeDrawElement(element);

      invariant(
        lines.length === 0 && curves.length > 0,
        "Only linears built out of curves are supported",
      );
      invariant(
        lines.length + curves.length >= index,
        "Invalid segment index while calculating mid point",
      );

      distance = curveLength<GlobalPoint>(curves[index]);
    }

    return distance * zoom.value < LinearElementEditor.POINT_HANDLE_SIZE * 4;
  }

  static getSegmentMidPoint(
    element: NonDeleted<ExcalidrawLinearElement>,
    index: number,
  ): GlobalPoint {
    if (isElbowArrow(element)) {
      invariant(
        element.points.length >= index,
        "Invalid segment index while calculating elbow arrow mid point",
      );

      const p = pointCenter(element.points[index - 1], element.points[index]);

      return pointFrom<GlobalPoint>(element.x + p[0], element.y + p[1]);
    }

    const [lines, curves] = deconstructLinearOrFreeDrawElement(element);

    invariant(
      (lines.length === 0 && curves.length > 0) ||
        (lines.length > 0 && curves.length === 0),
      "Only linears built out of either segments or curves are supported",
    );
    invariant(
      lines.length + curves.length >= index,
      "Invalid segment index while calculating mid point",
    );

    if (lines.length) {
      const segment = lines[index - 1];
      return pointCenter(segment[0], segment[1]);
    }

    if (curves.length) {
      const segment = curves[index - 1];
      return curvePointAtLength(segment, 0.5);
    }

    invariant(false, "Invalid segment type while calculating mid point");
  }

  static getSegmentMidPointIndex(
    linearElementEditor: LinearElementEditor,
    appState: AppState,
    midPoint: GlobalPoint,
    elementsMap: ElementsMap,
  ) {
    const element = LinearElementEditor.getElement(
      linearElementEditor.elementId,
      elementsMap,
    );
    if (!element) {
      return -1;
    }
    const midPoints = LinearElementEditor.getEditorMidPoints(
      element,
      elementsMap,
      appState,
    );
    let index = 0;
    while (index < midPoints.length) {
      if (LinearElementEditor.arePointsEqual(midPoint, midPoints[index])) {
        return index + 1;
      }
      index++;
    }
    return -1;
  }

  static handlePointerDown(
    event: React.PointerEvent<HTMLElement>,
    app: AppClassProperties,
    store: Store,
    scenePointer: { x: number; y: number },
    linearElementEditor: LinearElementEditor,
    scene: Scene,
  ): {
    didAddPoint: boolean;
    hitElement: NonDeleted<ExcalidrawElement> | null;
    linearElementEditor: LinearElementEditor | null;
  } {
    const appState = app.state;
    const elementsMap = scene.getNonDeletedElementsMap();
    const elements = scene.getNonDeletedElements();

    const ret: ReturnType<typeof LinearElementEditor["handlePointerDown"]> = {
      didAddPoint: false,
      hitElement: null,
      linearElementEditor: null,
    };

    if (!linearElementEditor) {
      return ret;
    }

    const { elementId } = linearElementEditor;
    const element = LinearElementEditor.getElement(elementId, elementsMap);

    if (!element) {
      return ret;
    }
    const segmentMidpoint = LinearElementEditor.getSegmentMidpointHitCoords(
      linearElementEditor,
      scenePointer,
      appState,
      elementsMap,
    );
    let segmentMidpointIndex = null;
    if (segmentMidpoint) {
      segmentMidpointIndex = LinearElementEditor.getSegmentMidPointIndex(
        linearElementEditor,
        appState,
        segmentMidpoint,
        elementsMap,
      );
    } else if (event.altKey && appState.selectedLinearElement?.isEditing) {
      if (linearElementEditor.lastUncommittedPoint == null) {
        scene.mutateElement(element, {
          points: [
            ...element.points,
            LinearElementEditor.createPointAt(
              element,
              elementsMap,
              scenePointer.x,
              scenePointer.y,
              event[KEYS.CTRL_OR_CMD] ? null : app.getEffectiveGridSize(),
            ),
          ],
        });
        ret.didAddPoint = true;
      }
      store.scheduleCapture();
      ret.linearElementEditor = {
        ...linearElementEditor,
        pointerDownState: {
          prevSelectedPointsIndices: linearElementEditor.selectedPointsIndices,
          lastClickedPoint: -1,
          lastClickedIsEndPoint: false,
          origin: { x: scenePointer.x, y: scenePointer.y },
          segmentMidpoint: {
            value: segmentMidpoint,
            index: segmentMidpointIndex,
            added: false,
          },
        },
        selectedPointsIndices: [element.points.length - 1],
        lastUncommittedPoint: null,
        endBindingElement: getHoveredElementForBinding(
          scenePointer,
          elements,
          elementsMap,
          app.state.zoom,
          linearElementEditor.elbowed,
        ),
      };

      ret.didAddPoint = true;
      return ret;
    }

    const clickedPointIndex = LinearElementEditor.getPointIndexUnderCursor(
      element,
      elementsMap,
      appState.zoom,
      scenePointer.x,
      scenePointer.y,
    );
    // if we clicked on a point, set the element as hitElement otherwise
    // it would get deselected if the point is outside the hitbox area
    if (clickedPointIndex >= 0 || segmentMidpoint) {
      ret.hitElement = element;
    } else {
      // You might be wandering why we are storing the binding elements on
      // LinearElementEditor and passing them in, instead of calculating them
      // from the end points of the `linearElement` - this is to allow disabling
      // binding (which needs to happen at the point the user finishes moving
      // the point).
      const { startBindingElement, endBindingElement } = linearElementEditor;
      if (isBindingEnabled(appState) && isBindingElement(element)) {
        bindOrUnbindLinearElement(
          element,
          startBindingElement,
          endBindingElement,
          scene,
        );
      }
    }

    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const targetPoint =
      clickedPointIndex > -1 &&
      pointRotateRads(
        pointFrom(
          element.x + element.points[clickedPointIndex][0],
          element.y + element.points[clickedPointIndex][1],
        ),
        pointFrom(cx, cy),
        element.angle,
      );

    const nextSelectedPointsIndices =
      clickedPointIndex > -1 || event.shiftKey
        ? event.shiftKey ||
          linearElementEditor.selectedPointsIndices?.includes(clickedPointIndex)
          ? normalizeSelectedPoints([
              ...(linearElementEditor.selectedPointsIndices || []),
              clickedPointIndex,
            ])
          : [clickedPointIndex]
        : null;
    ret.linearElementEditor = {
      ...linearElementEditor,
      pointerDownState: {
        prevSelectedPointsIndices: linearElementEditor.selectedPointsIndices,
        lastClickedPoint: clickedPointIndex,
        lastClickedIsEndPoint: clickedPointIndex === element.points.length - 1,
        origin: { x: scenePointer.x, y: scenePointer.y },
        segmentMidpoint: {
          value: segmentMidpoint,
          index: segmentMidpointIndex,
          added: false,
        },
      },
      selectedPointsIndices: nextSelectedPointsIndices,
      pointerOffset: targetPoint
        ? {
            x: scenePointer.x - targetPoint[0],
            y: scenePointer.y - targetPoint[1],
          }
        : { x: 0, y: 0 },
    };

    return ret;
  }

  static arePointsEqual<Point extends LocalPoint | GlobalPoint>(
    point1: Point | null,
    point2: Point | null,
  ) {
    if (!point1 && !point2) {
      return true;
    }
    if (!point1 || !point2) {
      return false;
    }
    return pointsEqual(point1, point2);
  }

  static handlePointerMove(
    event: React.PointerEvent<HTMLCanvasElement>,
    scenePointerX: number,
    scenePointerY: number,
    app: AppClassProperties,
  ): LinearElementEditor | null {
    const appState = app.state;
    if (!appState.selectedLinearElement?.isEditing) {
      return null;
    }
    const { elementId, lastUncommittedPoint } = appState.selectedLinearElement;
    const elementsMap = app.scene.getNonDeletedElementsMap();
    const element = LinearElementEditor.getElement(elementId, elementsMap);
    if (!element) {
      return appState.selectedLinearElement;
    }

    const { points } = element;
    const lastPoint = points[points.length - 1];

    if (!event.altKey) {
      if (lastPoint === lastUncommittedPoint) {
        LinearElementEditor.deletePoints(element, app, [points.length - 1]);
      }
      return appState.selectedLinearElement?.lastUncommittedPoint
        ? {
            ...appState.selectedLinearElement,
            lastUncommittedPoint: null,
          }
        : appState.selectedLinearElement;
    }

    let newPoint: LocalPoint;

    if (shouldRotateWithDiscreteAngle(event) && points.length >= 2) {
      const lastCommittedPoint = points[points.length - 2];

      const [width, height] = LinearElementEditor._getShiftLockedDelta(
        element,
        elementsMap,
        lastCommittedPoint,
        pointFrom(scenePointerX, scenePointerY),
        event[KEYS.CTRL_OR_CMD] ? null : app.getEffectiveGridSize(),
      );

      newPoint = pointFrom(
        width + lastCommittedPoint[0],
        height + lastCommittedPoint[1],
      );
    } else {
      newPoint = LinearElementEditor.createPointAt(
        element,
        elementsMap,
        scenePointerX - appState.selectedLinearElement.pointerOffset.x,
        scenePointerY - appState.selectedLinearElement.pointerOffset.y,
        event[KEYS.CTRL_OR_CMD] || isElbowArrow(element)
          ? null
          : app.getEffectiveGridSize(),
      );
    }

    if (lastPoint === lastUncommittedPoint) {
      LinearElementEditor.movePoints(
        element,
        app.scene,
        new Map([
          [
            element.points.length - 1,
            {
              point: newPoint,
            },
          ],
        ]),
      );
    } else {
      LinearElementEditor.addPoints(element, app.scene, [newPoint]);
    }
    return {
      ...appState.selectedLinearElement,
      lastUncommittedPoint: element.points[element.points.length - 1],
    };
  }

  /** scene coords */
  static getPointGlobalCoordinates(
    element: NonDeleted<ExcalidrawLinearElement>,
    p: LocalPoint,
    elementsMap: ElementsMap,
  ): GlobalPoint {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;

    const { x, y } = element;
    return pointRotateRads(
      pointFrom(x + p[0], y + p[1]),
      pointFrom(cx, cy),
      element.angle,
    );
  }

  /** scene coords */
  static getPointsGlobalCoordinates(
    element: NonDeleted<ExcalidrawLinearElement>,
    elementsMap: ElementsMap,
  ): GlobalPoint[] {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    return element.points.map((p) => {
      const { x, y } = element;
      return pointRotateRads(
        pointFrom(x + p[0], y + p[1]),
        pointFrom(cx, cy),
        element.angle,
      );
    });
  }

  static getPointAtIndexGlobalCoordinates(
    element: NonDeleted<ExcalidrawLinearElement>,

    indexMaybeFromEnd: number, // -1 for last element
    elementsMap: ElementsMap,
  ): GlobalPoint {
    const index =
      indexMaybeFromEnd < 0
        ? element.points.length + indexMaybeFromEnd
        : indexMaybeFromEnd;
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const p = element.points[index];
    const { x, y } = element;

    return p
      ? pointRotateRads(
          pointFrom(x + p[0], y + p[1]),
          pointFrom(cx, cy),
          element.angle,
        )
      : pointRotateRads(pointFrom(x, y), pointFrom(cx, cy), element.angle);
  }

  static pointFromAbsoluteCoords(
    element: NonDeleted<ExcalidrawLinearElement>,
    absoluteCoords: GlobalPoint,
    elementsMap: ElementsMap,
  ): LocalPoint {
    if (isElbowArrow(element)) {
      // No rotation for elbow arrows
      return pointFrom(
        absoluteCoords[0] - element.x,
        absoluteCoords[1] - element.y,
      );
    }

    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const [x, y] = pointRotateRads(
      pointFrom(absoluteCoords[0], absoluteCoords[1]),
      pointFrom(cx, cy),
      -element.angle as Radians,
    );
    return pointFrom(x - element.x, y - element.y);
  }

  static getPointIndexUnderCursor(
    element: NonDeleted<ExcalidrawLinearElement>,
    elementsMap: ElementsMap,
    zoom: AppState["zoom"],
    x: number,
    y: number,
  ) {
    const pointHandles = LinearElementEditor.getPointsGlobalCoordinates(
      element,
      elementsMap,
    );
    let idx = pointHandles.length;
    // loop from right to left because points on the right are rendered over
    // points on the left, thus should take precedence when clicking, if they
    // overlap
    while (--idx > -1) {
      const p = pointHandles[idx];
      if (
        pointDistance(pointFrom(x, y), pointFrom(p[0], p[1])) * zoom.value <
        // +1px to account for outline stroke
        LinearElementEditor.POINT_HANDLE_SIZE + 1
      ) {
        return idx;
      }
    }
    return -1;
  }

  static createPointAt(
    element: NonDeleted<ExcalidrawLinearElement>,
    elementsMap: ElementsMap,
    scenePointerX: number,
    scenePointerY: number,
    gridSize: NullableGridSize,
  ): LocalPoint {
    const pointerOnGrid = getGridPoint(scenePointerX, scenePointerY, gridSize);
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const [rotatedX, rotatedY] = pointRotateRads(
      pointFrom(pointerOnGrid[0], pointerOnGrid[1]),
      pointFrom(cx, cy),
      -element.angle as Radians,
    );

    return pointFrom(rotatedX - element.x, rotatedY - element.y);
  }

  /**
   * Normalizes line points so that the start point is at [0,0]. This is
   * expected in various parts of the codebase.
   *
   * Also returns normalized x and y coords to account for the normalization
   * of the points.
   */
  static getNormalizeElementPointsAndCoords(element: ExcalidrawLinearElement) {
    const { points, offsetX, offsetY } = getNormalizedPoints(element);

    return {
      points,
      x: element.x + offsetX,
      y: element.y + offsetY,
    };
  }

  // element-mutating methods
  // ---------------------------------------------------------------------------
  static duplicateSelectedPoints(appState: AppState, scene: Scene): AppState {
    invariant(
      appState.selectedLinearElement?.isEditing,
      "Not currently editing a linear element",
    );

    const elementsMap = scene.getNonDeletedElementsMap();
    const { selectedPointsIndices, elementId } = appState.selectedLinearElement;
    const element = LinearElementEditor.getElement(elementId, elementsMap);

    invariant(
      element,
      "The linear element does not exist in the provided Scene",
    );
    invariant(
      selectedPointsIndices != null,
      "There are no selected points to duplicate",
    );

    const { points } = element;

    const nextSelectedIndices: number[] = [];

    let pointAddedToEnd = false;
    let indexCursor = -1;
    const nextPoints = points.reduce((acc: LocalPoint[], p, index) => {
      ++indexCursor;
      acc.push(p);

      const isSelected = selectedPointsIndices.includes(index);
      if (isSelected) {
        const nextPoint = points[index + 1];

        if (!nextPoint) {
          pointAddedToEnd = true;
        }
        acc.push(
          nextPoint
            ? pointFrom((p[0] + nextPoint[0]) / 2, (p[1] + nextPoint[1]) / 2)
            : pointFrom(p[0], p[1]),
        );

        nextSelectedIndices.push(indexCursor + 1);
        ++indexCursor;
      }

      return acc;
    }, []);

    scene.mutateElement(element, { points: nextPoints });

    // temp hack to ensure the line doesn't move when adding point to the end,
    // potentially expanding the bounding box
    if (pointAddedToEnd) {
      const lastPoint = element.points[element.points.length - 1];
      LinearElementEditor.movePoints(
        element,
        scene,
        new Map([
          [
            element.points.length - 1,
            { point: pointFrom(lastPoint[0] + 30, lastPoint[1] + 30) },
          ],
        ]),
      );
    }

    return {
      ...appState,
      selectedLinearElement: {
        ...appState.selectedLinearElement,
        selectedPointsIndices: nextSelectedIndices,
      },
    };
  }

  static deletePoints(
    element: NonDeleted<ExcalidrawLinearElement>,
    app: AppClassProperties,
    pointIndices: readonly number[],
  ) {
    const isUncommittedPoint =
      app.state.selectedLinearElement?.isEditing &&
      app.state.selectedLinearElement?.lastUncommittedPoint ===
        element.points[element.points.length - 1];

    const nextPoints = element.points.filter((_, idx) => {
      return !pointIndices.includes(idx);
    });

    const isPolygon = isLineElement(element) && element.polygon;

    // keep polygon intact if deleting start/end point or uncommitted point
    if (
      isPolygon &&
      (isUncommittedPoint ||
        pointIndices.includes(0) ||
        pointIndices.includes(element.points.length - 1))
    ) {
      nextPoints[0] = pointFrom(
        nextPoints[nextPoints.length - 1][0],
        nextPoints[nextPoints.length - 1][1],
      );
    }

    const {
      points: normalizedPoints,
      offsetX,
      offsetY,
    } = getNormalizedPoints({ points: nextPoints });

    LinearElementEditor._updatePoints(
      element,
      app.scene,
      normalizedPoints,
      offsetX,
      offsetY,
    );
  }

  static addPoints(
    element: NonDeleted<ExcalidrawLinearElement>,
    scene: Scene,
    addedPoints: LocalPoint[],
  ) {
    const nextPoints = [...element.points, ...addedPoints];

    if (isLineElement(element) && element.polygon) {
      nextPoints[0] = pointFrom(
        nextPoints[nextPoints.length - 1][0],
        nextPoints[nextPoints.length - 1][1],
      );
    }

    const {
      points: normalizedPoints,
      offsetX,
      offsetY,
    } = getNormalizedPoints({ points: nextPoints });

    LinearElementEditor._updatePoints(
      element,
      scene,
      normalizedPoints,
      offsetX,
      offsetY,
    );
  }

  static movePoints(
    element: NonDeleted<ExcalidrawLinearElement>,
    scene: Scene,
    pointUpdates: PointsPositionUpdates,
    otherUpdates?: {
      startBinding?: PointBinding | null;
      endBinding?: PointBinding | null;
    },
  ) {
    const { points } = element;

    // if polygon, move start and end points together
    if (isLineElement(element) && element.polygon) {
      const firstPointUpdate = pointUpdates.get(0);
      const lastPointUpdate = pointUpdates.get(points.length - 1);

      if (firstPointUpdate) {
        pointUpdates.set(points.length - 1, {
          point: pointFrom(
            firstPointUpdate.point[0],
            firstPointUpdate.point[1],
          ),
          isDragging: firstPointUpdate.isDragging,
        });
      } else if (lastPointUpdate) {
        pointUpdates.set(0, {
          point: pointFrom(lastPointUpdate.point[0], lastPointUpdate.point[1]),
          isDragging: lastPointUpdate.isDragging,
        });
      }
    }

    // in case we're moving start point, instead of modifying its position
    // which would break the invariant of it being at [0,0], we move
    // all the other points in the opposite direction by delta to
    // offset it. We do the same with actual element.x/y position, so
    // this hacks are completely transparent to the user.

    const updatedOriginPoint =
      pointUpdates.get(0)?.point ?? pointFrom<LocalPoint>(0, 0);

    const [offsetX, offsetY] = updatedOriginPoint;

    const nextPoints = isElbowArrow(element)
      ? [
          pointUpdates.get(0)?.point ?? points[0],
          pointUpdates.get(points.length - 1)?.point ??
            points[points.length - 1],
        ]
      : points.map((p, idx) => {
          const current = pointUpdates.get(idx)?.point ?? p;

          return pointFrom<LocalPoint>(
            current[0] - offsetX,
            current[1] - offsetY,
          );
        });

    LinearElementEditor._updatePoints(
      element,
      scene,
      nextPoints,
      offsetX,
      offsetY,
      otherUpdates,
      {
        isDragging: Array.from(pointUpdates.values()).some((t) => t.isDragging),
      },
    );
  }

  static shouldAddMidpoint(
    linearElementEditor: LinearElementEditor,
    pointerCoords: PointerCoords,
    appState: AppState,
    elementsMap: ElementsMap,
  ) {
    const element = LinearElementEditor.getElement(
      linearElementEditor.elementId,
      elementsMap,
    );

    // Elbow arrows don't allow midpoints
    if (element && isElbowArrow(element)) {
      return false;
    }

    if (!element) {
      return false;
    }

    const { segmentMidpoint } = linearElementEditor.pointerDownState;

    if (
      segmentMidpoint.added ||
      segmentMidpoint.value === null ||
      segmentMidpoint.index === null ||
      linearElementEditor.pointerDownState.origin === null
    ) {
      return false;
    }

    const origin = linearElementEditor.pointerDownState.origin!;
    const dist = pointDistance(
      pointFrom(origin.x, origin.y),
      pointFrom(pointerCoords.x, pointerCoords.y),
    );
    if (
      !appState.selectedLinearElement?.isEditing &&
      dist < DRAGGING_THRESHOLD / appState.zoom.value
    ) {
      return false;
    }
    return true;
  }

  static addMidpoint(
    linearElementEditor: LinearElementEditor,
    pointerCoords: PointerCoords,
    app: AppClassProperties,
    snapToGrid: boolean,
    scene: Scene,
  ) {
    const elementsMap = scene.getNonDeletedElementsMap();
    const element = LinearElementEditor.getElement(
      linearElementEditor.elementId,
      elementsMap,
    );
    if (!element) {
      return;
    }
    const { segmentMidpoint } = linearElementEditor.pointerDownState;
    const ret: {
      pointerDownState: LinearElementEditor["pointerDownState"];
      selectedPointsIndices: LinearElementEditor["selectedPointsIndices"];
    } = {
      pointerDownState: linearElementEditor.pointerDownState,
      selectedPointsIndices: linearElementEditor.selectedPointsIndices,
    };

    const midpoint = LinearElementEditor.createPointAt(
      element,
      elementsMap,
      pointerCoords.x,
      pointerCoords.y,
      snapToGrid && !isElbowArrow(element) ? app.getEffectiveGridSize() : null,
    );
    const points = [
      ...element.points.slice(0, segmentMidpoint.index!),
      midpoint,
      ...element.points.slice(segmentMidpoint.index!),
    ];

    scene.mutateElement(element, { points });

    ret.pointerDownState = {
      ...linearElementEditor.pointerDownState,
      segmentMidpoint: {
        ...linearElementEditor.pointerDownState.segmentMidpoint,
        added: true,
      },
      lastClickedPoint: segmentMidpoint.index!,
    };
    ret.selectedPointsIndices = [segmentMidpoint.index!];
    return ret;
  }

  private static _updatePoints(
    element: NonDeleted<ExcalidrawLinearElement>,
    scene: Scene,
    nextPoints: readonly LocalPoint[],
    offsetX: number,
    offsetY: number,
    otherUpdates?: {
      startBinding?: PointBinding | null;
      endBinding?: PointBinding | null;
    },
    options?: {
      isDragging?: boolean;
      zoom?: AppState["zoom"];
      sceneElementsMap?: NonDeletedSceneElementsMap;
    },
  ) {
    if (isElbowArrow(element)) {
      const updates: {
        startBinding?: FixedPointBinding | null;
        endBinding?: FixedPointBinding | null;
        points?: LocalPoint[];
      } = {};
      if (otherUpdates?.startBinding !== undefined) {
        updates.startBinding =
          otherUpdates.startBinding !== null &&
          isFixedPointBinding(otherUpdates.startBinding)
            ? otherUpdates.startBinding
            : null;
      }
      if (otherUpdates?.endBinding !== undefined) {
        updates.endBinding =
          otherUpdates.endBinding !== null &&
          isFixedPointBinding(otherUpdates.endBinding)
            ? otherUpdates.endBinding
            : null;
      }

      updates.points = Array.from(nextPoints);

      scene.mutateElement(element, updates, {
        informMutation: true,
        isDragging: options?.isDragging ?? false,
      });
    } else {
      // TODO do we need to get precise coords here just to calc centers?
      const nextCoords = getElementPointsCoords(element, nextPoints);
      const prevCoords = getElementPointsCoords(element, element.points);
      const nextCenterX = (nextCoords[0] + nextCoords[2]) / 2;
      const nextCenterY = (nextCoords[1] + nextCoords[3]) / 2;
      const prevCenterX = (prevCoords[0] + prevCoords[2]) / 2;
      const prevCenterY = (prevCoords[1] + prevCoords[3]) / 2;
      const dX = prevCenterX - nextCenterX;
      const dY = prevCenterY - nextCenterY;
      const rotatedOffset = pointRotateRads(
        pointFrom(offsetX, offsetY),
        pointFrom(dX, dY),
        element.angle,
      );
      scene.mutateElement(element, {
        ...otherUpdates,
        points: nextPoints,
        x: element.x + rotatedOffset[0],
        y: element.y + rotatedOffset[1],
      });
    }
  }

  private static _getShiftLockedDelta(
    element: NonDeleted<ExcalidrawLinearElement>,
    elementsMap: ElementsMap,
    referencePoint: LocalPoint,
    scenePointer: GlobalPoint,
    gridSize: NullableGridSize,
    customLineAngle?: number,
  ) {
    const referencePointCoords = LinearElementEditor.getPointGlobalCoordinates(
      element,
      referencePoint,
      elementsMap,
    );

    if (isElbowArrow(element)) {
      return [
        scenePointer[0] - referencePointCoords[0],
        scenePointer[1] - referencePointCoords[1],
      ];
    }

    const [gridX, gridY] = getGridPoint(
      scenePointer[0],
      scenePointer[1],
      gridSize,
    );

    const { width, height } = getLockedLinearCursorAlignSize(
      referencePointCoords[0],
      referencePointCoords[1],
      gridX,
      gridY,
      customLineAngle,
    );

    return pointRotateRads(
      pointFrom(width, height),
      pointFrom(0, 0),
      -element.angle as Radians,
    );
  }

  static getBoundTextElementPosition = (
    element: ExcalidrawLinearElement,
    boundTextElement: ExcalidrawTextElementWithContainer,
    elementsMap: ElementsMap,
  ): { x: number; y: number } => {
    const points = LinearElementEditor.getPointsGlobalCoordinates(
      element,
      elementsMap,
    );
    if (points.length < 2) {
      mutateElement(boundTextElement, elementsMap, { isDeleted: true });
    }
    let x = 0;
    let y = 0;
    if (element.points.length % 2 === 1) {
      const index = Math.floor(element.points.length / 2);
      const midPoint = LinearElementEditor.getPointGlobalCoordinates(
        element,
        element.points[index],
        elementsMap,
      );
      x = midPoint[0] - boundTextElement.width / 2;
      y = midPoint[1] - boundTextElement.height / 2;
    } else {
      const index = element.points.length / 2 - 1;
      const midSegmentMidpoint = LinearElementEditor.getSegmentMidPoint(
        element,
        index + 1,
      );

      x = midSegmentMidpoint[0] - boundTextElement.width / 2;
      y = midSegmentMidpoint[1] - boundTextElement.height / 2;
    }
    return { x, y };
  };

  static getMinMaxXYWithBoundText = (
    element: ExcalidrawLinearElement,
    elementsMap: ElementsMap,
    elementBounds: Bounds,
    boundTextElement: ExcalidrawTextElementWithContainer,
  ): [number, number, number, number, number, number] => {
    let [x1, y1, x2, y2] = elementBounds;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const { x: boundTextX1, y: boundTextY1 } =
      LinearElementEditor.getBoundTextElementPosition(
        element,
        boundTextElement,
        elementsMap,
      );
    const boundTextX2 = boundTextX1 + boundTextElement.width;
    const boundTextY2 = boundTextY1 + boundTextElement.height;
    const centerPoint = pointFrom(cx, cy);

    const topLeftRotatedPoint = pointRotateRads(
      pointFrom(x1, y1),
      centerPoint,
      element.angle,
    );
    const topRightRotatedPoint = pointRotateRads(
      pointFrom(x2, y1),
      centerPoint,
      element.angle,
    );

    const counterRotateBoundTextTopLeft = pointRotateRads(
      pointFrom(boundTextX1, boundTextY1),
      centerPoint,
      -element.angle as Radians,
    );
    const counterRotateBoundTextTopRight = pointRotateRads(
      pointFrom(boundTextX2, boundTextY1),
      centerPoint,
      -element.angle as Radians,
    );
    const counterRotateBoundTextBottomLeft = pointRotateRads(
      pointFrom(boundTextX1, boundTextY2),
      centerPoint,
      -element.angle as Radians,
    );
    const counterRotateBoundTextBottomRight = pointRotateRads(
      pointFrom(boundTextX2, boundTextY2),
      centerPoint,
      -element.angle as Radians,
    );

    if (
      topLeftRotatedPoint[0] < topRightRotatedPoint[0] &&
      topLeftRotatedPoint[1] >= topRightRotatedPoint[1]
    ) {
      x1 = Math.min(x1, counterRotateBoundTextBottomLeft[0]);
      x2 = Math.max(
        x2,
        Math.max(
          counterRotateBoundTextTopRight[0],
          counterRotateBoundTextBottomRight[0],
        ),
      );
      y1 = Math.min(y1, counterRotateBoundTextTopLeft[1]);

      y2 = Math.max(y2, counterRotateBoundTextBottomRight[1]);
    } else if (
      topLeftRotatedPoint[0] >= topRightRotatedPoint[0] &&
      topLeftRotatedPoint[1] > topRightRotatedPoint[1]
    ) {
      x1 = Math.min(x1, counterRotateBoundTextBottomRight[0]);
      x2 = Math.max(
        x2,
        Math.max(
          counterRotateBoundTextTopLeft[0],
          counterRotateBoundTextTopRight[0],
        ),
      );
      y1 = Math.min(y1, counterRotateBoundTextBottomLeft[1]);

      y2 = Math.max(y2, counterRotateBoundTextTopRight[1]);
    } else if (topLeftRotatedPoint[0] >= topRightRotatedPoint[0]) {
      x1 = Math.min(x1, counterRotateBoundTextTopRight[0]);
      x2 = Math.max(x2, counterRotateBoundTextBottomLeft[0]);
      y1 = Math.min(y1, counterRotateBoundTextBottomRight[1]);

      y2 = Math.max(y2, counterRotateBoundTextTopLeft[1]);
    } else if (topLeftRotatedPoint[1] <= topRightRotatedPoint[1]) {
      x1 = Math.min(
        x1,
        Math.min(
          counterRotateBoundTextTopRight[0],
          counterRotateBoundTextTopLeft[0],
        ),
      );

      x2 = Math.max(x2, counterRotateBoundTextBottomRight[0]);
      y1 = Math.min(y1, counterRotateBoundTextTopRight[1]);
      y2 = Math.max(y2, counterRotateBoundTextBottomLeft[1]);
    }

    return [x1, y1, x2, y2, cx, cy];
  };

  static getElementAbsoluteCoords = (
    element: ExcalidrawLinearElement,
    elementsMap: ElementsMap,
    includeBoundText: boolean = false,
  ): [number, number, number, number, number, number] => {
    let coords: [number, number, number, number, number, number];
    let x1;
    let y1;
    let x2;
    let y2;
    if (element.points.length < 2 || !ShapeCache.get(element)) {
      // XXX this is just a poor estimate and not very useful
      const { minX, minY, maxX, maxY } = element.points.reduce(
        (limits, [x, y]) => {
          limits.minY = Math.min(limits.minY, y);
          limits.minX = Math.min(limits.minX, x);

          limits.maxX = Math.max(limits.maxX, x);
          limits.maxY = Math.max(limits.maxY, y);

          return limits;
        },
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
      );
      x1 = minX + element.x;
      y1 = minY + element.y;
      x2 = maxX + element.x;
      y2 = maxY + element.y;
    } else {
      const shape = ShapeCache.generateElementShape(element, null);

      // first element is always the curve
      const ops = getCurvePathOps(shape[0]);

      const [minX, minY, maxX, maxY] = getMinMaxXYFromCurvePathOps(ops);
      x1 = minX + element.x;
      y1 = minY + element.y;
      x2 = maxX + element.x;
      y2 = maxY + element.y;
    }
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    coords = [x1, y1, x2, y2, cx, cy];

    if (!includeBoundText) {
      return coords;
    }
    const boundTextElement = getBoundTextElement(element, elementsMap);
    if (boundTextElement) {
      coords = LinearElementEditor.getMinMaxXYWithBoundText(
        element,
        elementsMap,
        [x1, y1, x2, y2],
        boundTextElement,
      );
    }

    return coords;
  };

  static moveFixedSegment(
    linearElement: LinearElementEditor,
    index: number,
    x: number,
    y: number,
    scene: Scene,
  ): LinearElementEditor {
    const elementsMap = scene.getNonDeletedElementsMap();
    const element = LinearElementEditor.getElement(
      linearElement.elementId,
      elementsMap,
    );

    if (!element || !isElbowArrow(element)) {
      return linearElement;
    }

    if (index && index > 0 && index < element.points.length) {
      const isHorizontal = headingIsHorizontal(
        vectorToHeading(
          vectorFromPoint(element.points[index], element.points[index - 1]),
        ),
      );

      const fixedSegments = (element.fixedSegments ?? []).reduce(
        (segments, s) => {
          segments[s.index] = s;
          return segments;
        },
        {} as Record<number, FixedSegment>,
      );
      fixedSegments[index] = {
        index,
        start: pointFrom<LocalPoint>(
          !isHorizontal ? x - element.x : element.points[index - 1][0],
          isHorizontal ? y - element.y : element.points[index - 1][1],
        ),
        end: pointFrom<LocalPoint>(
          !isHorizontal ? x - element.x : element.points[index][0],
          isHorizontal ? y - element.y : element.points[index][1],
        ),
      };
      const nextFixedSegments = Object.values(fixedSegments).sort(
        (a, b) => a.index - b.index,
      );

      const offset = nextFixedSegments
        .map((segment) => segment.index)
        .reduce((count, idx) => (idx < index ? count + 1 : count), 0);

      scene.mutateElement(element, {
        fixedSegments: nextFixedSegments,
      });

      const point = pointFrom<GlobalPoint>(
        element.x +
          (element.fixedSegments![offset].start[0] +
            element.fixedSegments![offset].end[0]) /
            2,
        element.y +
          (element.fixedSegments![offset].start[1] +
            element.fixedSegments![offset].end[1]) /
            2,
      );

      return {
        ...linearElement,
        segmentMidPointHoveredCoords: point,
        pointerDownState: {
          ...linearElement.pointerDownState,
          segmentMidpoint: {
            added: false,
            index: element.fixedSegments![offset].index,
            value: point,
          },
        },
      };
    }

    return linearElement;
  }

  static deleteFixedSegment(
    element: ExcalidrawElbowArrowElement,
    scene: Scene,
    index: number,
  ): void {
    scene.mutateElement(element, {
      fixedSegments: element.fixedSegments?.filter(
        (segment) => segment.index !== index,
      ),
    });
  }
}

const normalizeSelectedPoints = (
  points: (number | null)[],
): number[] | null => {
  let nextPoints = [
    ...new Set(points.filter((p) => p !== null && p !== -1)),
  ] as number[];
  nextPoints = nextPoints.sort((a, b) => a - b);
  return nextPoints.length ? nextPoints : null;
};
