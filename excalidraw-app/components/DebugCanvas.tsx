import {
  ArrowheadArrowIcon,
  CloseIcon,
  TrashIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useExcalidrawAPI } from "@excalidraw/excalidraw/index";
import {
  bootstrapCanvas,
  fillCircle,
  getNormalizedCanvasDimensions,
} from "@excalidraw/excalidraw/renderer/helpers";
import { type AppState } from "@excalidraw/excalidraw/types";
import {
  arrayToMap,
  sceneCoordsToViewportCoords,
  throttleRAF,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  CaptureUpdateAction,
  clearSimpleArrowTangentOverride,
  getGlobalFixedPointForBindableElement,
  getElementAbsoluteCoords,
  getSimpleArrowCurveDebugData,
  isArrowElement,
  isBindableElement,
  setSimpleArrowTangentOverride,
  ShapeCache,
} from "@excalidraw/element";

import {
  isLineSegment,
  pointFrom,
  pointRotateRads,
  type GlobalPoint,
  type LocalPoint,
  type LineSegment,
} from "@excalidraw/math";
import { isCurve } from "@excalidraw/math/curve";

import React from "react";

import type { Curve } from "@excalidraw/math";
import type {
  DebugElement,
  DebugPolygon,
} from "@excalidraw/element/visualdebug";
import type {
  ElementsMap,
  ExcalidrawArrowElement,
  ExcalidrawBindableElement,
  FixedPointBinding,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type { SimpleArrowCurveDebugData } from "@excalidraw/element";

import { STORAGE_KEYS } from "../app_constants";

type DebugCanvasOverlayState = Pick<
  AppState,
  | "width"
  | "height"
  | "zoom"
  | "scrollX"
  | "scrollY"
  | "offsetLeft"
  | "offsetTop"
  | "selectedElementIds"
>;

type SimpleArrowHandleDirection = "incoming" | "outgoing";

type SimpleArrowHandleDescriptor = {
  key: string;
  elementId: string;
  pointIndex: number;
  direction: SimpleArrowHandleDirection;
  point: GlobalPoint;
  handle: GlobalPoint;
  isOverridden: boolean;
  title: string;
};

type SelectedSimpleArrowDebugState = {
  element: ExcalidrawArrowElement;
  debugData: SimpleArrowCurveDebugData<GlobalPoint>;
  handles: SimpleArrowHandleDescriptor[];
};

const areSimpleArrowTangentHandlesEnabled = () =>
  window.EXCALIDRAW_DEBUG_LINEAR_ARROW_TANGENTS !== false;

const pickOverlayState = (appState: AppState): DebugCanvasOverlayState => ({
  width: appState.width,
  height: appState.height,
  zoom: appState.zoom,
  scrollX: appState.scrollX,
  scrollY: appState.scrollY,
  offsetLeft: appState.offsetLeft,
  offsetTop: appState.offsetTop,
  selectedElementIds: appState.selectedElementIds,
});

const getSimpleArrowTransform = (
  element: ExcalidrawArrowElement,
  elementsMap: ElementsMap,
) => {
  const [, , , , cx, cy] = getElementAbsoluteCoords(element, elementsMap);
  const center = pointFrom<GlobalPoint>(cx, cy);

  return {
    pointToGlobal: (point: LocalPoint): GlobalPoint => {
      const rotated = pointRotateRads(
        pointFrom<GlobalPoint>(element.x + point[0], element.y + point[1]),
        center,
        element.angle,
      );

      return pointFrom<GlobalPoint>(rotated[0], rotated[1]);
    },
    vectorToGlobal: (vector: [number, number]): [number, number] => {
      const rotated = pointRotateRads(
        pointFrom<GlobalPoint>(vector[0], vector[1]),
        pointFrom<GlobalPoint>(0, 0),
        element.angle,
      );

      return [rotated[0], rotated[1]];
    },
    vectorToLocal: (vector: [number, number]): [number, number] => {
      const rotated = pointRotateRads(
        pointFrom<GlobalPoint>(vector[0], vector[1]),
        pointFrom<GlobalPoint>(0, 0),
        -element.angle,
      );

      return [rotated[0], rotated[1]];
    },
  };
};

const getSimpleArrowDebugStateForElement = (
  elements: readonly OrderedExcalidrawElement[],
  elementId: string,
): SelectedSimpleArrowDebugState | null => {
  const element = elements.find(
    (candidate): candidate is ExcalidrawArrowElement =>
      candidate.id === elementId &&
      !candidate.isDeleted &&
      isArrowElement(candidate) &&
      !!candidate.roundness &&
      !candidate.elbowed,
  );

  if (!element) {
    return null;
  }

  const elementsMap = arrayToMap(elements);
  const transform = getSimpleArrowTransform(element, elementsMap);
  const localDebugData = getSimpleArrowCurveDebugData(element.points, 0.5, {
    elementId: element.id,
  });
  const debugData: SimpleArrowCurveDebugData<GlobalPoint> = {
    ...localDebugData,
    tangents: localDebugData.tangents.map((tangent) => ({
      ...tangent,
      point: transform.pointToGlobal(tangent.point as LocalPoint),
      base: transform.vectorToGlobal(tangent.base),
      autoScaled: transform.vectorToGlobal(tangent.autoScaled),
      scaled: transform.vectorToGlobal(tangent.scaled),
    })),
    segments: localDebugData.segments.map((segment) => ({
      ...segment,
      start: transform.pointToGlobal(segment.start as LocalPoint),
      end: transform.pointToGlobal(segment.end as LocalPoint),
      baseCp1: transform.pointToGlobal(segment.baseCp1 as LocalPoint),
      baseCp2: transform.pointToGlobal(segment.baseCp2 as LocalPoint),
      cp1: transform.pointToGlobal(segment.cp1 as LocalPoint),
      cp2: transform.pointToGlobal(segment.cp2 as LocalPoint),
    })),
  };
  const handles = debugData.tangents.flatMap((tangent, pointIndex) => {
    const descriptors: SimpleArrowHandleDescriptor[] = [];
    const lengthRatio =
      tangent.normalized.finalLengthVsMinNeighbor === null
        ? "n/a"
        : tangent.normalized.finalLengthVsMinNeighbor.toFixed(3);
    const angleDelta = tangent.normalized.angleDelta.toFixed(3);
    const title = `point ${pointIndex} · len/min ${lengthRatio} · dAngle ${angleDelta} · dblclick resets`;

    if (pointIndex < debugData.tangents.length - 1) {
      descriptors.push({
        key: `${element.id}:${pointIndex}:out`,
        elementId: element.id,
        pointIndex,
        direction: "outgoing",
        point: tangent.point,
        handle: pointFrom<GlobalPoint>(
          tangent.point[0] + tangent.scaled[0] / 3,
          tangent.point[1] + tangent.scaled[1] / 3,
        ),
        isOverridden: tangent.isOverridden,
        title,
      });
    }

    if (pointIndex > 0) {
      descriptors.push({
        key: `${element.id}:${pointIndex}:in`,
        elementId: element.id,
        pointIndex,
        direction: "incoming",
        point: tangent.point,
        handle: pointFrom<GlobalPoint>(
          tangent.point[0] - tangent.scaled[0] / 3,
          tangent.point[1] - tangent.scaled[1] / 3,
        ),
        isOverridden: tangent.isOverridden,
        title,
      });
    }

    return descriptors;
  });

  return {
    element,
    debugData,
    handles,
  };
};

const getSelectedSimpleArrowDebugState = (
  elements: readonly OrderedExcalidrawElement[],
  appState: Pick<AppState, "selectedElementIds">,
) => {
  const selectedIds = Object.keys(appState.selectedElementIds);

  if (selectedIds.length !== 1) {
    return null;
  }

  return getSimpleArrowDebugStateForElement(elements, selectedIds[0]);
};

const renderSelectedSimpleArrowTangentOverlay = (
  context: CanvasRenderingContext2D,
  zoom: number,
  debugState: SelectedSimpleArrowDebugState,
) => {
  context.save();
  context.lineWidth = 1;

  context.setLineDash([6, 4]);
  context.strokeStyle = "rgba(134, 142, 150, 0.75)";

  for (const segment of debugState.debugData.segments) {
    context.beginPath();
    context.moveTo(segment.start[0] * zoom, segment.start[1] * zoom);
    context.lineTo(segment.baseCp1[0] * zoom, segment.baseCp1[1] * zoom);
    context.lineTo(segment.baseCp2[0] * zoom, segment.baseCp2[1] * zoom);
    context.lineTo(segment.end[0] * zoom, segment.end[1] * zoom);
    context.stroke();
  }

  context.setLineDash([]);

  for (const segment of debugState.debugData.segments) {
    context.strokeStyle = segment.overshootsBaseline
      ? "rgba(245, 159, 0, 0.9)"
      : "rgba(94, 90, 216, 0.85)";

    context.beginPath();
    context.moveTo(segment.start[0] * zoom, segment.start[1] * zoom);
    context.lineTo(segment.cp1[0] * zoom, segment.cp1[1] * zoom);
    context.lineTo(segment.cp2[0] * zoom, segment.cp2[1] * zoom);
    context.lineTo(segment.end[0] * zoom, segment.end[1] * zoom);
    context.stroke();
  }

  for (const tangent of debugState.debugData.tangents) {
    if (!tangent.isAdjusted) {
      continue;
    }

    context.strokeStyle = tangent.isOverridden
      ? "rgba(230, 73, 128, 0.95)"
      : "rgba(201, 42, 42, 0.85)";
    context.fillStyle = tangent.isOverridden
      ? "rgba(230, 73, 128, 0.95)"
      : "rgba(201, 42, 42, 0.95)";

    fillCircle(
      context,
      tangent.point[0] * zoom,
      tangent.point[1] * zoom,
      3,
      true,
    );
  }

  context.restore();
};

const renderLine = (
  context: CanvasRenderingContext2D,
  zoom: number,
  segment: LineSegment<GlobalPoint>,
  color: string,
) => {
  context.save();
  context.strokeStyle = color;
  context.beginPath();
  context.moveTo(segment[0][0] * zoom, segment[0][1] * zoom);
  context.lineTo(segment[1][0] * zoom, segment[1][1] * zoom);
  context.stroke();
  context.restore();
};

const renderCubicBezier = (
  context: CanvasRenderingContext2D,
  zoom: number,
  [start, control1, control2, end]: Curve<GlobalPoint>,
  color: string,
) => {
  context.save();
  context.strokeStyle = color;
  context.beginPath();
  context.moveTo(start[0] * zoom, start[1] * zoom);
  context.bezierCurveTo(
    control1[0] * zoom,
    control1[1] * zoom,
    control2[0] * zoom,
    control2[1] * zoom,
    end[0] * zoom,
    end[1] * zoom,
  );
  context.stroke();
  context.restore();
};

const renderPolygon = (
  context: CanvasRenderingContext2D,
  zoom: number,
  polygon: DebugPolygon,
  color: string,
) => {
  const { points, fill, close } = polygon;

  if (points.length < 2) {
    return;
  }

  context.save();
  context.beginPath();
  context.moveTo(points[0][0] * zoom, points[0][1] * zoom);
  for (let i = 1; i < points.length; i += 1) {
    context.lineTo(points[i][0] * zoom, points[i][1] * zoom);
  }
  if (close !== false) {
    context.closePath();
  }

  if (fill) {
    context.save();
    context.globalAlpha = 0.15;
    context.fillStyle = color;
    context.fill();
    context.restore();
  }

  context.strokeStyle = color;
  context.stroke();
  context.restore();
};

const isDebugPolygon = (data: DebugElement["data"]): data is DebugPolygon =>
  (data as DebugPolygon).type === "polygon";

const renderOrigin = (context: CanvasRenderingContext2D, zoom: number) => {
  context.strokeStyle = "#888";
  context.save();
  context.beginPath();
  context.moveTo(-10 * zoom, -10 * zoom);
  context.lineTo(10 * zoom, 10 * zoom);
  context.moveTo(10 * zoom, -10 * zoom);
  context.lineTo(-10 * zoom, 10 * zoom);
  context.stroke();
  context.save();
};

const _renderBinding = (
  context: CanvasRenderingContext2D,
  binding: FixedPointBinding,
  elementsMap: ElementsMap,
  zoom: number,
  width: number,
  height: number,
  color: string,
) => {
  if (!binding.fixedPoint) {
    console.warn("Binding must have a fixedPoint");
    return;
  }

  const bindable = elementsMap.get(
    binding.elementId,
  ) as ExcalidrawBindableElement;
  const [x, y] = getGlobalFixedPointForBindableElement(
    binding.fixedPoint,
    bindable,
    elementsMap,
  );

  context.save();
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x * zoom, y * zoom);
  context.bezierCurveTo(
    x * zoom - width,
    y * zoom - height,
    x * zoom - width,
    y * zoom + height,
    x * zoom,
    y * zoom,
  );
  context.stroke();
  context.restore();
};

const _renderBindableBinding = (
  binding: FixedPointBinding,
  context: CanvasRenderingContext2D,
  elementsMap: ElementsMap,
  zoom: number,
  width: number,
  height: number,
  color: string,
) => {
  const bindable = elementsMap.get(
    binding.elementId,
  ) as ExcalidrawBindableElement;
  if (!binding.fixedPoint) {
    console.warn("Binding must have a fixedPoint");
    return;
  }

  const [x, y] = getGlobalFixedPointForBindableElement(
    binding.fixedPoint,
    bindable,
    elementsMap,
  );

  context.save();
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x * zoom, y * zoom);
  context.bezierCurveTo(
    x * zoom + width,
    y * zoom + height,
    x * zoom + width,
    y * zoom - height,
    x * zoom,
    y * zoom,
  );
  context.stroke();
  context.restore();
};

const renderBindings = (
  context: CanvasRenderingContext2D,
  elements: readonly OrderedExcalidrawElement[],
  zoom: number,
) => {
  const elementsMap = arrayToMap(elements);
  const dim = 16;
  elements.forEach((element) => {
    if (element.isDeleted) {
      return;
    }

    if (isArrowElement(element)) {
      if (element.startBinding) {
        if (
          !elementsMap
            .get(element.startBinding.elementId)
            ?.boundElements?.find((e) => e.id === element.id)
        ) {
          return;
        }

        _renderBinding(
          context,
          element.startBinding,
          elementsMap,
          zoom,
          dim,
          dim,
          element.startBinding?.mode === "orbit" ? "red" : "black",
        );
      }

      if (element.endBinding) {
        if (
          !elementsMap
            .get(element.endBinding.elementId)
            ?.boundElements?.find((e) => e.id === element.id)
        ) {
          return;
        }
        _renderBinding(
          context,
          element.endBinding,
          elementsMap,
          zoom,
          dim,
          dim,
          element.endBinding?.mode === "orbit" ? "red" : "black",
        );
      }
    }

    if (isBindableElement(element) && element.boundElements?.length) {
      element.boundElements.forEach((boundElement) => {
        if (boundElement.type !== "arrow") {
          return;
        }

        const arrow = elementsMap.get(
          boundElement.id,
        ) as ExcalidrawArrowElement;

        if (arrow && arrow.startBinding?.elementId === element.id) {
          _renderBindableBinding(
            arrow.startBinding,
            context,
            elementsMap,
            zoom,
            dim,
            dim,
            "green",
          );
        }
        if (arrow && arrow.endBinding?.elementId === element.id) {
          _renderBindableBinding(
            arrow.endBinding,
            context,
            elementsMap,
            zoom,
            dim,
            dim,
            "green",
          );
        }
      });
    }
  });
};

const render = (
  frame: DebugElement[],
  context: CanvasRenderingContext2D,
  appState: AppState,
) => {
  frame.forEach((el: DebugElement) => {
    switch (true) {
      case isLineSegment(el.data):
        renderLine(
          context,
          appState.zoom.value,
          el.data as LineSegment<GlobalPoint>,
          el.color,
        );
        break;
      case isCurve(el.data):
        renderCubicBezier(
          context,
          appState.zoom.value,
          el.data as Curve<GlobalPoint>,
          el.color,
        );
        break;
      case isDebugPolygon(el.data):
        renderPolygon(context, appState.zoom.value, el.data, el.color);
        break;
      default:
        throw new Error(`Unknown element type ${JSON.stringify(el)}`);
    }
  });
};

const _debugRenderer = (
  canvas: HTMLCanvasElement,
  appState: AppState,
  elements: readonly OrderedExcalidrawElement[],
  scale: number,
) => {
  const [normalizedWidth, normalizedHeight] = getNormalizedCanvasDimensions(
    canvas,
    scale,
  );

  const context = bootstrapCanvas({
    canvas,
    scale,
    normalizedWidth,
    normalizedHeight,
    viewBackgroundColor: "transparent",
  });

  // Apply zoom
  context.save();
  context.translate(
    appState.scrollX * appState.zoom.value,
    appState.scrollY * appState.zoom.value,
  );

  renderOrigin(context, appState.zoom.value);
  renderBindings(context, elements, appState.zoom.value);

  const selectedSimpleArrowDebugState = areSimpleArrowTangentHandlesEnabled()
    ? getSelectedSimpleArrowDebugState(elements, appState)
    : null;

  window.EXCALIDRAW_DEBUG_SELECTED_LINEAR_ARROW =
    selectedSimpleArrowDebugState?.debugData;

  if (
    window.visualDebug?.currentFrame &&
    window.visualDebug?.data &&
    window.visualDebug.data.length > 0
  ) {
    // Render only one frame
    const [idx] = debugFrameData();

    render(window.visualDebug.data[idx], context, appState);
  } else {
    // Render all debug frames
    window.visualDebug?.data.forEach((frame) => {
      render(frame, context, appState);
    });
  }

  if (selectedSimpleArrowDebugState) {
    renderSelectedSimpleArrowTangentOverlay(
      context,
      appState.zoom.value,
      selectedSimpleArrowDebugState,
    );
  }

  if (window.visualDebug) {
    window.visualDebug!.data =
      window.visualDebug?.data.map((frame) =>
        frame.filter((el) => el.permanent),
      ) ?? [];
  }
};

const debugFrameData = (): [number, number] => {
  const currentFrame = window.visualDebug?.currentFrame ?? 0;
  const frameCount = window.visualDebug?.data.length ?? 0;

  if (frameCount > 0) {
    return [currentFrame % frameCount, window.visualDebug?.currentFrame ?? 0];
  }

  return [0, 0];
};

export const saveDebugState = (debug: { enabled: boolean }) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.LOCAL_STORAGE_DEBUG,
      JSON.stringify(debug),
    );
  } catch (error: any) {
    console.error(error);
  }
};

export const debugRenderer = throttleRAF(
  (
    canvas: HTMLCanvasElement,
    appState: AppState,
    elements: readonly OrderedExcalidrawElement[],
    scale: number,
  ) => {
    _debugRenderer(canvas, appState, elements, scale);
  },
);

export const loadSavedDebugState = () => {
  let debug;
  try {
    const savedDebugState = localStorage.getItem(
      STORAGE_KEYS.LOCAL_STORAGE_DEBUG,
    );
    if (savedDebugState) {
      debug = JSON.parse(savedDebugState) as { enabled: boolean };
    }
  } catch (error: any) {
    console.error(error);
  }

  return debug ?? { enabled: false };
};

export const isVisualDebuggerEnabled = () =>
  Array.isArray(window.visualDebug?.data);

export const DebugFooter = ({ onChange }: { onChange: () => void }) => {
  const moveForward = useCallback(() => {
    if (
      !window.visualDebug?.currentFrame ||
      isNaN(window.visualDebug?.currentFrame ?? -1)
    ) {
      window.visualDebug!.currentFrame = 0;
    }
    window.visualDebug!.currentFrame += 1;
    onChange();
  }, [onChange]);
  const moveBackward = useCallback(() => {
    if (
      !window.visualDebug?.currentFrame ||
      isNaN(window.visualDebug?.currentFrame ?? -1) ||
      window.visualDebug?.currentFrame < 1
    ) {
      window.visualDebug!.currentFrame = 1;
    }
    window.visualDebug!.currentFrame -= 1;
    onChange();
  }, [onChange]);
  const reset = useCallback(() => {
    window.visualDebug!.currentFrame = undefined;
    onChange();
  }, [onChange]);
  const trashFrames = useCallback(() => {
    if (window.visualDebug) {
      window.visualDebug.currentFrame = undefined;
      window.visualDebug.data = [];
    }
    onChange();
  }, [onChange]);

  return (
    <>
      <button
        className="ToolIcon_type_button"
        data-testid="debug-forward"
        aria-label="Move forward"
        type="button"
        onClick={trashFrames}
      >
        <div
          className="ToolIcon__icon"
          aria-hidden="true"
          aria-disabled="false"
        >
          {TrashIcon}
        </div>
      </button>
      <button
        className="ToolIcon_type_button"
        data-testid="debug-forward"
        aria-label="Move forward"
        type="button"
        onClick={moveBackward}
      >
        <div
          className="ToolIcon__icon"
          aria-hidden="true"
          aria-disabled="false"
        >
          <ArrowheadArrowIcon flip />
        </div>
      </button>
      <button
        className="ToolIcon_type_button"
        data-testid="debug-forward"
        aria-label="Move forward"
        type="button"
        onClick={reset}
      >
        <div
          className="ToolIcon__icon"
          aria-hidden="true"
          aria-disabled="false"
        >
          {CloseIcon}
        </div>
      </button>
      <button
        className="ToolIcon_type_button"
        data-testid="debug-backward"
        aria-label="Move backward"
        type="button"
        onClick={moveForward}
      >
        <div
          className="ToolIcon__icon"
          aria-hidden="true"
          aria-disabled="false"
        >
          <ArrowheadArrowIcon />
        </div>
      </button>
    </>
  );
};

interface DebugCanvasProps {
  appState: AppState;
  scale: number;
}

const DebugCanvas = React.forwardRef<HTMLCanvasElement, DebugCanvasProps>(
  ({ appState, scale }, ref) => {
    const excalidrawAPI = useExcalidrawAPI();
    const [overlayState, setOverlayState] = useState<DebugCanvasOverlayState>(
      () => pickOverlayState(appState),
    );
    const [selectedSimpleArrowDebugState, setSelectedSimpleArrowDebugState] =
      useState<SelectedSimpleArrowDebugState | null>(null);
    const dragStateRef = useRef<{
      elementId: string;
      pointIndex: number;
      direction: SimpleArrowHandleDirection;
    } | null>(null);

    const syncSelectedSimpleArrowDebugState = useCallback(
      (
        nextAppState: AppState,
        nextElements?: readonly OrderedExcalidrawElement[],
      ) => {
        if (!excalidrawAPI || excalidrawAPI.isDestroyed) {
          return;
        }

        const elements =
          nextElements ??
          (excalidrawAPI.getSceneElements() as OrderedExcalidrawElement[]);

        setOverlayState(pickOverlayState(nextAppState));

        const nextDebugState = areSimpleArrowTangentHandlesEnabled()
          ? getSelectedSimpleArrowDebugState(elements, nextAppState)
          : null;

        window.EXCALIDRAW_DEBUG_SELECTED_LINEAR_ARROW =
          nextDebugState?.debugData;
        setSelectedSimpleArrowDebugState(nextDebugState);
      },
      [excalidrawAPI],
    );

    useEffect(() => {
      if (!excalidrawAPI || excalidrawAPI.isDestroyed) {
        return;
      }

      syncSelectedSimpleArrowDebugState(excalidrawAPI.getAppState());

      const unsubscribeChange = excalidrawAPI.onChange(
        (elements, nextAppState) =>
          syncSelectedSimpleArrowDebugState(
            nextAppState,
            elements as readonly OrderedExcalidrawElement[],
          ),
      );
      const unsubscribeState = excalidrawAPI.onStateChange(
        [
          "selectedElementIds",
          "zoom",
          "scrollX",
          "scrollY",
          "offsetLeft",
          "offsetTop",
          "width",
          "height",
        ],
        (_value, nextAppState) =>
          syncSelectedSimpleArrowDebugState(nextAppState),
      );

      return () => {
        unsubscribeChange();
        unsubscribeState();
      };
    }, [excalidrawAPI, syncSelectedSimpleArrowDebugState]);

    const rerenderSceneForSimpleArrowOverride = useCallback(() => {
      if (!excalidrawAPI || excalidrawAPI.isDestroyed) {
        return;
      }

      excalidrawAPI.updateScene({
        elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    }, [excalidrawAPI]);

    const commitOverrideForHandle = useCallback(
      (
        handle: Pick<
          SimpleArrowHandleDescriptor,
          "elementId" | "pointIndex" | "direction"
        >,
        clientX: number,
        clientY: number,
      ) => {
        if (!excalidrawAPI || excalidrawAPI.isDestroyed) {
          return;
        }

        const nextAppState = excalidrawAPI.getAppState();
        const nextElements =
          excalidrawAPI.getSceneElements() as OrderedExcalidrawElement[];
        const debugState = getSimpleArrowDebugStateForElement(
          nextElements,
          handle.elementId,
        );

        if (!debugState) {
          return;
        }

        const scenePoint = viewportCoordsToSceneCoords(
          { clientX, clientY },
          nextAppState,
        );
        const tangent =
          handle.direction === "outgoing"
            ? ([
                (scenePoint.x -
                  debugState.debugData.tangents[handle.pointIndex].point[0]) *
                  3,
                (scenePoint.y -
                  debugState.debugData.tangents[handle.pointIndex].point[1]) *
                  3,
              ] as [number, number])
            : ([
                (debugState.debugData.tangents[handle.pointIndex].point[0] -
                  scenePoint.x) *
                  3,
                (debugState.debugData.tangents[handle.pointIndex].point[1] -
                  scenePoint.y) *
                  3,
              ] as [number, number]);
        const localTangent = getSimpleArrowTransform(
          debugState.element,
          arrayToMap(nextElements),
        ).vectorToLocal(tangent);

        setSimpleArrowTangentOverride(
          debugState.element.id,
          handle.pointIndex,
          localTangent,
        );
        ShapeCache.delete(debugState.element);
        rerenderSceneForSimpleArrowOverride();
        syncSelectedSimpleArrowDebugState(nextAppState, nextElements);
      },
      [
        excalidrawAPI,
        rerenderSceneForSimpleArrowOverride,
        syncSelectedSimpleArrowDebugState,
      ],
    );

    const onPointerMove = useCallback(
      (event: PointerEvent) => {
        if (!dragStateRef.current) {
          return;
        }

        event.preventDefault();
        commitOverrideForHandle(
          dragStateRef.current,
          event.clientX,
          event.clientY,
        );
      },
      [commitOverrideForHandle],
    );

    const onPointerUp = useCallback(
      (event: PointerEvent) => {
        if (!dragStateRef.current) {
          return;
        }

        event.preventDefault();
        dragStateRef.current = null;
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
      },
      [onPointerMove],
    );

    useEffect(() => {
      return () => {
        dragStateRef.current = null;
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
      };
    }, [onPointerMove, onPointerUp]);

    const handlePointerDown = useCallback(
      (
        handle: SimpleArrowHandleDescriptor,
        event: React.PointerEvent<HTMLDivElement>,
      ) => {
        event.preventDefault();
        event.stopPropagation();

        dragStateRef.current = {
          elementId: handle.elementId,
          pointIndex: handle.pointIndex,
          direction: handle.direction,
        };

        window.addEventListener("pointermove", onPointerMove, {
          passive: false,
        });
        window.addEventListener("pointerup", onPointerUp, {
          passive: false,
        });
        window.addEventListener("pointercancel", onPointerUp, {
          passive: false,
        });

        commitOverrideForHandle(handle, event.clientX, event.clientY);
      },
      [commitOverrideForHandle, onPointerMove, onPointerUp],
    );

    const resetHandleOverride = useCallback(
      (
        handle: SimpleArrowHandleDescriptor,
        event: React.MouseEvent<HTMLDivElement>,
      ) => {
        event.preventDefault();
        event.stopPropagation();

        if (!excalidrawAPI || excalidrawAPI.isDestroyed) {
          return;
        }

        clearSimpleArrowTangentOverride(handle.elementId, handle.pointIndex);

        const nextElements =
          excalidrawAPI.getSceneElements() as OrderedExcalidrawElement[];
        const element = nextElements.find(
          (candidate): candidate is ExcalidrawArrowElement =>
            candidate.id === handle.elementId &&
            !candidate.isDeleted &&
            isArrowElement(candidate),
        );

        if (element) {
          ShapeCache.delete(element);
          rerenderSceneForSimpleArrowOverride();
        }

        syncSelectedSimpleArrowDebugState(
          excalidrawAPI.getAppState(),
          nextElements,
        );
      },
      [
        excalidrawAPI,
        rerenderSceneForSimpleArrowOverride,
        syncSelectedSimpleArrowDebugState,
      ],
    );

    const { width, height } = overlayState;

    return (
      <>
        <canvas
          style={{
            width,
            height,
            position: "absolute",
            inset: 0,
            zIndex: 2,
            pointerEvents: "none",
          }}
          width={width * scale}
          height={height * scale}
          ref={ref}
        >
          Debug Canvas
        </canvas>
        {selectedSimpleArrowDebugState?.handles.map((handle) => {
          const { x, y } = sceneCoordsToViewportCoords(
            {
              sceneX: handle.handle[0],
              sceneY: handle.handle[1],
            },
            overlayState,
          );

          return (
            <div
              key={handle.key}
              title={handle.title}
              onPointerDown={(event) => handlePointerDown(handle, event)}
              onDoubleClick={(event) => resetHandleOverride(handle, event)}
              style={{
                position: "absolute",
                left: x - overlayState.offsetLeft,
                top: y - overlayState.offsetTop,
                width: 12,
                height: 12,
                zIndex: 3,
                borderRadius: handle.direction === "outgoing" ? "999px" : 3,
                transform: "translate(-50%, -50%)",
                background: handle.isOverridden
                  ? "rgba(230, 73, 128, 0.95)"
                  : handle.direction === "outgoing"
                  ? "rgba(94, 90, 216, 0.95)"
                  : "rgba(245, 159, 0, 0.95)",
                border: "2px solid rgba(255,255,255,0.95)",
                boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.18)",
                pointerEvents: "auto",
                cursor: "grab",
              }}
            />
          );
        })}
      </>
    );
  },
);

export default DebugCanvas;
