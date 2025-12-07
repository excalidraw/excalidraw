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
  lineSegment,
} from "@excalidraw/math";

import { getCurvePathOps } from "@excalidraw/utils/shape";

import {
  DRAGGING_THRESHOLD,
  KEYS,
  shouldRotateWithDiscreteAngle,
  getGridPoint,
  invariant,
  isShallowEqual,
  getFeatureFlag,
} from "@excalidraw/common";

import {
  deconstructLinearOrFreeDrawElement,
  isPathALoop,
  moveArrowAboveBindable,
  projectFixedPointOntoDiagonal,
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

import {
  calculateFixedPointForNonElbowArrowBinding,
  getBindingStrategyForDraggingBindingElementEndpoints,
  isBindingEnabled,
  updateBoundPoint,
} from "./binding";
import {
  getElementAbsoluteCoords,
  getElementPointsCoords,
  getMinMaxXYFromCurvePathOps,
} from "./bounds";

import { headingIsHorizontal, vectorToHeading } from "./heading";
import { mutateElement } from "./mutateElement";
import { getBoundTextElement, handleBindTextResize } from "./textElement";
import { isArrowElement, isBindingElement, isElbowArrow } from "./typeChecks";

import { ShapeCache, toggleLinePolygonState } from "./shape";

import { getLockedLinearCursorAlignSize } from "./sizeHelpers";

import { isLineElement } from "./typeChecks";

import type { Scene } from "./Scene";

import type { Bounds } from "./bounds";
import type {
  NonDeleted,
  ExcalidrawLinearElement,
  ExcalidrawElement,
  ExcalidrawTextElementWithContainer,
  ElementsMap,
  NonDeletedSceneElementsMap,
  FixedPointBinding,
  FixedSegment,
  ExcalidrawElbowArrowElement,
  PointsPositionUpdates,
  NonDeletedExcalidrawElement,
  Ordered,
  ExcalidrawBindableElement,
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

type PointMoveOtherUpdates = {
  startBinding?: FixedPointBinding | null;
  endBinding?: FixedPointBinding | null;
  moveMidPointsWithElement?: boolean | null;
  suggestedBinding?: AppState["suggestedBinding"] | null;
};

export class LinearElementEditor {
  public readonly elementId: ExcalidrawElement["id"] & {
    _brand: "excalidrawLinearElementId";
  };
  /** indices */
  public readonly selectedPointsIndices: readonly number[] | null;

  public readonly initialState: Readonly<{
    prevSelectedPointsIndices: readonly number[] | null;
    /** index */
    lastClickedPoint: number;
    origin: Readonly<GlobalPoint> | null;
    segmentMidpoint: {
      value: GlobalPoint | null;
      index: number | null;
      added: boolean;
    };
    arrowStartIsInside: boolean;
    altFocusPoint: Readonly<GlobalPoint> | null;
  }>;

  /** whether you're dragging a point */
  public readonly isDragging: boolean;
  public readonly lastUncommittedPoint: LocalPoint | null;
  public readonly lastCommittedPoint: LocalPoint | null;
  public readonly pointerOffset: Readonly<{ x: number; y: number }>;
  public readonly hoverPointIndex: number;
  public readonly segmentMidPointHoveredCoords: GlobalPoint | null;
  public readonly elbowed: boolean;
  public readonly customLineAngle: number | null;
  public readonly isEditing: boolean;

  // @deprecated renamed to initialState because the data is used during linear
  // element click creation as well (with multiple pointer down events)
  // @ts-ignore
  public readonly pointerDownState: never;

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
    this.lastCommittedPoint = null;
    this.isDragging = false;
    this.pointerOffset = { x: 0, y: 0 };
    this.initialState = {
      prevSelectedPointsIndices: null,
      lastClickedPoint: -1,
      origin: null,

      segmentMidpoint: {
        value: null,
        index: null,
        added: false,
      },
      arrowStartIsInside: false,
      altFocusPoint: null,
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

  static handlePointerMove(
    event: PointerEvent,
    app: AppClassProperties,
    scenePointerX: number,
    scenePointerY: number,
    linearElementEditor: LinearElementEditor,
  ): Pick<AppState, "suggestedBinding" | "selectedLinearElement"> | null {
    const elementsMap = app.scene.getNonDeletedElementsMap();
    const elements = app.scene.getNonDeletedElements();
    const { elementId } = linearElementEditor;

    const element = LinearElementEditor.getElement(elementId, elementsMap);

    invariant(element, "Element being dragged must exist in the scene");
    invariant(element.points.length > 1, "Element must have at least 2 points");

    const idx = element.points.length - 1;
    const point = element.points[idx];
    const pivotPoint = element.points[idx - 1];
    const customLineAngle =
      linearElementEditor.customLineAngle ??
      determineCustomLinearAngle(pivotPoint, element.points[idx]);

    // Determine if point movement should happen and how much
    let deltaX = 0;
    let deltaY = 0;
    if (shouldRotateWithDiscreteAngle(event)) {
      const [width, height] = LinearElementEditor._getShiftLockedDelta(
        element,
        elementsMap,
        pivotPoint,
        pointFrom(scenePointerX, scenePointerY),
        event[KEYS.CTRL_OR_CMD] ? null : app.getEffectiveGridSize(),
        customLineAngle,
      );
      const target = pointFrom<LocalPoint>(
        width + pivotPoint[0],
        height + pivotPoint[1],
      );

      deltaX = target[0] - point[0];
      deltaY = target[1] - point[1];
    } else {
      const newDraggingPointPosition = LinearElementEditor.createPointAt(
        element,
        elementsMap,
        scenePointerX - linearElementEditor.pointerOffset.x,
        scenePointerY - linearElementEditor.pointerOffset.y,
        event[KEYS.CTRL_OR_CMD] ? null : app.getEffectiveGridSize(),
      );
      deltaX = newDraggingPointPosition[0] - point[0];
      deltaY = newDraggingPointPosition[1] - point[1];
    }

    // Apply the point movement if needed
    let suggestedBinding: AppState["suggestedBinding"] = null;
    const { positions, updates } = pointDraggingUpdates(
      [idx],
      deltaX,
      deltaY,
      elementsMap,
      element,
      elements,
      app,
      shouldRotateWithDiscreteAngle(event),
      event.altKey,
    );

    LinearElementEditor.movePoints(element, app.scene, positions, {
      startBinding: updates?.startBinding,
      endBinding: updates?.endBinding,
      moveMidPointsWithElement: updates?.moveMidPointsWithElement,
    });
    // Set the suggested binding from the updates if available
    if (isBindingElement(element, false)) {
      if (isBindingEnabled(app.state)) {
        suggestedBinding = updates?.suggestedBinding ?? null;
      }
    }

    // Move the arrow over the bindable object in terms of z-index
    if (isBindingElement(element)) {
      moveArrowAboveBindable(
        LinearElementEditor.getPointGlobalCoordinates(
          element,
          element.points[element.points.length - 1],
          elementsMap,
        ),
        element,
        elements,
        elementsMap,
        app.scene,
      );
    }

    // PERF: Avoid state updates if not absolutely necessary
    if (
      app.state.selectedLinearElement?.customLineAngle === customLineAngle &&
      linearElementEditor.initialState.altFocusPoint &&
      (!suggestedBinding ||
        isShallowEqual(app.state.suggestedBinding ?? [], suggestedBinding))
    ) {
      return null;
    }

    const startBindingElement =
      isBindingElement(element) &&
      element.startBinding &&
      (elementsMap.get(
        element.startBinding.elementId,
      ) as ExcalidrawBindableElement | null);
    const newLinearElementEditor = {
      ...linearElementEditor,
      customLineAngle,
      initialState: {
        ...linearElementEditor.initialState,
        altFocusPoint:
          !linearElementEditor.initialState.altFocusPoint &&
          startBindingElement &&
          updates?.suggestedBinding?.id !== startBindingElement.id
            ? projectFixedPointOntoDiagonal(
                element,
                pointFrom<GlobalPoint>(element.x, element.y),
                startBindingElement,
                "start",
                elementsMap,
              )
            : linearElementEditor.initialState.altFocusPoint,
      },
    };

    return {
      selectedLinearElement: newLinearElementEditor,
      suggestedBinding,
    };
  }

  static handlePointDragging(
    event: PointerEvent,
    app: AppClassProperties,
    scenePointerX: number,
    scenePointerY: number,
    linearElementEditor: LinearElementEditor,
  ): Pick<AppState, "suggestedBinding" | "selectedLinearElement"> | null {
    const elementsMap = app.scene.getNonDeletedElementsMap();
    const elements = app.scene.getNonDeletedElements();
    const { elbowed, elementId, initialState } = linearElementEditor;
    const selectedPointsIndices = Array.from(
      linearElementEditor.selectedPointsIndices ?? [],
    );
    let { lastClickedPoint } = initialState;
    const element = LinearElementEditor.getElement(elementId, elementsMap);

    invariant(element, "Element being dragged must exist in the scene");

    invariant(element.points.length > 1, "Element must have at least 2 points");

    invariant(
      selectedPointsIndices,
      "There must be selected points in order to drag them",
    );

    if (elbowed) {
      selectedPointsIndices.some((pointIdx, idx) => {
        if (pointIdx > 0 && pointIdx !== element.points.length - 1) {
          selectedPointsIndices[idx] = element.points.length - 1;
          lastClickedPoint = element.points.length - 1;
          return true;
        }

        return false;
      });
    }

    invariant(
      lastClickedPoint > -1 &&
        selectedPointsIndices.includes(lastClickedPoint) &&
        element.points[lastClickedPoint],
      `There must be a valid lastClickedPoint in order to drag it. selectedPointsIndices(${JSON.stringify(
        selectedPointsIndices,
      )}) points(0..${
        element.points.length - 1
      }) lastClickedPoint(${lastClickedPoint})`,
    );

    // point that's being dragged (out of all selected points)
    const draggingPoint = element.points[lastClickedPoint];
    // The adjacent point to the one dragged point
    const pivotPoint =
      element.points[lastClickedPoint === 0 ? 1 : lastClickedPoint - 1];
    const singlePointDragged = selectedPointsIndices.length === 1;
    const customLineAngle =
      linearElementEditor.customLineAngle ??
      determineCustomLinearAngle(pivotPoint, element.points[lastClickedPoint]);
    const startIsSelected = selectedPointsIndices.includes(0);
    const endIsSelected = selectedPointsIndices.includes(
      element.points.length - 1,
    );

    // Determine if point movement should happen and how much
    let deltaX = 0;
    let deltaY = 0;
    if (shouldRotateWithDiscreteAngle(event) && singlePointDragged) {
      const [width, height] = LinearElementEditor._getShiftLockedDelta(
        element,
        elementsMap,
        pivotPoint,
        pointFrom(scenePointerX, scenePointerY),
        event[KEYS.CTRL_OR_CMD] ? null : app.getEffectiveGridSize(),
        customLineAngle,
      );
      const target = pointFrom<LocalPoint>(
        width + pivotPoint[0],
        height + pivotPoint[1],
      );

      deltaX = target[0] - draggingPoint[0];
      deltaY = target[1] - draggingPoint[1];
    } else {
      const newDraggingPointPosition = LinearElementEditor.createPointAt(
        element,
        elementsMap,
        scenePointerX - linearElementEditor.pointerOffset.x,
        scenePointerY - linearElementEditor.pointerOffset.y,
        event[KEYS.CTRL_OR_CMD] ? null : app.getEffectiveGridSize(),
      );
      deltaX = newDraggingPointPosition[0] - draggingPoint[0];
      deltaY = newDraggingPointPosition[1] - draggingPoint[1];
    }

    // Apply the point movement if needed
    let suggestedBinding: AppState["suggestedBinding"] = null;
    const { positions, updates } = pointDraggingUpdates(
      selectedPointsIndices,
      deltaX,
      deltaY,
      elementsMap,
      element,
      elements,
      app,
      shouldRotateWithDiscreteAngle(event) && singlePointDragged,
      event.altKey,
    );

    LinearElementEditor.movePoints(element, app.scene, positions, {
      startBinding: updates?.startBinding,
      endBinding: updates?.endBinding,
      moveMidPointsWithElement: updates?.moveMidPointsWithElement,
    });

    // Set the suggested binding from the updates if available
    if (isBindingElement(element, false)) {
      if (isBindingEnabled(app.state) && (startIsSelected || endIsSelected)) {
        suggestedBinding = updates?.suggestedBinding ?? null;
      }
    }

    // Move the arrow over the bindable object in terms of z-index
    if (isBindingElement(element) && startIsSelected !== endIsSelected) {
      moveArrowAboveBindable(
        LinearElementEditor.getPointGlobalCoordinates(
          element,
          startIsSelected
            ? element.points[0]
            : element.points[element.points.length - 1],
          elementsMap,
        ),
        element,
        elements,
        elementsMap,
        app.scene,
      );
    }

    // Attached text might need to update if arrow dimensions change
    const boundTextElement = getBoundTextElement(element, elementsMap);
    if (boundTextElement) {
      handleBindTextResize(element, app.scene, false);
    }

    // Update selected points for elbow arrows because elbow arrows add and
    // remove points as they route
    const newSelectedPointsIndices = elbowed
      ? endIsSelected
        ? [element.points.length - 1]
        : [0]
      : selectedPointsIndices;

    const newLastClickedPoint = elbowed
      ? newSelectedPointsIndices[0]
      : lastClickedPoint;

    const newSelectedMidPointHoveredCoords =
      !startIsSelected && !endIsSelected
        ? LinearElementEditor.getPointGlobalCoordinates(
            element,
            draggingPoint,
            elementsMap,
          )
        : null;

    const newHoverPointIndex = newLastClickedPoint;
    const startBindingElement =
      isBindingElement(element) &&
      element.startBinding &&
      (elementsMap.get(
        element.startBinding.elementId,
      ) as ExcalidrawBindableElement | null);
    const endBindingElement =
      isBindingElement(element) &&
      element.endBinding &&
      (elementsMap.get(
        element.endBinding.elementId,
      ) as ExcalidrawBindableElement | null);
    const altFocusPointBindableElement =
      endIsSelected && // The "other" end (i.e. "end") is dragged
      startBindingElement &&
      updates?.suggestedBinding?.id !== startBindingElement.id // The end point is not hovering the start bindable + it's binding gap
        ? startBindingElement
        : startIsSelected && // The "other" end (i.e. "start") is dragged
          endBindingElement &&
          updates?.suggestedBinding?.id !== endBindingElement.id // The start point is not hovering the end bindable + it's binding gap
        ? endBindingElement
        : null;

    const newLinearElementEditor: LinearElementEditor = {
      ...linearElementEditor,
      selectedPointsIndices: newSelectedPointsIndices,
      initialState: {
        ...linearElementEditor.initialState,
        lastClickedPoint: newLastClickedPoint,
        altFocusPoint:
          !linearElementEditor.initialState.altFocusPoint && // We only set it once per arrow drag
          isBindingElement(element) &&
          altFocusPointBindableElement
            ? projectFixedPointOntoDiagonal(
                element,
                pointFrom<GlobalPoint>(element.x, element.y),
                altFocusPointBindableElement,
                "start",
                elementsMap,
              )
            : linearElementEditor.initialState.altFocusPoint,
      },
      segmentMidPointHoveredCoords: newSelectedMidPointHoveredCoords,
      hoverPointIndex: newHoverPointIndex,
      isDragging: true,
      customLineAngle,
    };

    return {
      selectedLinearElement: newLinearElementEditor,
      suggestedBinding,
    };
  }

  static handlePointerUp(
    event: PointerEvent,
    editingLinearElement: LinearElementEditor,
    appState: AppState,
    scene: Scene,
  ): LinearElementEditor {
    const elementsMap = scene.getNonDeletedElementsMap();

    const {
      elementId,
      selectedPointsIndices,
      isDragging,
      initialState: pointerDownState,
    } = editingLinearElement;
    const element = LinearElementEditor.getElement(elementId, elementsMap);
    if (!element) {
      return editingLinearElement;
    }

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
        }
      }
    }

    return {
      ...editingLinearElement,
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
      initialState: {
        ...editingLinearElement.initialState,
        origin: null,
        arrowStartIsInside: false,
      },
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
    const point = pointFrom<GlobalPoint>(scenePointer.x, scenePointer.y);
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
        initialState: {
          prevSelectedPointsIndices: linearElementEditor.selectedPointsIndices,
          lastClickedPoint: -1,
          origin: point,
          segmentMidpoint: {
            value: segmentMidpoint,
            index: segmentMidpointIndex,
            added: false,
          },
          arrowStartIsInside:
            !!app.state.newElement &&
            (app.state.bindMode === "inside" || app.state.bindMode === "skip"),
          altFocusPoint: null,
        },
        selectedPointsIndices: [element.points.length - 1],
        lastUncommittedPoint: null,
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
      initialState: {
        prevSelectedPointsIndices: linearElementEditor.selectedPointsIndices,
        lastClickedPoint: clickedPointIndex,
        origin: point,
        segmentMidpoint: {
          value: segmentMidpoint,
          index: segmentMidpointIndex,
          added: false,
        },
        arrowStartIsInside:
          !!app.state.newElement &&
          (app.state.bindMode === "inside" || app.state.bindMode === "skip"),
        altFocusPoint: null,
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

  static handlePointerMoveInEditMode(
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
      const anchor = points[points.length - 2];
      const [width, height] = LinearElementEditor._getShiftLockedDelta(
        element,
        elementsMap,
        anchor,
        pointFrom(scenePointerX, scenePointerY),
        event[KEYS.CTRL_OR_CMD] ? null : app.getEffectiveGridSize(),
      );

      newPoint = pointFrom(width + anchor[0], height + anchor[1]);
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
    const [, , , , cx, cy] = getElementAbsoluteCoords(element, elementsMap);
    const center = pointFrom<GlobalPoint>(cx, cy);
    const p = element.points[index];
    const { x, y } = element;

    return p
      ? pointRotateRads(
          pointFrom<GlobalPoint>(x + p[0], y + p[1]),
          center,
          element.angle,
        )
      : pointRotateRads(pointFrom<GlobalPoint>(x, y), center, element.angle);
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
      startBinding?: FixedPointBinding | null;
      endBinding?: FixedPointBinding | null;
      moveMidPointsWithElement?: boolean | null;
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

          if (
            otherUpdates?.moveMidPointsWithElement &&
            idx !== 0 &&
            idx !== points.length - 1 &&
            !pointUpdates.has(idx)
          ) {
            return current;
          }

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

    const { segmentMidpoint } = linearElementEditor.initialState;

    if (
      segmentMidpoint.added ||
      segmentMidpoint.value === null ||
      segmentMidpoint.index === null ||
      linearElementEditor.initialState.origin === null
    ) {
      return false;
    }

    const origin = linearElementEditor.initialState.origin!;
    const dist = pointDistance(
      origin,
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
    const { segmentMidpoint } = linearElementEditor.initialState;
    const ret: {
      pointerDownState: LinearElementEditor["initialState"];
      selectedPointsIndices: LinearElementEditor["selectedPointsIndices"];
    } = {
      pointerDownState: linearElementEditor.initialState,
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
      ...linearElementEditor.initialState,
      segmentMidpoint: {
        ...linearElementEditor.initialState.segmentMidpoint,
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
      startBinding?: FixedPointBinding | null;
      endBinding?: FixedPointBinding | null;
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
        updates.startBinding = otherUpdates.startBinding;
      }
      if (otherUpdates?.endBinding !== undefined) {
        updates.endBinding = otherUpdates.endBinding;
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
    const shape = ShapeCache.generateElementShape(element, null);

    // first element is always the curve
    const ops = getCurvePathOps(shape[0]);

    const [minX, minY, maxX, maxY] = getMinMaxXYFromCurvePathOps(ops);
    const x1 = minX + element.x;
    const y1 = minY + element.y;
    const x2 = maxX + element.x;
    const y2 = maxY + element.y;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;

    const boundTextElement =
      includeBoundText && getBoundTextElement(element, elementsMap);
    if (boundTextElement) {
      return LinearElementEditor.getMinMaxXYWithBoundText(
        element,
        elementsMap,
        [x1, y1, x2, y2],
        boundTextElement,
      );
    }

    return [x1, y1, x2, y2, cx, cy];
  };

  static moveFixedSegment(
    linearElement: LinearElementEditor,
    index: number,
    x: number,
    y: number,
    scene: Scene,
  ): Pick<
    LinearElementEditor,
    "segmentMidPointHoveredCoords" | "initialState"
  > {
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
        initialState: {
          ...linearElement.initialState,
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

const pointDraggingUpdates = (
  selectedPointsIndices: readonly number[],
  deltaX: number,
  deltaY: number,
  elementsMap: NonDeletedSceneElementsMap,
  element: NonDeleted<ExcalidrawLinearElement>,
  elements: readonly Ordered<NonDeletedExcalidrawElement>[],
  app: AppClassProperties,
  angleLocked: boolean,
  altKey: boolean,
): {
  positions: PointsPositionUpdates;
  updates?: PointMoveOtherUpdates;
} => {
  const naiveDraggingPoints = new Map(
    selectedPointsIndices.map((pointIndex) => {
      return [
        pointIndex,
        {
          point: pointFrom<LocalPoint>(
            element.points[pointIndex][0] + deltaX,
            element.points[pointIndex][1] + deltaY,
          ),
          isDragging: true,
        },
      ];
    }),
  );

  // Linear elements have no special logic
  if (!isArrowElement(element)) {
    return {
      positions: naiveDraggingPoints,
    };
  }

  const startIsDragged = selectedPointsIndices.includes(0);
  const endIsDragged = selectedPointsIndices.includes(
    element.points.length - 1,
  );

  const { start, end } = getBindingStrategyForDraggingBindingElementEndpoints(
    element,
    naiveDraggingPoints,
    elementsMap,
    elements,
    app.state,
    {
      newArrow: !!app.state.newElement,
      angleLocked,
      altKey,
    },
  );

  if (isElbowArrow(element)) {
    return {
      positions: naiveDraggingPoints,
      updates: {
        suggestedBinding: startIsDragged
          ? start.element
          : endIsDragged
          ? end.element
          : null,
      },
    };
  }

  if (startIsDragged === endIsDragged) {
    return {
      positions: naiveDraggingPoints,
    };
  }

  // Generate the next bindings for the arrow
  const updates: PointMoveOtherUpdates = {
    suggestedBinding: null,
  };
  if (start.mode === null) {
    updates.startBinding = null;
  } else if (start.mode) {
    updates.startBinding = {
      elementId: start.element.id,
      mode: start.mode,
      ...calculateFixedPointForNonElbowArrowBinding(
        element,
        start.element,
        "start",
        elementsMap,
        start.focusPoint,
      ),
    };

    if (
      startIsDragged &&
      (updates.startBinding.mode === "orbit" ||
        !getFeatureFlag("COMPLEX_BINDINGS"))
    ) {
      updates.suggestedBinding = start.element;
    }
  } else if (startIsDragged) {
    updates.suggestedBinding = app.state.suggestedBinding;
  }

  if (end.mode === null) {
    updates.endBinding = null;
  } else if (end.mode) {
    updates.endBinding = {
      elementId: end.element.id,
      mode: end.mode,
      ...calculateFixedPointForNonElbowArrowBinding(
        element,
        end.element,
        "end",
        elementsMap,
        end.focusPoint,
      ),
    };

    if (
      endIsDragged &&
      (updates.endBinding.mode === "orbit" ||
        !getFeatureFlag("COMPLEX_BINDINGS"))
    ) {
      updates.suggestedBinding = end.element;
    }
  } else if (endIsDragged) {
    updates.suggestedBinding = app.state.suggestedBinding;
  }

  // Simulate the updated arrow for the bind point calculation
  const offsetStartLocalPoint = startIsDragged
    ? pointFrom<LocalPoint>(
        element.points[0][0] + deltaX,
        element.points[0][1] + deltaY,
      )
    : element.points[0];
  const offsetEndLocalPoint = endIsDragged
    ? pointFrom<LocalPoint>(
        element.points[element.points.length - 1][0] + deltaX,
        element.points[element.points.length - 1][1] + deltaY,
      )
    : element.points[element.points.length - 1];
  const nextArrow = {
    ...element,
    points: [
      offsetStartLocalPoint,
      ...element.points.slice(1, -1),
      offsetEndLocalPoint,
    ],
    startBinding:
      updates.startBinding === undefined
        ? element.startBinding
        : updates.startBinding === null
        ? null
        : updates.startBinding,
    endBinding:
      updates.endBinding === undefined
        ? element.endBinding
        : updates.endBinding === null
        ? null
        : updates.endBinding,
  };

  // We need to use a custom intersector to ensure that if there is a big "jump"
  // in the arrow's position, we can position it with outline avoidance
  // pixel-perfectly and avoid "dancing" arrows.
  const customIntersector =
    start.focusPoint && end.focusPoint
      ? lineSegment(start.focusPoint, end.focusPoint)
      : undefined;

  // Needed to handle a special case where an existing arrow is dragged over
  // the same element it is bound to on the other side
  const startIsDraggingOverEndElement =
    element.endBinding &&
    nextArrow.startBinding &&
    startIsDragged &&
    nextArrow.startBinding.elementId === element.endBinding.elementId;
  const endIsDraggingOverStartElement =
    element.startBinding &&
    nextArrow.endBinding &&
    endIsDragged &&
    element.startBinding.elementId === nextArrow.endBinding.elementId;

  // We need to update the non-dragged point too if bound,
  // so we look up the old binding to trigger updateBoundPoint
  const endBindable = nextArrow.endBinding
    ? end.element ??
      (elementsMap.get(
        nextArrow.endBinding.elementId,
      )! as ExcalidrawBindableElement)
    : null;

  const endLocalPoint = startIsDraggingOverEndElement
    ? nextArrow.points[nextArrow.points.length - 1]
    : endIsDraggingOverStartElement &&
      app.state.bindMode !== "inside" &&
      getFeatureFlag("COMPLEX_BINDINGS")
    ? nextArrow.points[0]
    : endBindable
    ? updateBoundPoint(
        element,
        "endBinding",
        nextArrow.endBinding,
        endBindable,
        elementsMap,
        customIntersector,
      ) || nextArrow.points[nextArrow.points.length - 1]
    : nextArrow.points[nextArrow.points.length - 1];

  // We need to keep the simulated next arrow up-to-date, because
  // updateBoundPoint looks at the opposite point
  nextArrow.points[nextArrow.points.length - 1] = endLocalPoint;

  // We need to update the non-dragged point too if bound,
  // so we look up the old binding to trigger updateBoundPoint
  const startBindable = nextArrow.startBinding
    ? start.element ??
      (elementsMap.get(
        nextArrow.startBinding.elementId,
      )! as ExcalidrawBindableElement)
    : null;

  const startLocalPoint =
    endIsDraggingOverStartElement && getFeatureFlag("COMPLEX_BINDINGS")
      ? nextArrow.points[0]
      : startIsDraggingOverEndElement &&
        app.state.bindMode !== "inside" &&
        getFeatureFlag("COMPLEX_BINDINGS")
      ? nextArrow.points[nextArrow.points.length - 1]
      : startBindable
      ? updateBoundPoint(
          element,
          "startBinding",
          nextArrow.startBinding,
          startBindable,
          elementsMap,
          customIntersector,
        ) || nextArrow.points[0]
      : nextArrow.points[0];

  const endChanged =
    pointDistance(
      endLocalPoint,
      nextArrow.points[nextArrow.points.length - 1],
    ) !== 0;
  const startChanged =
    pointDistance(startLocalPoint, nextArrow.points[0]) !== 0;

  const indicesSet = new Set(selectedPointsIndices);
  if (startBindable && startChanged) {
    indicesSet.add(0);
  }
  if (endBindable && endChanged) {
    indicesSet.add(element.points.length - 1);
  }
  const indices = Array.from(indicesSet);

  return {
    updates:
      updates.startBinding || updates.suggestedBinding
        ? {
            startBinding: updates.startBinding,
            suggestedBinding: updates.suggestedBinding,
          }
        : undefined,
    positions: new Map(
      indices.map((idx) => {
        return [
          idx,
          idx === 0
            ? {
                point: startLocalPoint,
                isDragging: true,
              }
            : idx === element.points.length - 1
            ? {
                point: endLocalPoint,
                isDragging: true,
              }
            : naiveDraggingPoints.get(idx)!,
        ];
      }),
    ),
  };
};

const determineCustomLinearAngle = (
  pivotPoint: LocalPoint,
  draggedPoint: LocalPoint,
) =>
  Math.atan2(draggedPoint[1] - pivotPoint[1], draggedPoint[0] - pivotPoint[0]);
