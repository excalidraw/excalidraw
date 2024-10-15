import {
  getElementAbsoluteCoords,
  getTransformHandlesFromCoords,
  getTransformHandles,
  getCommonBounds,
} from "../element";

import { roundRect } from "../renderer/roundRect";

import {
  getScrollBars,
  SCROLLBAR_COLOR,
  SCROLLBAR_WIDTH,
} from "../scene/scrollbars";

import { renderSelectionElement } from "../renderer/renderElement";
import { getClientColor, renderRemoteCursors } from "../clients";
import {
  isSelectedViaGroup,
  getSelectedGroupIds,
  getElementsInGroup,
  selectGroupsFromGivenElements,
} from "../groups";
import type {
  TransformHandles,
  TransformHandleType,
} from "../element/transformHandles";
import {
  getOmitSidesForDevice,
  shouldShowBoundingBox,
} from "../element/transformHandles";
import { arrayToMap, throttleRAF } from "../utils";
import {
  DEFAULT_TRANSFORM_HANDLE_SPACING,
  FRAME_STYLE,
  THEME,
} from "../constants";
import { type InteractiveCanvasAppState } from "../types";

import { renderSnaps } from "../renderer/renderSnaps";

import type {
  SuggestedBinding,
  SuggestedPointBinding,
} from "../element/binding";
import { maxBindingGap } from "../element/binding";
import { LinearElementEditor } from "../element/linearElementEditor";
import {
  bootstrapCanvas,
  fillCircle,
  getNormalizedCanvasDimensions,
} from "./helpers";
import oc from "open-color";
import {
  isElbowArrow,
  isFrameLikeElement,
  isImageElement,
  isLinearElement,
  isTextElement,
} from "../element/typeChecks";
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
} from "../element/types";
import type {
  InteractiveCanvasRenderConfig,
  InteractiveSceneRenderConfig,
  RenderableElementsMap,
} from "../scene/types";
import type { GlobalPoint, LocalPoint, Radians } from "../../math";
import { getCornerRadius } from "../shapes";

const renderLinearElementPointHighlight = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
  elementsMap: ElementsMap,
) => {
  const { elementId, hoverPointIndex } = appState.selectedLinearElement!;
  if (
    appState.editingLinearElement?.selectedPointsIndices?.includes(
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

const strokeRectWithRotation = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  cx: number,
  cy: number,
  angle: number,
  fill: boolean = false,
  /** should account for zoom */
  radius: number = 0,
) => {
  context.save();
  context.translate(cx, cy);
  context.rotate(angle);
  if (fill) {
    context.fillRect(x - cx, y - cy, width, height);
  }
  if (radius && context.roundRect) {
    context.beginPath();
    context.roundRect(x - cx, y - cy, width, height, radius);
    context.stroke();
    context.closePath();
  } else {
    context.strokeRect(x - cx, y - cy, width, height);
  }
  context.restore();
};

const strokeDiamondWithRotation = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  cx: number,
  cy: number,
  angle: number,
) => {
  context.save();
  context.translate(cx, cy);
  context.rotate(angle);
  context.beginPath();
  context.moveTo(0, height / 2);
  context.lineTo(width / 2, 0);
  context.lineTo(0, -height / 2);
  context.lineTo(-width / 2, 0);
  context.closePath();
  context.stroke();
  context.restore();
};

const renderSingleLinearPoint = <Point extends GlobalPoint | LocalPoint>(
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
  point: Point,
  radius: number,
  isSelected: boolean,
  isPhantomPoint = false,
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
    radius / appState.zoom.value,
    !isPhantomPoint,
  );
};

const strokeEllipseWithRotation = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  cx: number,
  cy: number,
  angle: number,
) => {
  context.beginPath();
  context.ellipse(cx, cy, width / 2, height / 2, angle, 0, Math.PI * 2);
  context.stroke();
};

const renderBindingHighlightForBindableElement = (
  context: CanvasRenderingContext2D,
  element: ExcalidrawBindableElement,
  elementsMap: ElementsMap,
) => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);
  const width = x2 - x1;
  const height = y2 - y1;
  const thickness = 10;

  // So that we don't overlap the element itself
  const strokeOffset = 4;
  context.strokeStyle = "rgba(0,0,0,.05)";
  context.lineWidth = thickness - strokeOffset;
  const padding = strokeOffset / 2 + thickness / 2;

  const radius = getCornerRadius(
    Math.min(element.width, element.height),
    element,
  );

  switch (element.type) {
    case "rectangle":
    case "text":
    case "image":
    case "iframe":
    case "embeddable":
    case "frame":
    case "magicframe":
      strokeRectWithRotation(
        context,
        x1 - padding,
        y1 - padding,
        width + padding * 2,
        height + padding * 2,
        x1 + width / 2,
        y1 + height / 2,
        element.angle,
        undefined,
        radius,
      );
      break;
    case "diamond":
      const side = Math.hypot(width, height);
      const wPadding = (padding * side) / height;
      const hPadding = (padding * side) / width;
      strokeDiamondWithRotation(
        context,
        width + wPadding * 2,
        height + hPadding * 2,
        x1 + width / 2,
        y1 + height / 2,
        element.angle,
      );
      break;
    case "ellipse":
      strokeEllipseWithRotation(
        context,
        width + padding * 2,
        height + padding * 2,
        x1 + width / 2,
        y1 + height / 2,
        element.angle,
      );
      break;
  }
};

const renderBindingHighlightForSuggestedPointBinding = (
  context: CanvasRenderingContext2D,
  suggestedBinding: SuggestedPointBinding,
  elementsMap: ElementsMap,
) => {
  const [element, startOrEnd, bindableElement] = suggestedBinding;

  const threshold = maxBindingGap(
    bindableElement,
    bindableElement.width,
    bindableElement.height,
  );

  context.strokeStyle = "rgba(0,0,0,0)";
  context.fillStyle = "rgba(0,0,0,.05)";

  const pointIndices =
    startOrEnd === "both" ? [0, -1] : startOrEnd === "start" ? [0] : [-1];
  pointIndices.forEach((index) => {
    const [x, y] = LinearElementEditor.getPointAtIndexGlobalCoordinates(
      element,
      index,
      elementsMap,
    );
    fillCircle(context, x, y, threshold);
  });
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
    strokeRectWithRotation(
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

const renderBindingHighlight = (
  context: CanvasRenderingContext2D,
  appState: InteractiveCanvasAppState,
  suggestedBinding: SuggestedBinding,
  elementsMap: ElementsMap,
) => {
  const renderHighlight = Array.isArray(suggestedBinding)
    ? renderBindingHighlightForSuggestedPointBinding
    : renderBindingHighlightForBindableElement;

  context.save();
  context.translate(appState.scrollX, appState.scrollY);
  renderHighlight(context, suggestedBinding as any, elementsMap);

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
  strokeRectWithRotation(
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
) => {
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
      selectionColors: ["rgb(0,118,255)"],
      dashed: false,
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
  const points = LinearElementEditor.getPointsGlobalCoordinates(
    element,
    elementsMap,
  );

  const { POINT_HANDLE_SIZE } = LinearElementEditor;
  const radius = appState.editingLinearElement
    ? POINT_HANDLE_SIZE
    : POINT_HANDLE_SIZE / 2;
  points.forEach((point, idx) => {
    if (isElbowArrow(element) && idx !== 0 && idx !== points.length - 1) {
      return;
    }

    const isSelected =
      !!appState.editingLinearElement?.selectedPointsIndices?.includes(idx);

    renderSingleLinearPoint(context, appState, point, radius, isSelected);
  });

  //Rendering segment mid points
  const midPoints = LinearElementEditor.getEditorMidPoints(
    element,
    elementsMap,
    appState,
  ).filter((midPoint): midPoint is GlobalPoint => midPoint !== null);

  midPoints.forEach((segmentMidPoint) => {
    if (
      appState?.selectedLinearElement?.segmentMidPointHoveredCoords &&
      LinearElementEditor.arePointsEqual(
        segmentMidPoint,
        appState.selectedLinearElement.segmentMidPointHoveredCoords,
      )
    ) {
      // The order of renderingSingleLinearPoint and highLight points is different
      // inside vs outside editor as hover states are different,
      // in editor when hovered the original point is not visible as hover state fully covers it whereas outside the
      // editor original point is visible and hover state is just an outer circle.
      if (appState.editingLinearElement) {
        renderSingleLinearPoint(
          context,
          appState,
          segmentMidPoint,
          radius,
          false,
        );
        highlightPoint(segmentMidPoint, context, appState);
      } else {
        highlightPoint(segmentMidPoint, context, appState);
        renderSingleLinearPoint(
          context,
          appState,
          segmentMidPoint,
          radius,
          false,
        );
      }
    } else if (appState.editingLinearElement || points.length === 2) {
      renderSingleLinearPoint(
        context,
        appState,
        segmentMidPoint,
        POINT_HANDLE_SIZE / 2,
        false,
        true,
      );
    }
  });

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
        fillCircle(context, x + width / 2, y + height / 2, width / 2);
        // prefer round corners if roundRect API is available
      } else if (context.roundRect) {
        context.beginPath();
        context.roundRect(x, y, width, height, 2 / appState.zoom.value);
        context.fill();
        context.stroke();
      } else {
        strokeRectWithRotation(
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
  canvas,
  elementsMap,
  visibleElements,
  selectedElements,
  allElementsMap,
  scale,
  appState,
  renderConfig,
  device,
}: InteractiveSceneRenderConfig) => {
  if (canvas === null) {
    return { atLeastOneVisibleElement: false, elementsMap };
  }

  const [normalizedWidth, normalizedHeight] = getNormalizedCanvasDimensions(
    canvas,
    scale,
  );

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
    if (appState.editingLinearElement?.elementId === element.id) {
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

  if (appState.isBindingEnabled) {
    appState.suggestedBindings
      .filter((binding) => binding != null)
      .forEach((suggestedBinding) => {
        renderBindingHighlight(
          context,
          appState,
          suggestedBinding!,
          elementsMap,
        );
      });
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

  const isFrameSelected = selectedElements.some((element) =>
    isFrameLikeElement(element),
  );

  // Getting the element using LinearElementEditor during collab mismatches version - being one head of visible elements due to
  // ShapeCache returns empty hence making sure that we get the
  // correct element from visible elements
  if (
    selectedElements.length === 1 &&
    appState.editingLinearElement?.elementId === selectedElements[0].id
  ) {
    renderLinearPointHandles(
      context,
      appState,
      selectedElements[0] as NonDeleted<ExcalidrawLinearElement>,
      elementsMap,
    );
  }

  if (
    appState.selectedLinearElement &&
    appState.selectedLinearElement.hoverPointIndex >= 0 &&
    !(
      isElbowArrow(selectedElements[0]) &&
      appState.selectedLinearElement.hoverPointIndex > 0 &&
      appState.selectedLinearElement.hoverPointIndex <
        selectedElements[0].points.length - 1
    )
  ) {
    renderLinearElementPointHighlight(context, appState, elementsMap);
  }
  // Paint selected elements
  if (!appState.multiElement && !appState.editingLinearElement) {
    const showBoundingBox = shouldShowBoundingBox(selectedElements, appState);

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
            selectionColors,
            dashed: !!remoteClients,
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
          selectionColors: [oc.black],
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
        getOmitSidesForDevice(device),
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
    } else if (selectedElements.length > 1 && !appState.isRotating) {
      const dashedLinePadding =
        (DEFAULT_TRANSFORM_HANDLE_SPACING * 2) / appState.zoom.value;
      context.fillStyle = oc.white;
      const [x1, y1, x2, y2] = getCommonBounds(selectedElements);
      const initialLineDash = context.getLineDash();
      context.setLineDash([2 / appState.zoom.value]);
      const lineWidth = context.lineWidth;
      context.lineWidth = 1 / appState.zoom.value;
      context.strokeStyle = selectionColor;
      strokeRectWithRotation(
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
          ? { ...getOmitSidesForDevice(device), rotation: true }
          : getOmitSidesForDevice(device),
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

  appState.searchMatches.forEach(({ id, focus, matchedLines }) => {
    const element = elementsMap.get(id);

    if (element && isTextElement(element)) {
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

      context.translate(appState.scrollX, appState.scrollY);
      context.translate(cx, cy);
      context.rotate(element.angle);

      matchedLines.forEach((matchedLine) => {
        context.fillRect(
          elementX1 + matchedLine.offsetX - cx,
          elementY1 + matchedLine.offsetY - cy,
          matchedLine.width,
          matchedLine.height,
        );
      });

      context.restore();
    }
  });

  renderSnaps(context, appState);

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
      visibleElements,
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
  };
};

/** throttled to animation framerate */
export const renderInteractiveSceneThrottled = throttleRAF(
  (config: InteractiveSceneRenderConfig) => {
    const ret = _renderInteractiveScene(config);
    config.callback?.(ret);
  },
  { trailing: true },
);

/**
 * Interactive scene is the ui-canvas where we render bounding boxes, selections
 * and other ui stuff.
 */
export const renderInteractiveScene = <
  U extends typeof _renderInteractiveScene,
  T extends boolean = false,
>(
  renderConfig: InteractiveSceneRenderConfig,
  throttle?: T,
): T extends true ? void : ReturnType<U> => {
  if (throttle) {
    renderInteractiveSceneThrottled(renderConfig);
    return undefined as T extends true ? void : ReturnType<U>;
  }
  const ret = _renderInteractiveScene(renderConfig);
  renderConfig.callback(ret);
  return ret as T extends true ? void : ReturnType<U>;
};
