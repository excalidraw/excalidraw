import {
  clamp,
  pointFrom,
  pointsEqual,
  type GlobalPoint,
  type LocalPoint,
  type Radians,
} from "@excalidraw/math";
import oc from "open-color";

import {
  arrayToMap,
  BIND_MODE_TIMEOUT,
  DEFAULT_TRANSFORM_HANDLE_SPACING,
  FRAME_STYLE,
  getFeatureFlag,
  invariant,
  THEME,
} from "@excalidraw/common";

import {
  deconstructDiamondElement,
  deconstructRectanguloidElement,
  elementCenterPoint,
  getOmitSidesForEditorInterface,
  getTransformHandles,
  getTransformHandlesFromCoords,
  hasBoundingBox,
  isElbowArrow,
  isFrameLikeElement,
  isImageElement,
  isLinearElement,
  isLineElement,
  isTextElement,
  LinearElementEditor,
} from "@excalidraw/element";

import { renderSelectionElement } from "@excalidraw/element";

import {
  getElementsInGroup,
  getSelectedGroupIds,
  isSelectedViaGroup,
  selectGroupsFromGivenElements,
} from "@excalidraw/element";

import { getCommonBounds, getElementAbsoluteCoords } from "@excalidraw/element";

import type {
  TransformHandles,
  TransformHandleType,
} from "@excalidraw/element";

import type {
  ElementsMap,
  ExcalidrawBindableElement,
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  ExcalidrawImageElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  GroupId,
  NonDeleted,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import { renderSnaps } from "../renderer/renderSnaps";
import { roundRect } from "../renderer/roundRect";
import {
  getScrollBars,
  SCROLLBAR_COLOR,
  SCROLLBAR_WIDTH,
} from "../scene/scrollbars";

import {
  type AppClassProperties,
  type InteractiveCanvasAppState,
} from "../types";

import { getClientColor, renderRemoteCursors } from "../clients";

import {
  bootstrapCanvas,
  fillCircle,
  getNormalizedCanvasDimensions,
  strokeRectWithRotation_simple,
} from "./helpers";

import type {
  InteractiveCanvasRenderConfig,
  InteractiveSceneRenderConfig,
  RenderableElementsMap,
} from "../scene/types";

const renderElbowArrowMidPointHighlight = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
) => {
  invariant(appState.selectedLinearElement, "selectedLinearElement is null");

  const { segmentMidPointHoveredCoords } = appState.selectedLinearElement;

  invariant(segmentMidPointHoveredCoords, "midPointCoords is null");

  context.save();
  context.translate(appState.scrollX, appState.scrollY);

  highlightPoint(segmentMidPointHoveredCoords, context, appState);

  context.restore();
};

const renderLinearElementPointHighlight = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
  elementsMap: ElementsMap,
) => {
  const { elementId, hoverPointIndex } = appState.selectedLinearElement!;
  if (
    appState.selectedLinearElement?.isEditing &&
    appState.selectedLinearElement?.selectedPointsIndices?.includes(
      hoverPointIndex,
    )
  ) {
    return;
  }
  const element = LinearElementEditor.getElement(elementId, elementsMap);

  if (!element) {
    return;
  }
  const point = LinearElementEditor.getPointAtIndexGlobalCoordinates(
    element,
    hoverPointIndex,
    elementsMap,
  );
  context.save();
  context.translate(appState.scrollX, appState.scrollY);

  highlightPoint(point, context, appState);
  context.restore();
};

const highlightPoint = <Point extends LocalPoint | GlobalPoint>(
  point: Point,
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
) => {
  context.fillStyle = "rgba(105, 101, 219, 0.4)";

  fillCircle(
    context,
    point[0],
    point[1],
    LinearElementEditor.POINT_HANDLE_SIZE / appState.zoom.value,
    false,
  );
};

// ---------------------------------------------------------------------------
// Technical Drawing Mode - Rendering helpers for angles and segment lengths
// ---------------------------------------------------------------------------

const TechnicalDrawingConfig = {
  colors: {
    light: {
      stroke: "rgba(140, 140, 140, 0.6)",
      text: "rgba(80, 80, 80, 0.9)",
      background: "rgba(255, 255, 255, 0.85)",
    },
    dark: {
      stroke: "rgba(180, 180, 180, 0.6)",
      text: "rgba(220, 220, 220, 0.9)",
      background: "rgba(40, 40, 40, 0.85)",
    },
  },
  arc: {
    innerRadius: 20,
    outerRadius: 30,
    lineWidth: 1,
  },
  label: {
    fontSize: 11,
    padding: 3,
    borderRadius: 2,
    offsetDistance: 15,
  },
} as const;

type TechnicalDrawingColors = {
  stroke: string;
  text: string;
  background: string;
};

const getTechnicalDrawingColors = (isDark: boolean): TechnicalDrawingColors =>
  isDark
    ? TechnicalDrawingConfig.colors.dark
    : TechnicalDrawingConfig.colors.light;

/**
 * Draws a label with background at the specified position
 */
const drawTechnicalLabel = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  colors: TechnicalDrawingColors,
  zoom: number,
) => {
  const fontSize = TechnicalDrawingConfig.label.fontSize / zoom;
  const padding = TechnicalDrawingConfig.label.padding / zoom;
  const bgRadius = TechnicalDrawingConfig.label.borderRadius / zoom;

  context.font = `${fontSize}px Cascadia, monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  const textMetrics = context.measureText(text);
  const bgWidth = textMetrics.width + padding * 2;
  const bgHeight = fontSize + padding * 2;

  // Background
  context.fillStyle = colors.background;
  context.beginPath();
  context.roundRect?.(
    x - bgWidth / 2,
    y - bgHeight / 2,
    bgWidth,
    bgHeight,
    bgRadius,
  );
  context.fill();

  // Text
  context.fillStyle = colors.text;
  context.fillText(text, x, y);
};

/**
 * Renders the length of the current line segment being drawn
 */
const renderSegmentLength = (
  context: CanvasRenderingContext2D,
  elementX: number,
  elementY: number,
  startPoint: readonly [number, number],
  endPoint: readonly [number, number],
  colors: TechnicalDrawingColors,
  zoom: number,
) => {
  const dx = endPoint[0] - startPoint[0];
  const dy = endPoint[1] - startPoint[1];
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq < 1) {
    return;
  }

  const length = Math.sqrt(lengthSq);
  const text = `${Math.round(length)}px`;

  // Position at segment midpoint
  const midX = elementX + (startPoint[0] + endPoint[0]) / 2;
  const midY = elementY + (startPoint[1] + endPoint[1]) / 2;

  // Offset perpendicular to line
  const perpX = -dy / length;
  const perpY = dx / length;
  const offsetDist = TechnicalDrawingConfig.label.offsetDistance / zoom;

  // Prefer upward/leftward offset for visibility
  const offsetSign = perpY < 0 || (perpY === 0 && perpX < 0) ? 1 : -1;
  const labelX = midX + perpX * offsetDist * offsetSign;
  const labelY = midY + perpY * offsetDist * offsetSign;

  drawTechnicalLabel(context, text, labelX, labelY, colors, zoom);
};

/**
 * Renders the angle of a line segment relative to the horizontal axis.
 * Shows a dashed horizontal reference line and an arc from 0° to the line angle.
 */
const renderHorizontalReferenceAngle = (
  context: CanvasRenderingContext2D,
  elementX: number,
  elementY: number,
  startPoint: readonly [number, number],
  endPoint: readonly [number, number],
  colors: TechnicalDrawingColors,
  zoom: number,
) => {
  const dx = endPoint[0] - startPoint[0];
  const dy = endPoint[1] - startPoint[1];

  if (dx * dx + dy * dy < 1) {
    return;
  }

  // Angle from horizontal (0 = right, positive = counterclockwise)
  const lineAngle = Math.atan2(dy, dx);

  // Convert to degrees (absolute value to match the arc being drawn)
  const angleDeg = Math.abs(Math.round((lineAngle * 180) / Math.PI));

  const originX = elementX + startPoint[0];
  const originY = elementY + startPoint[1];

  const arcRadius = TechnicalDrawingConfig.arc.innerRadius / zoom;
  const refLineLength = arcRadius * 3;

  context.strokeStyle = colors.stroke;

  // Draw dashed horizontal reference line (thinner than arc)
  context.lineWidth = 1 / zoom;
  context.setLineDash([4 / zoom, 4 / zoom]);
  context.beginPath();
  context.moveTo(originX, originY);
  context.lineTo(originX + refLineLength, originY);
  context.stroke();
  context.setLineDash([]);

  // Draw arc from horizontal (0) to line angle
  // Always draw the smaller arc (the one that represents the angle shown)
  context.lineWidth = TechnicalDrawingConfig.arc.lineWidth / zoom;
  const counterclockwise = lineAngle < 0;
  context.beginPath();
  context.arc(originX, originY, arcRadius, 0, lineAngle, counterclockwise);
  context.stroke();

  // Position label at arc midpoint
  const midAngle = lineAngle / 2;
  const labelX = originX + Math.cos(midAngle) * arcRadius;
  const labelY = originY + Math.sin(midAngle) * arcRadius;

  drawTechnicalLabel(context, `${angleDeg}°`, labelX, labelY, colors, zoom);
};

/**
 * Renders angle arcs and measurements between two line segments
 */
const renderAngleArcs = (
  context: CanvasRenderingContext2D,
  elementX: number,
  elementY: number,
  p1: readonly [number, number],
  vertex: readonly [number, number],
  p3: readonly [number, number],
  colors: TechnicalDrawingColors,
  zoom: number,
) => {
  // Vectors from vertex
  const v1x = p1[0] - vertex[0];
  const v1y = p1[1] - vertex[1];
  const v2x = p3[0] - vertex[0];
  const v2y = p3[1] - vertex[1];

  // Check minimum segment length
  if (v1x * v1x + v1y * v1y < 1 || v2x * v2x + v2y * v2y < 1) {
    return;
  }

  // Calculate angles using atan2
  const angle1 = Math.atan2(v1y, v1x);
  const angle2 = Math.atan2(v2y, v2x);

  // Normalize angle difference to [-π, π]
  let angleDiff = angle2 - angle1;
  if (angleDiff > Math.PI) {
    angleDiff -= 2 * Math.PI;
  } else if (angleDiff < -Math.PI) {
    angleDiff += 2 * Math.PI;
  }

  const innerAngleDeg = Math.round((Math.abs(angleDiff) * 180) / Math.PI);
  const outerAngleDeg = 360 - innerAngleDeg;
  const innerIsCounterclockwise = angleDiff > 0;

  const vertexX = elementX + vertex[0];
  const vertexY = elementY + vertex[1];

  const innerRadius = TechnicalDrawingConfig.arc.innerRadius / zoom;
  const outerRadius = TechnicalDrawingConfig.arc.outerRadius / zoom;

  // Arc midpoint angles for label positioning
  const innerMidAngle = angle1 + angleDiff / 2;
  const outerMidAngle = innerMidAngle + Math.PI;

  // Draw arcs
  context.strokeStyle = colors.stroke;
  context.lineWidth = TechnicalDrawingConfig.arc.lineWidth / zoom;

  context.beginPath();
  context.arc(
    vertexX,
    vertexY,
    innerRadius,
    angle1,
    angle2,
    innerIsCounterclockwise,
  );
  context.stroke();

  context.beginPath();
  context.arc(
    vertexX,
    vertexY,
    outerRadius,
    angle1,
    angle2,
    !innerIsCounterclockwise,
  );
  context.stroke();

  // Draw angle labels
  drawTechnicalLabel(
    context,
    `${innerAngleDeg}°`,
    vertexX + Math.cos(innerMidAngle) * innerRadius,
    vertexY + Math.sin(innerMidAngle) * innerRadius,
    colors,
    zoom,
  );

  drawTechnicalLabel(
    context,
    `${outerAngleDeg}°`,
    vertexX + Math.cos(outerMidAngle) * outerRadius,
    vertexY + Math.sin(outerMidAngle) * outerRadius,
    colors,
    zoom,
  );
};

/**
 * Main entry point for technical drawing mode rendering.
 * Displays segment lengths and angle measurements for multiElement lines.
 */
const renderTechnicalDrawingHints = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
) => {
  if (!appState.technicalDrawingMode) {
    return;
  }

  const { multiElement } = appState;
  if (!multiElement || multiElement.points.length < 2) {
    return;
  }

  const points = multiElement.points;
  const numPoints = points.length;
  const colors = getTechnicalDrawingColors(appState.theme === THEME.DARK);

  context.save();
  context.translate(appState.scrollX, appState.scrollY);

  // Render current segment length
  renderSegmentLength(
    context,
    multiElement.x,
    multiElement.y,
    points[numPoints - 2],
    points[numPoints - 1],
    colors,
    appState.zoom.value,
  );

  // Render horizontal reference angle for first segment
  if (numPoints === 2) {
    renderHorizontalReferenceAngle(
      context,
      multiElement.x,
      multiElement.y,
      points[0],
      points[1],
      colors,
      appState.zoom.value,
    );
  }

  // Render angle arcs if we have at least 3 points
  if (numPoints >= 3) {
    renderAngleArcs(
      context,
      multiElement.x,
      multiElement.y,
      points[numPoints - 3],
      points[numPoints - 2],
      points[numPoints - 1],
      colors,
      appState.zoom.value,
    );
  }

  context.restore();
};

const renderSingleLinearPoint = <Point extends GlobalPoint | LocalPoint>(
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
  point: Point,
  radius: number,
  isSelected: boolean,
  isPhantomPoint: boolean,
  isOverlappingPoint: boolean,
) => {
  context.strokeStyle = "#5e5ad8";
  context.setLineDash([]);
  context.fillStyle = "rgba(255, 255, 255, 0.9)";
  if (isSelected) {
    context.fillStyle = "rgba(134, 131, 226, 0.9)";
  } else if (isPhantomPoint) {
    context.fillStyle = "rgba(177, 151, 252, 0.7)";
  }

  fillCircle(
    context,
    point[0],
    point[1],
    (isOverlappingPoint
      ? radius * (appState.selectedLinearElement?.isEditing ? 1.5 : 2)
      : radius) / appState.zoom.value,
    !isPhantomPoint,
    !isOverlappingPoint || isSelected,
  );
};

const renderBindingHighlightForBindableElement_simple = (
  context: CanvasRenderingContext2D,
  element: ExcalidrawBindableElement,
  elementsMap: ElementsMap,
  appState: InteractiveCanvasAppState,
) => {
  const enclosingFrame = element.frameId && elementsMap.get(element.frameId);
  if (enclosingFrame && isFrameLikeElement(enclosingFrame)) {
    context.translate(
      enclosingFrame.x + appState.scrollX,
      enclosingFrame.y + appState.scrollY,
    );

    context.beginPath();

    if (FRAME_STYLE.radius && context.roundRect) {
      context.roundRect(
        -1,
        -1,
        enclosingFrame.width + 1,
        enclosingFrame.height + 1,
        FRAME_STYLE.radius / appState.zoom.value,
      );
    } else {
      context.rect(-1, -1, enclosingFrame.width + 1, enclosingFrame.height + 1);
    }

    context.clip();

    context.translate(
      -(enclosingFrame.x + appState.scrollX),
      -(enclosingFrame.y + appState.scrollY),
    );
  }

  switch (element.type) {
    case "magicframe":
    case "frame":
      context.save();

      context.translate(
        element.x + appState.scrollX,
        element.y + appState.scrollY,
      );

      context.lineWidth = FRAME_STYLE.strokeWidth / appState.zoom.value;
      context.strokeStyle =
        appState.theme === THEME.DARK
          ? `rgba(3, 93, 161, 1)`
          : `rgba(106, 189, 252, 1)`;

      if (FRAME_STYLE.radius && context.roundRect) {
        context.beginPath();
        context.roundRect(
          0,
          0,
          element.width,
          element.height,
          FRAME_STYLE.radius / appState.zoom.value,
        );
        context.stroke();
        context.closePath();
      } else {
        context.strokeRect(0, 0, element.width, element.height);
      }

      context.restore();
      break;
    default:
      context.save();

      const center = elementCenterPoint(element, elementsMap);

      context.translate(center[0], center[1]);
      context.rotate(element.angle as Radians);
      context.translate(-center[0], -center[1]);

      context.translate(element.x, element.y);

      context.lineWidth =
        clamp(1.75, element.strokeWidth, 4) /
        Math.max(0.25, appState.zoom.value);
      context.strokeStyle =
        appState.theme === THEME.DARK
          ? `rgba(3, 93, 161, 1)`
          : `rgba(106, 189, 252, 1)`;

      switch (element.type) {
        case "ellipse":
          context.beginPath();
          context.ellipse(
            element.width / 2,
            element.height / 2,
            element.width / 2,
            element.height / 2,
            0,
            0,
            2 * Math.PI,
          );
          context.closePath();
          context.stroke();
          break;
        case "diamond":
          {
            const [segments, curves] = deconstructDiamondElement(element);

            // Draw each line segment individually
            segments.forEach((segment) => {
              context.beginPath();
              context.moveTo(
                segment[0][0] - element.x,
                segment[0][1] - element.y,
              );
              context.lineTo(
                segment[1][0] - element.x,
                segment[1][1] - element.y,
              );
              context.stroke();
            });

            // Draw each curve individually (for rounded corners)
            curves.forEach((curve) => {
              const [start, control1, control2, end] = curve;
              context.beginPath();
              context.moveTo(start[0] - element.x, start[1] - element.y);
              context.bezierCurveTo(
                control1[0] - element.x,
                control1[1] - element.y,
                control2[0] - element.x,
                control2[1] - element.y,
                end[0] - element.x,
                end[1] - element.y,
              );
              context.stroke();
            });
          }

          break;
        default:
          {
            const [segments, curves] = deconstructRectanguloidElement(element);

            // Draw each line segment individually
            segments.forEach((segment) => {
              context.beginPath();
              context.moveTo(
                segment[0][0] - element.x,
                segment[0][1] - element.y,
              );
              context.lineTo(
                segment[1][0] - element.x,
                segment[1][1] - element.y,
              );
              context.stroke();
            });

            // Draw each curve individually (for rounded corners)
            curves.forEach((curve) => {
              const [start, control1, control2, end] = curve;
              context.beginPath();
              context.moveTo(start[0] - element.x, start[1] - element.y);
              context.bezierCurveTo(
                control1[0] - element.x,
                control1[1] - element.y,
                control2[0] - element.x,
                control2[1] - element.y,
                end[0] - element.x,
                end[1] - element.y,
              );
              context.stroke();
            });
          }

          break;
      }

      context.restore();

      break;
  }
};

const renderBindingHighlightForBindableElement_complex = (
  app: AppClassProperties,
  context: CanvasRenderingContext2D,
  element: ExcalidrawBindableElement,
  allElementsMap: NonDeletedSceneElementsMap,
  appState: InteractiveCanvasAppState,
  deltaTime: number,
  state?: { runtime: number },
) => {
  const countdownInProgress =
    app.state.bindMode === "orbit" && app.bindModeHandler !== null;

  const remainingTime =
    BIND_MODE_TIMEOUT -
    (state?.runtime ?? (countdownInProgress ? 0 : BIND_MODE_TIMEOUT));
  const opacity = clamp((1 / BIND_MODE_TIMEOUT) * remainingTime, 0.0001, 1);
  const offset = element.strokeWidth / 2;

  const enclosingFrame = element.frameId && allElementsMap.get(element.frameId);
  if (enclosingFrame && isFrameLikeElement(enclosingFrame)) {
    context.translate(
      enclosingFrame.x + appState.scrollX,
      enclosingFrame.y + appState.scrollY,
    );

    context.beginPath();

    if (FRAME_STYLE.radius && context.roundRect) {
      context.roundRect(
        -1,
        -1,
        enclosingFrame.width + 1,
        enclosingFrame.height + 1,
        FRAME_STYLE.radius / appState.zoom.value,
      );
    } else {
      context.rect(-1, -1, enclosingFrame.width + 1, enclosingFrame.height + 1);
    }

    context.clip();

    context.translate(
      -(enclosingFrame.x + appState.scrollX),
      -(enclosingFrame.y + appState.scrollY),
    );
  }

  switch (element.type) {
    case "magicframe":
    case "frame":
      context.save();

      context.translate(
        element.x + appState.scrollX,
        element.y + appState.scrollY,
      );

      context.lineWidth = FRAME_STYLE.strokeWidth / appState.zoom.value;
      context.strokeStyle =
        appState.theme === THEME.DARK
          ? `rgba(3, 93, 161, ${opacity})`
          : `rgba(106, 189, 252, ${opacity})`;

      if (FRAME_STYLE.radius && context.roundRect) {
        context.beginPath();
        context.roundRect(
          0,
          0,
          element.width,
          element.height,
          FRAME_STYLE.radius / appState.zoom.value,
        );
        context.stroke();
        context.closePath();
      } else {
        context.strokeRect(0, 0, element.width, element.height);
      }

      context.restore();
      break;
    default:
      context.save();

      const center = elementCenterPoint(element, allElementsMap);
      const cx = center[0] + appState.scrollX;
      const cy = center[1] + appState.scrollY;

      context.translate(cx, cy);
      context.rotate(element.angle as Radians);
      context.translate(-cx, -cy);

      context.translate(
        element.x + appState.scrollX - offset,
        element.y + appState.scrollY - offset,
      );

      context.lineWidth =
        clamp(2.5, element.strokeWidth * 1.75, 4) /
        Math.max(0.25, appState.zoom.value);
      context.strokeStyle =
        appState.theme === THEME.DARK
          ? `rgba(3, 93, 161, ${opacity / 2})`
          : `rgba(106, 189, 252, ${opacity / 2})`;

      switch (element.type) {
        case "ellipse":
          context.beginPath();
          context.ellipse(
            (element.width + offset * 2) / 2,
            (element.height + offset * 2) / 2,
            (element.width + offset * 2) / 2,
            (element.height + offset * 2) / 2,
            0,
            0,
            2 * Math.PI,
          );
          context.closePath();
          context.stroke();
          break;
        case "diamond":
          {
            const [segments, curves] = deconstructDiamondElement(
              element,
              offset,
            );

            // Draw each line segment individually
            segments.forEach((segment) => {
              context.beginPath();
              context.moveTo(
                segment[0][0] - element.x + offset,
                segment[0][1] - element.y + offset,
              );
              context.lineTo(
                segment[1][0] - element.x + offset,
                segment[1][1] - element.y + offset,
              );
              context.stroke();
            });

            // Draw each curve individually (for rounded corners)
            curves.forEach((curve) => {
              const [start, control1, control2, end] = curve;
              context.beginPath();
              context.moveTo(
                start[0] - element.x + offset,
                start[1] - element.y + offset,
              );
              context.bezierCurveTo(
                control1[0] - element.x + offset,
                control1[1] - element.y + offset,
                control2[0] - element.x + offset,
                control2[1] - element.y + offset,
                end[0] - element.x + offset,
                end[1] - element.y + offset,
              );
              context.stroke();
            });
          }

          break;
        default:
          {
            const [segments, curves] = deconstructRectanguloidElement(
              element,
              offset,
            );

            // Draw each line segment individually
            segments.forEach((segment) => {
              context.beginPath();
              context.moveTo(
                segment[0][0] - element.x + offset,
                segment[0][1] - element.y + offset,
              );
              context.lineTo(
                segment[1][0] - element.x + offset,
                segment[1][1] - element.y + offset,
              );
              context.stroke();
            });

            // Draw each curve individually (for rounded corners)
            curves.forEach((curve) => {
              const [start, control1, control2, end] = curve;
              context.beginPath();
              context.moveTo(
                start[0] - element.x + offset,
                start[1] - element.y + offset,
              );
              context.bezierCurveTo(
                control1[0] - element.x + offset,
                control1[1] - element.y + offset,
                control2[0] - element.x + offset,
                control2[1] - element.y + offset,
                end[0] - element.x + offset,
                end[1] - element.y + offset,
              );
              context.stroke();
            });
          }

          break;
      }

      context.restore();

      break;
  }

  // Middle indicator is not rendered after it expired
  if (!countdownInProgress || (state?.runtime ?? 0) > BIND_MODE_TIMEOUT) {
    return;
  }

  const radius = 0.5 * (Math.min(element.width, element.height) / 2);

  // Draw center snap area
  if (!isFrameLikeElement(element)) {
    context.save();
    context.translate(
      element.x + appState.scrollX,
      element.y + appState.scrollY,
    );

    const PROGRESS_RATIO = (1 / BIND_MODE_TIMEOUT) * remainingTime;

    context.strokeStyle = "rgba(0, 0, 0, 0.2)";
    context.lineWidth = 1 / appState.zoom.value;
    context.setLineDash([4 / appState.zoom.value, 4 / appState.zoom.value]);
    context.lineDashOffset = (-PROGRESS_RATIO * 10) / appState.zoom.value;

    context.beginPath();
    context.ellipse(
      element.width / 2,
      element.height / 2,
      radius,
      radius,
      0,
      0,
      2 * Math.PI,
    );
    context.stroke();

    // context.strokeStyle = "transparent";
    context.fillStyle = "rgba(0, 0, 0, 0.04)";
    context.beginPath();
    context.ellipse(
      element.width / 2,
      element.height / 2,
      radius * (1 - opacity),
      radius * (1 - opacity),
      0,
      0,
      2 * Math.PI,
    );

    context.fill();

    context.restore();
  }

  return {
    runtime: (state?.runtime ?? 0) + deltaTime,
  };
};

const renderBindingHighlightForBindableElement = (
  app: AppClassProperties,
  context: CanvasRenderingContext2D,
  element: ExcalidrawBindableElement,
  allElementsMap: NonDeletedSceneElementsMap,
  appState: InteractiveCanvasAppState,
  deltaTime: number,
  state?: { runtime: number },
) => {
  if (getFeatureFlag("COMPLEX_BINDINGS")) {
    return renderBindingHighlightForBindableElement_complex(
      app,
      context,
      element,
      allElementsMap,
      appState,
      deltaTime,
      state,
    );
  }

  context.save();
  context.translate(appState.scrollX, appState.scrollY);
  renderBindingHighlightForBindableElement_simple(
    context,
    element,
    allElementsMap,
    appState,
  );
  context.restore();
};

type ElementSelectionBorder = {
  angle: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  selectionColors: string[];
  dashed?: boolean;
  cx: number;
  cy: number;
  activeEmbeddable: boolean;
  padding?: number;
};

const renderSelectionBorder = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
  elementProperties: ElementSelectionBorder,
) => {
  const {
    angle,
    x1,
    y1,
    x2,
    y2,
    selectionColors,
    cx,
    cy,
    dashed,
    activeEmbeddable,
  } = elementProperties;
  const elementWidth = x2 - x1;
  const elementHeight = y2 - y1;

  const padding =
    elementProperties.padding ?? DEFAULT_TRANSFORM_HANDLE_SPACING * 2;

  const linePadding = padding / appState.zoom.value;
  const lineWidth = 8 / appState.zoom.value;
  const spaceWidth = 4 / appState.zoom.value;

  context.save();
  context.translate(appState.scrollX, appState.scrollY);
  context.lineWidth = (activeEmbeddable ? 4 : 1) / appState.zoom.value;

  const count = selectionColors.length;
  for (let index = 0; index < count; ++index) {
    context.strokeStyle = selectionColors[index];
    if (dashed) {
      context.setLineDash([
        lineWidth,
        spaceWidth + (lineWidth + spaceWidth) * (count - 1),
      ]);
    }
    context.lineDashOffset = (lineWidth + spaceWidth) * index;
    strokeRectWithRotation_simple(
      context,
      x1 - linePadding,
      y1 - linePadding,
      elementWidth + linePadding * 2,
      elementHeight + linePadding * 2,
      cx,
      cy,
      angle,
    );
  }
  context.restore();
};

const renderFrameHighlight = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
  frame: NonDeleted<ExcalidrawFrameLikeElement>,
  elementsMap: ElementsMap,
) => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(frame, elementsMap);
  const width = x2 - x1;
  const height = y2 - y1;

  context.strokeStyle = "rgb(0,118,255)";
  context.lineWidth = FRAME_STYLE.strokeWidth / appState.zoom.value;

  context.save();
  context.translate(appState.scrollX, appState.scrollY);
  strokeRectWithRotation_simple(
    context,
    x1,
    y1,
    width,
    height,
    x1 + width / 2,
    y1 + height / 2,
    frame.angle,
    false,
    FRAME_STYLE.radius / appState.zoom.value,
  );
  context.restore();
};

const renderElementsBoxHighlight = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
  elements: NonDeleted<ExcalidrawElement>[],
  config?: { colors?: string[]; dashed?: boolean },
) => {
  const { colors = ["rgb(0,118,255)"], dashed = false } = config || {};
  const individualElements = elements.filter(
    (element) => element.groupIds.length === 0,
  );

  const elementsInGroups = elements.filter(
    (element) => element.groupIds.length > 0,
  );

  const getSelectionFromElements = (elements: ExcalidrawElement[]) => {
    const [x1, y1, x2, y2] = getCommonBounds(elements);
    return {
      angle: 0,
      x1,
      x2,
      y1,
      y2,
      selectionColors: colors,
      dashed,
      cx: x1 + (x2 - x1) / 2,
      cy: y1 + (y2 - y1) / 2,
      activeEmbeddable: false,
    };
  };

  const getSelectionForGroupId = (groupId: GroupId) => {
    const groupElements = getElementsInGroup(elements, groupId);
    return getSelectionFromElements(groupElements);
  };

  Object.entries(selectGroupsFromGivenElements(elementsInGroups, appState))
    .filter(([id, isSelected]) => isSelected)
    .map(([id, isSelected]) => id)
    .map((groupId) => getSelectionForGroupId(groupId))
    .concat(
      individualElements.map((element) => getSelectionFromElements([element])),
    )
    .forEach((selection) =>
      renderSelectionBorder(context, appState, selection),
    );
};

const renderLinearPointHandles = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
  element: NonDeleted<ExcalidrawLinearElement>,
  elementsMap: RenderableElementsMap,
) => {
  if (!appState.selectedLinearElement) {
    return;
  }
  context.save();
  context.translate(appState.scrollX, appState.scrollY);
  context.lineWidth = 1 / appState.zoom.value;
  const points: GlobalPoint[] = LinearElementEditor.getPointsGlobalCoordinates(
    element,
    elementsMap,
  );

  const { POINT_HANDLE_SIZE } = LinearElementEditor;
  const radius = appState.selectedLinearElement?.isEditing
    ? POINT_HANDLE_SIZE
    : POINT_HANDLE_SIZE / 2;

  const _isElbowArrow = isElbowArrow(element);
  const _isLineElement = isLineElement(element);

  points.forEach((point, idx) => {
    if (_isElbowArrow && idx !== 0 && idx !== points.length - 1) {
      return;
    }

    const isOverlappingPoint =
      idx > 0 &&
      (idx !== points.length - 1 || !_isLineElement || !element.polygon) &&
      pointsEqual(
        point,
        idx === points.length - 1 ? points[0] : points[idx - 1],
        2 / appState.zoom.value,
      );

    let isSelected =
      !!appState.selectedLinearElement?.isEditing &&
      !!appState.selectedLinearElement?.selectedPointsIndices?.includes(idx);
    // when element is a polygon, highlight the last point as well if first
    // point is selected since they overlap and the last point tends to be
    // rendered on top
    if (
      _isLineElement &&
      element.polygon &&
      !isSelected &&
      idx === element.points.length - 1 &&
      !!appState.selectedLinearElement?.isEditing &&
      !!appState.selectedLinearElement?.selectedPointsIndices?.includes(0)
    ) {
      isSelected = true;
    }

    renderSingleLinearPoint(
      context,
      appState,
      point,
      radius,
      isSelected,
      false,
      isOverlappingPoint,
    );
  });

  // Rendering segment mid points
  if (isElbowArrow(element)) {
    const fixedSegments =
      element.fixedSegments?.map((segment) => segment.index) || [];
    points.slice(0, -1).forEach((p, idx) => {
      if (
        !LinearElementEditor.isSegmentTooShort(
          element,
          points[idx + 1],
          points[idx],
          idx,
          appState.zoom,
        )
      ) {
        renderSingleLinearPoint(
          context,
          appState,
          pointFrom<GlobalPoint>(
            (p[0] + points[idx + 1][0]) / 2,
            (p[1] + points[idx + 1][1]) / 2,
          ),
          POINT_HANDLE_SIZE / 2,
          false,
          !fixedSegments.includes(idx + 1),
          false,
        );
      }
    });
  } else {
    const midPoints = LinearElementEditor.getEditorMidPoints(
      element,
      elementsMap,
      appState,
    ).filter(
      (midPoint, idx, midPoints): midPoint is GlobalPoint =>
        midPoint !== null &&
        !(isElbowArrow(element) && (idx === 0 || idx === midPoints.length - 1)),
    );

    midPoints.forEach((segmentMidPoint) => {
      if (appState.selectedLinearElement?.isEditing || points.length === 2) {
        renderSingleLinearPoint(
          context,
          appState,
          segmentMidPoint,
          POINT_HANDLE_SIZE / 2,
          false,
          true,
          false,
        );
      }
    });
  }

  context.restore();
};

const renderTransformHandles = (
  context: CanvasRenderingContext2D,
  renderConfig: InteractiveCanvasRenderConfig,
  appState: InteractiveCanvasAppState,
  transformHandles: TransformHandles,
  angle: number,
): void => {
  Object.keys(transformHandles).forEach((key) => {
    const transformHandle = transformHandles[key as TransformHandleType];
    if (transformHandle !== undefined) {
      const [x, y, width, height] = transformHandle;

      context.save();
      context.lineWidth = 1 / appState.zoom.value;
      if (renderConfig.selectionColor) {
        context.strokeStyle = renderConfig.selectionColor;
      }
      if (key === "rotation") {
        fillCircle(context, x + width / 2, y + height / 2, width / 2, true);
        // prefer round corners if roundRect API is available
      } else if (context.roundRect) {
        context.beginPath();
        context.roundRect(x, y, width, height, 2 / appState.zoom.value);
        context.fill();
        context.stroke();
      } else {
        strokeRectWithRotation_simple(
          context,
          x,
          y,
          width,
          height,
          x + width / 2,
          y + height / 2,
          angle,
          true, // fill before stroke
        );
      }
      context.restore();
    }
  });
};

const renderCropHandles = (
  context: CanvasRenderingContext2D,
  renderConfig: InteractiveCanvasRenderConfig,
  appState: InteractiveCanvasAppState,
  croppingElement: ExcalidrawImageElement,
  elementsMap: ElementsMap,
): void => {
  const [x1, y1, , , cx, cy] = getElementAbsoluteCoords(
    croppingElement,
    elementsMap,
  );

  const LINE_WIDTH = 3;
  const LINE_LENGTH = 20;

  const ZOOMED_LINE_WIDTH = LINE_WIDTH / appState.zoom.value;
  const ZOOMED_HALF_LINE_WIDTH = ZOOMED_LINE_WIDTH / 2;

  const HALF_WIDTH = cx - x1 + ZOOMED_LINE_WIDTH;
  const HALF_HEIGHT = cy - y1 + ZOOMED_LINE_WIDTH;

  const HORIZONTAL_LINE_LENGTH = Math.min(
    LINE_LENGTH / appState.zoom.value,
    HALF_WIDTH,
  );
  const VERTICAL_LINE_LENGTH = Math.min(
    LINE_LENGTH / appState.zoom.value,
    HALF_HEIGHT,
  );

  context.save();
  context.fillStyle = renderConfig.selectionColor;
  context.strokeStyle = renderConfig.selectionColor;
  context.lineWidth = ZOOMED_LINE_WIDTH;

  const handles: Array<
    [
      [number, number],
      [number, number],
      [number, number],
      [number, number],
      [number, number],
    ]
  > = [
    [
      // x, y
      [-HALF_WIDTH, -HALF_HEIGHT],
      // horizontal line: first start and to
      [0, ZOOMED_HALF_LINE_WIDTH],
      [HORIZONTAL_LINE_LENGTH, ZOOMED_HALF_LINE_WIDTH],
      // vertical line: second  start and to
      [ZOOMED_HALF_LINE_WIDTH, 0],
      [ZOOMED_HALF_LINE_WIDTH, VERTICAL_LINE_LENGTH],
    ],
    [
      [HALF_WIDTH - ZOOMED_HALF_LINE_WIDTH, -HALF_HEIGHT],
      [ZOOMED_HALF_LINE_WIDTH, ZOOMED_HALF_LINE_WIDTH],
      [
        -HORIZONTAL_LINE_LENGTH + ZOOMED_HALF_LINE_WIDTH,
        ZOOMED_HALF_LINE_WIDTH,
      ],
      [0, 0],
      [0, VERTICAL_LINE_LENGTH],
    ],
    [
      [-HALF_WIDTH, HALF_HEIGHT],
      [0, -ZOOMED_HALF_LINE_WIDTH],
      [HORIZONTAL_LINE_LENGTH, -ZOOMED_HALF_LINE_WIDTH],
      [ZOOMED_HALF_LINE_WIDTH, 0],
      [ZOOMED_HALF_LINE_WIDTH, -VERTICAL_LINE_LENGTH],
    ],
    [
      [HALF_WIDTH - ZOOMED_HALF_LINE_WIDTH, HALF_HEIGHT],
      [ZOOMED_HALF_LINE_WIDTH, -ZOOMED_HALF_LINE_WIDTH],
      [
        -HORIZONTAL_LINE_LENGTH + ZOOMED_HALF_LINE_WIDTH,
        -ZOOMED_HALF_LINE_WIDTH,
      ],
      [0, 0],
      [0, -VERTICAL_LINE_LENGTH],
    ],
  ];

  handles.forEach((handle) => {
    const [[x, y], [x1s, y1s], [x1t, y1t], [x2s, y2s], [x2t, y2t]] = handle;

    context.save();
    context.translate(cx, cy);
    context.rotate(croppingElement.angle);

    context.beginPath();
    context.moveTo(x + x1s, y + y1s);
    context.lineTo(x + x1t, y + y1t);
    context.stroke();

    context.beginPath();
    context.moveTo(x + x2s, y + y2s);
    context.lineTo(x + x2t, y + y2t);
    context.stroke();
    context.restore();
  });

  context.restore();
};

const renderTextBox = (
  text: NonDeleted<ExcalidrawTextElement>,
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
  selectionColor: InteractiveCanvasRenderConfig["selectionColor"],
) => {
  context.save();
  const padding = (DEFAULT_TRANSFORM_HANDLE_SPACING * 2) / appState.zoom.value;
  const width = text.width + padding * 2;
  const height = text.height + padding * 2;
  const cx = text.x + width / 2;
  const cy = text.y + height / 2;
  const shiftX = -(width / 2 + padding);
  const shiftY = -(height / 2 + padding);
  context.translate(cx + appState.scrollX, cy + appState.scrollY);
  context.rotate(text.angle);
  context.lineWidth = 1 / appState.zoom.value;
  context.strokeStyle = selectionColor;
  context.strokeRect(shiftX, shiftY, width, height);
  context.restore();
};

const _renderInteractiveScene = ({
  app,
  canvas,
  elementsMap,
  visibleElements,
  selectedElements,
  allElementsMap,
  scale,
  appState,
  renderConfig,
  editorInterface,
  animationState,
  deltaTime,
}: InteractiveSceneRenderConfig): {
  scrollBars?: ReturnType<typeof getScrollBars>;
  atLeastOneVisibleElement: boolean;
  elementsMap: RenderableElementsMap;
  animationState?: typeof animationState;
} => {
  if (canvas === null) {
    return { atLeastOneVisibleElement: false, elementsMap };
  }

  const [normalizedWidth, normalizedHeight] = getNormalizedCanvasDimensions(
    canvas,
    scale,
  );
  let nextAnimationState = animationState;

  const context = bootstrapCanvas({
    canvas,
    scale,
    normalizedWidth,
    normalizedHeight,
  });

  // Apply zoom
  context.save();
  context.scale(appState.zoom.value, appState.zoom.value);

  let editingLinearElement: NonDeleted<ExcalidrawLinearElement> | undefined =
    undefined;

  visibleElements.forEach((element) => {
    // Getting the element using LinearElementEditor during collab mismatches version - being one head of visible elements due to
    // ShapeCache returns empty hence making sure that we get the
    // correct element from visible elements
    if (
      appState.selectedLinearElement?.isEditing &&
      appState.selectedLinearElement.elementId === element.id
    ) {
      if (element) {
        editingLinearElement = element as NonDeleted<ExcalidrawLinearElement>;
      }
    }
  });

  if (editingLinearElement) {
    renderLinearPointHandles(
      context,
      appState,
      editingLinearElement,
      elementsMap,
    );
  }

  // Paint selection element
  if (appState.selectionElement && !appState.isCropping) {
    try {
      renderSelectionElement(
        appState.selectionElement,
        context,
        appState,
        renderConfig.selectionColor,
      );
    } catch (error: any) {
      console.error(error);
    }
  }

  if (
    appState.editingTextElement &&
    isTextElement(appState.editingTextElement)
  ) {
    const textElement = allElementsMap.get(appState.editingTextElement.id) as
      | ExcalidrawTextElement
      | undefined;
    if (textElement && !textElement.autoResize) {
      renderTextBox(
        textElement,
        context,
        appState,
        renderConfig.selectionColor,
      );
    }
  }

  if (appState.isBindingEnabled && appState.suggestedBinding) {
    nextAnimationState = {
      ...animationState,
      bindingHighlight: renderBindingHighlightForBindableElement(
        app,
        context,
        appState.suggestedBinding,
        allElementsMap,
        appState,
        deltaTime,
        animationState?.bindingHighlight,
      ),
    };
  } else {
    nextAnimationState = {
      ...animationState,
      bindingHighlight: undefined,
    };
  }

  if (appState.frameToHighlight) {
    renderFrameHighlight(
      context,
      appState,
      appState.frameToHighlight,
      elementsMap,
    );
  }

  if (appState.elementsToHighlight) {
    renderElementsBoxHighlight(context, appState, appState.elementsToHighlight);
  }

  if (appState.activeLockedId) {
    const element = allElementsMap.get(appState.activeLockedId);
    const elements = element
      ? [element]
      : getElementsInGroup(allElementsMap, appState.activeLockedId);
    renderElementsBoxHighlight(context, appState, elements, {
      colors: ["#ced4da"],
      dashed: true,
    });
  }

  const isFrameSelected = selectedElements.some((element) =>
    isFrameLikeElement(element),
  );

  // Getting the element using LinearElementEditor during collab mismatches version - being one head of visible elements due to
  // ShapeCache returns empty hence making sure that we get the
  // correct element from visible elements
  if (
    selectedElements.length === 1 &&
    appState.selectedLinearElement?.isEditing &&
    appState.selectedLinearElement.elementId === selectedElements[0].id
  ) {
    renderLinearPointHandles(
      context,
      appState,
      selectedElements[0] as NonDeleted<ExcalidrawLinearElement>,
      elementsMap,
    );
  }

  // Arrows have a different highlight behavior when
  // they are the only selected element
  if (appState.selectedLinearElement) {
    const editor = appState.selectedLinearElement;
    const firstSelectedLinear = selectedElements.find(
      (el) => el.id === editor.elementId, // Don't forget bound text elements!
    );

    if (!appState.selectedLinearElement.isDragging) {
      if (editor.segmentMidPointHoveredCoords) {
        renderElbowArrowMidPointHighlight(context, appState);
      } else if (
        isElbowArrow(firstSelectedLinear)
          ? editor.hoverPointIndex === 0 ||
            editor.hoverPointIndex === firstSelectedLinear.points.length - 1
          : editor.hoverPointIndex >= 0
      ) {
        renderLinearElementPointHighlight(context, appState, elementsMap);
      }
    }
  }

  // Paint selected elements
  if (
    !appState.multiElement &&
    !appState.newElement &&
    !appState.selectedLinearElement?.isEditing
  ) {
    const showBoundingBox = hasBoundingBox(
      selectedElements,
      appState,
      editorInterface,
    );

    const isSingleLinearElementSelected =
      selectedElements.length === 1 && isLinearElement(selectedElements[0]);
    // render selected linear element points
    if (
      isSingleLinearElementSelected &&
      appState.selectedLinearElement?.elementId === selectedElements[0].id &&
      !selectedElements[0].locked
    ) {
      renderLinearPointHandles(
        context,
        appState,
        selectedElements[0] as ExcalidrawLinearElement,
        elementsMap,
      );
    }
    const selectionColor = renderConfig.selectionColor || oc.black;

    if (showBoundingBox) {
      // Optimisation for finding quickly relevant element ids
      const locallySelectedIds = arrayToMap(selectedElements);

      const selections: ElementSelectionBorder[] = [];

      for (const element of elementsMap.values()) {
        const selectionColors = [];
        const remoteClients = renderConfig.remoteSelectedElementIds.get(
          element.id,
        );
        if (
          !(
            // Elbow arrow elements cannot be selected when bound on either end
            (
              isSingleLinearElementSelected &&
              isElbowArrow(element) &&
              (element.startBinding || element.endBinding)
            )
          )
        ) {
          // local user
          if (
            locallySelectedIds.has(element.id) &&
            !isSelectedViaGroup(appState, element)
          ) {
            selectionColors.push(selectionColor);
          }
          // remote users
          if (remoteClients) {
            selectionColors.push(
              ...remoteClients.map((socketId) => {
                const background = getClientColor(
                  socketId,
                  appState.collaborators.get(socketId),
                );
                return background;
              }),
            );
          }
        }

        if (selectionColors.length) {
          const [x1, y1, x2, y2, cx, cy] = getElementAbsoluteCoords(
            element,
            elementsMap,
            true,
          );
          selections.push({
            angle: element.angle,
            x1,
            y1,
            x2,
            y2,
            selectionColors: element.locked ? ["#ced4da"] : selectionColors,
            dashed: !!remoteClients || element.locked,
            cx,
            cy,
            activeEmbeddable:
              appState.activeEmbeddable?.element === element &&
              appState.activeEmbeddable.state === "active",
            padding:
              element.id === appState.croppingElementId ||
              isImageElement(element)
                ? 0
                : undefined,
          });
        }
      }

      const addSelectionForGroupId = (groupId: GroupId) => {
        const groupElements = getElementsInGroup(elementsMap, groupId);
        const [x1, y1, x2, y2] = getCommonBounds(groupElements);
        selections.push({
          angle: 0,
          x1,
          x2,
          y1,
          y2,
          selectionColors: groupElements.some((el) => el.locked)
            ? ["#ced4da"]
            : [oc.black],
          dashed: true,
          cx: x1 + (x2 - x1) / 2,
          cy: y1 + (y2 - y1) / 2,
          activeEmbeddable: false,
        });
      };

      for (const groupId of getSelectedGroupIds(appState)) {
        // TODO: support multiplayer selected group IDs
        addSelectionForGroupId(groupId);
      }

      if (appState.editingGroupId) {
        addSelectionForGroupId(appState.editingGroupId);
      }

      selections.forEach((selection) =>
        renderSelectionBorder(context, appState, selection),
      );
    }
    // Paint resize transformHandles
    context.save();
    context.translate(appState.scrollX, appState.scrollY);

    if (selectedElements.length === 1) {
      context.fillStyle = oc.white;
      const transformHandles = getTransformHandles(
        selectedElements[0],
        appState.zoom,
        elementsMap,
        "mouse", // when we render we don't know which pointer type so use mouse,
        getOmitSidesForEditorInterface(editorInterface),
      );
      if (
        !appState.viewModeEnabled &&
        showBoundingBox &&
        // do not show transform handles when text is being edited
        !isTextElement(appState.editingTextElement) &&
        // do not show transform handles when image is being cropped
        !appState.croppingElementId
      ) {
        renderTransformHandles(
          context,
          renderConfig,
          appState,
          transformHandles,
          selectedElements[0].angle,
        );
      }

      if (appState.croppingElementId && !appState.isCropping) {
        const croppingElement = elementsMap.get(appState.croppingElementId);

        if (croppingElement && isImageElement(croppingElement)) {
          renderCropHandles(
            context,
            renderConfig,
            appState,
            croppingElement,
            elementsMap,
          );
        }
      }
    } else if (
      selectedElements.length > 1 &&
      !appState.isRotating &&
      !selectedElements.some((el) => el.locked)
    ) {
      const dashedLinePadding =
        (DEFAULT_TRANSFORM_HANDLE_SPACING * 2) / appState.zoom.value;
      context.fillStyle = oc.white;
      const [x1, y1, x2, y2] = getCommonBounds(selectedElements, elementsMap);
      const initialLineDash = context.getLineDash();
      context.setLineDash([2 / appState.zoom.value]);
      const lineWidth = context.lineWidth;
      context.lineWidth = 1 / appState.zoom.value;
      context.strokeStyle = selectionColor;
      strokeRectWithRotation_simple(
        context,
        x1 - dashedLinePadding,
        y1 - dashedLinePadding,
        x2 - x1 + dashedLinePadding * 2,
        y2 - y1 + dashedLinePadding * 2,
        (x1 + x2) / 2,
        (y1 + y2) / 2,
        0,
      );
      context.lineWidth = lineWidth;
      context.setLineDash(initialLineDash);
      const transformHandles = getTransformHandlesFromCoords(
        [x1, y1, x2, y2, (x1 + x2) / 2, (y1 + y2) / 2],
        0 as Radians,
        appState.zoom,
        "mouse",
        isFrameSelected
          ? {
              ...getOmitSidesForEditorInterface(editorInterface),
              rotation: true,
            }
          : getOmitSidesForEditorInterface(editorInterface),
      );
      if (selectedElements.some((element) => !element.locked)) {
        renderTransformHandles(
          context,
          renderConfig,
          appState,
          transformHandles,
          0,
        );
      }
    }
    context.restore();
  }

  appState.searchMatches?.matches.forEach(({ id, focus, matchedLines }) => {
    const element = elementsMap.get(id);

    if (element) {
      const [elementX1, elementY1, , , cx, cy] = getElementAbsoluteCoords(
        element,
        elementsMap,
        true,
      );

      context.save();
      if (appState.theme === THEME.LIGHT) {
        if (focus) {
          context.fillStyle = "rgba(255, 124, 0, 0.4)";
        } else {
          context.fillStyle = "rgba(255, 226, 0, 0.4)";
        }
      } else if (focus) {
        context.fillStyle = "rgba(229, 82, 0, 0.4)";
      } else {
        context.fillStyle = "rgba(99, 52, 0, 0.4)";
      }

      const zoomFactor = isFrameLikeElement(element) ? appState.zoom.value : 1;

      context.translate(appState.scrollX, appState.scrollY);
      context.translate(cx, cy);
      context.rotate(element.angle);

      matchedLines.forEach((matchedLine) => {
        (matchedLine.showOnCanvas || focus) &&
          context.fillRect(
            elementX1 + matchedLine.offsetX / zoomFactor - cx,
            elementY1 + matchedLine.offsetY / zoomFactor - cy,
            matchedLine.width / zoomFactor,
            matchedLine.height / zoomFactor,
          );
      });

      context.restore();
    }
  });

  renderSnaps(context, appState);

  // Technical drawing mode: render segment lengths and angle measurements
  renderTechnicalDrawingHints(context, appState);

  context.restore();

  renderRemoteCursors({
    context,
    renderConfig,
    appState,
    normalizedWidth,
    normalizedHeight,
  });

  // Paint scrollbars
  let scrollBars;
  if (renderConfig.renderScrollbars) {
    scrollBars = getScrollBars(
      elementsMap,
      normalizedWidth,
      normalizedHeight,
      appState,
    );

    context.save();
    context.fillStyle = SCROLLBAR_COLOR;
    context.strokeStyle = "rgba(255,255,255,0.8)";
    [scrollBars.horizontal, scrollBars.vertical].forEach((scrollBar) => {
      if (scrollBar) {
        roundRect(
          context,
          scrollBar.x,
          scrollBar.y,
          scrollBar.width,
          scrollBar.height,
          SCROLLBAR_WIDTH / 2,
        );
      }
    });
    context.restore();
  }

  return {
    scrollBars,
    atLeastOneVisibleElement: visibleElements.length > 0,
    elementsMap,
    animationState: nextAnimationState,
  };
};

/**
 * Interactive scene is the ui-canvas where we render bounding boxes, selections
 * and other ui stuff.
 */
export const renderInteractiveScene = <
  U extends typeof _renderInteractiveScene,
>(
  renderConfig: InteractiveSceneRenderConfig,
): ReturnType<U> => {
  const ret = _renderInteractiveScene(renderConfig);
  renderConfig.callback(ret);
  return ret as ReturnType<U>;
};
