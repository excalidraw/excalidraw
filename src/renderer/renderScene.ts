import { RoughCanvas } from "roughjs/bin/canvas";
import { RoughSVG } from "roughjs/bin/svg";
import oc from "open-color";

import { AppState, BinaryFiles, Point, Zoom } from "../types";
import {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
  ExcalidrawLinearElement,
  NonDeleted,
  GroupId,
  ExcalidrawBindableElement,
} from "../element/types";
import {
  getElementAbsoluteCoords,
  OMIT_SIDES_FOR_MULTIPLE_ELEMENTS,
  getTransformHandlesFromCoords,
  getTransformHandles,
  getElementBounds,
  getCommonBounds,
} from "../element";

import { roundRect } from "./roundRect";
import { RenderConfig } from "../scene/types";
import {
  getScrollBars,
  SCROLLBAR_COLOR,
  SCROLLBAR_WIDTH,
} from "../scene/scrollbars";
import { getSelectedElements } from "../scene/selection";

import { renderElement, renderElementToSvg } from "./renderElement";
import { getClientColors } from "../clients";
import { LinearElementEditor } from "../element/linearElementEditor";
import {
  isSelectedViaGroup,
  getSelectedGroupIds,
  getElementsInGroup,
} from "../groups";
import { maxBindingGap } from "../element/collision";
import {
  SuggestedBinding,
  SuggestedPointBinding,
  isBindingEnabled,
} from "../element/binding";
import {
  shouldShowBoundingBox,
  TransformHandles,
  TransformHandleType,
} from "../element/transformHandles";
import {
  viewportCoordsToSceneCoords,
  supportsEmoji,
  throttleRAF,
} from "../utils";
import { UserIdleState } from "../types";
import { THEME_FILTER } from "../constants";
import {
  EXTERNAL_LINK_IMG,
  getLinkHandleFromCoords,
} from "../element/Hyperlink";
import { isLinearElement } from "../element/typeChecks";

const hasEmojiSupport = supportsEmoji();
export const DEFAULT_SPACING = 2;

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
) => {
  context.save();
  context.translate(cx, cy);
  context.rotate(angle);
  if (fill) {
    context.fillRect(x - cx, y - cy, width, height);
  }
  context.strokeRect(x - cx, y - cy, width, height);
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

const fillCircle = (
  context: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  stroke = true,
) => {
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.fill();
  if (stroke) {
    context.stroke();
  }
};

const strokeGrid = (
  context: CanvasRenderingContext2D,
  gridSize: number,
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
) => {
  context.save();
  context.strokeStyle = "rgba(0,0,0,0.1)";
  context.beginPath();
  for (let x = offsetX; x < offsetX + width + gridSize * 2; x += gridSize) {
    context.moveTo(x, offsetY - gridSize);
    context.lineTo(x, offsetY + height + gridSize * 2);
  }
  for (let y = offsetY; y < offsetY + height + gridSize * 2; y += gridSize) {
    context.moveTo(offsetX - gridSize, y);
    context.lineTo(offsetX + width + gridSize * 2, y);
  }
  context.stroke();
  context.restore();
};

const renderSingleLinearPoint = (
  context: CanvasRenderingContext2D,
  appState: AppState,
  renderConfig: RenderConfig,
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
    radius / renderConfig.zoom.value,
    !isPhantomPoint,
  );
};

const renderLinearPointHandles = (
  context: CanvasRenderingContext2D,
  appState: AppState,
  renderConfig: RenderConfig,
  element: NonDeleted<ExcalidrawLinearElement>,
) => {
  if (!appState.selectedLinearElement) {
    return;
  }
  context.save();
  context.translate(renderConfig.scrollX, renderConfig.scrollY);
  context.lineWidth = 1 / renderConfig.zoom.value;
  const points = LinearElementEditor.getPointsGlobalCoordinates(element);

  const { POINT_HANDLE_SIZE } = LinearElementEditor;
  const radius = appState.editingLinearElement
    ? POINT_HANDLE_SIZE
    : POINT_HANDLE_SIZE / 2;
  points.forEach((point, idx) => {
    const isSelected =
      !!appState.editingLinearElement?.selectedPointsIndices?.includes(idx);

    renderSingleLinearPoint(
      context,
      appState,
      renderConfig,
      point,
      radius,
      isSelected,
    );
  });

  //Rendering segment mid points
  const midPoints = LinearElementEditor.getEditorMidPoints(
    element,
    appState,
  ).filter((midPoint) => midPoint !== null) as Point[];

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
          renderConfig,
          segmentMidPoint,
          radius,
          false,
        );
        highlightPoint(segmentMidPoint, context, renderConfig);
      } else {
        highlightPoint(segmentMidPoint, context, renderConfig);
        renderSingleLinearPoint(
          context,
          appState,
          renderConfig,
          segmentMidPoint,
          radius,
          false,
        );
      }
    } else if (appState.editingLinearElement || points.length === 2) {
      renderSingleLinearPoint(
        context,
        appState,
        renderConfig,
        segmentMidPoint,
        POINT_HANDLE_SIZE / 2,
        false,
        true,
      );
    }
  });

  context.restore();
};

const highlightPoint = (
  point: Point,
  context: CanvasRenderingContext2D,
  renderConfig: RenderConfig,
) => {
  context.fillStyle = "rgba(105, 101, 219, 0.4)";

  fillCircle(
    context,
    point[0],
    point[1],
    LinearElementEditor.POINT_HANDLE_SIZE / renderConfig.zoom.value,
    false,
  );
};
const renderLinearElementPointHighlight = (
  context: CanvasRenderingContext2D,
  appState: AppState,
  renderConfig: RenderConfig,
) => {
  const { elementId, hoverPointIndex } = appState.selectedLinearElement!;
  if (
    appState.editingLinearElement?.selectedPointsIndices?.includes(
      hoverPointIndex,
    )
  ) {
    return;
  }
  const element = LinearElementEditor.getElement(elementId);
  if (!element) {
    return;
  }
  const point = LinearElementEditor.getPointAtIndexGlobalCoordinates(
    element,
    hoverPointIndex,
  );
  context.save();
  context.translate(renderConfig.scrollX, renderConfig.scrollY);

  highlightPoint(point, context, renderConfig);
  context.restore();
};

export const _renderScene = ({
  elements,
  appState,
  scale,
  rc,
  canvas,
  renderConfig,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  appState: AppState;
  scale: number;
  rc: RoughCanvas;
  canvas: HTMLCanvasElement;
  renderConfig: RenderConfig;
}) =>
  // extra options passed to the renderer
  {
    if (canvas === null) {
      return { atLeastOneVisibleElement: false };
    }
    const {
      renderScrollbars = true,
      renderSelection = true,
      renderGrid = true,
      isExporting,
    } = renderConfig;

    const selectionColor = renderConfig.selectionColor || oc.black;

    const context = canvas.getContext("2d")!;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.save();
    context.scale(scale, scale);
    // When doing calculations based on canvas width we should used normalized one
    const normalizedCanvasWidth = canvas.width / scale;
    const normalizedCanvasHeight = canvas.height / scale;

    if (isExporting && renderConfig.theme === "dark") {
      context.filter = THEME_FILTER;
    }

    // Paint background
    if (typeof renderConfig.viewBackgroundColor === "string") {
      const hasTransparence =
        renderConfig.viewBackgroundColor === "transparent" ||
        renderConfig.viewBackgroundColor.length === 5 || // #RGBA
        renderConfig.viewBackgroundColor.length === 9 || // #RRGGBBA
        /(hsla|rgba)\(/.test(renderConfig.viewBackgroundColor);
      if (hasTransparence) {
        context.clearRect(0, 0, normalizedCanvasWidth, normalizedCanvasHeight);
      }
      context.save();
      context.fillStyle = renderConfig.viewBackgroundColor;
      context.fillRect(0, 0, normalizedCanvasWidth, normalizedCanvasHeight);
      context.restore();
    } else {
      context.clearRect(0, 0, normalizedCanvasWidth, normalizedCanvasHeight);
    }

    // Apply zoom
    context.save();
    context.scale(renderConfig.zoom.value, renderConfig.zoom.value);

    // Grid
    if (renderGrid && appState.gridSize) {
      strokeGrid(
        context,
        appState.gridSize,
        -Math.ceil(renderConfig.zoom.value / appState.gridSize) *
          appState.gridSize +
          (renderConfig.scrollX % appState.gridSize),
        -Math.ceil(renderConfig.zoom.value / appState.gridSize) *
          appState.gridSize +
          (renderConfig.scrollY % appState.gridSize),
        normalizedCanvasWidth / renderConfig.zoom.value,
        normalizedCanvasHeight / renderConfig.zoom.value,
      );
    }

    // Paint visible elements
    const visibleElements = elements.filter((element) =>
      isVisibleElement(element, normalizedCanvasWidth, normalizedCanvasHeight, {
        zoom: renderConfig.zoom,
        offsetLeft: appState.offsetLeft,
        offsetTop: appState.offsetTop,
        scrollX: renderConfig.scrollX,
        scrollY: renderConfig.scrollY,
      }),
    );

    let editingLinearElement: NonDeleted<ExcalidrawLinearElement> | undefined =
      undefined;
    visibleElements.forEach((element) => {
      try {
        renderElement(element, rc, context, renderConfig, appState);
        // Getting the element using LinearElementEditor during collab mismatches version - being one head of visible elements due to
        // ShapeCache returns empty hence making sure that we get the
        // correct element from visible elements
        if (appState.editingLinearElement?.elementId === element.id) {
          if (element) {
            editingLinearElement =
              element as NonDeleted<ExcalidrawLinearElement>;
          }
        }
        if (!isExporting) {
          renderLinkIcon(element, context, appState);
        }
      } catch (error: any) {
        console.error(error);
      }
    });

    if (editingLinearElement) {
      renderLinearPointHandles(
        context,
        appState,
        renderConfig,
        editingLinearElement,
      );
    }

    // Paint selection element
    if (appState.selectionElement) {
      try {
        renderElement(
          appState.selectionElement,
          rc,
          context,
          renderConfig,
          appState,
        );
      } catch (error: any) {
        console.error(error);
      }
    }

    if (isBindingEnabled(appState)) {
      appState.suggestedBindings
        .filter((binding) => binding != null)
        .forEach((suggestedBinding) => {
          renderBindingHighlight(context, renderConfig, suggestedBinding!);
        });
    }
    const locallySelectedElements = getSelectedElements(elements, appState);

    // Getting the element using LinearElementEditor during collab mismatches version - being one head of visible elements due to
    // ShapeCache returns empty hence making sure that we get the
    // correct element from visible elements
    if (
      locallySelectedElements.length === 1 &&
      appState.editingLinearElement?.elementId === locallySelectedElements[0].id
    ) {
      renderLinearPointHandles(
        context,
        appState,
        renderConfig,
        locallySelectedElements[0] as NonDeleted<ExcalidrawLinearElement>,
      );
    }

    if (
      appState.selectedLinearElement &&
      appState.selectedLinearElement.hoverPointIndex >= 0
    ) {
      renderLinearElementPointHighlight(context, appState, renderConfig);
    }
    // Paint selected elements
    if (
      renderSelection &&
      !appState.multiElement &&
      !appState.editingLinearElement
    ) {
      const showBoundingBox = shouldShowBoundingBox(
        locallySelectedElements,
        appState,
      );

      const locallySelectedIds = locallySelectedElements.map(
        (element) => element.id,
      );
      const isSingleLinearElementSelected =
        locallySelectedElements.length === 1 &&
        isLinearElement(locallySelectedElements[0]);
      // render selected linear element points
      if (
        isSingleLinearElementSelected &&
        appState.selectedLinearElement?.elementId ===
          locallySelectedElements[0].id &&
        !locallySelectedElements[0].locked
      ) {
        renderLinearPointHandles(
          context,
          appState,
          renderConfig,
          locallySelectedElements[0] as ExcalidrawLinearElement,
        );
      }
      if (showBoundingBox) {
        const selections = elements.reduce((acc, element) => {
          const selectionColors = [];
          // local user
          if (
            locallySelectedIds.includes(element.id) &&
            !isSelectedViaGroup(appState, element)
          ) {
            selectionColors.push(selectionColor);
          }
          // remote users
          if (renderConfig.remoteSelectedElementIds[element.id]) {
            selectionColors.push(
              ...renderConfig.remoteSelectedElementIds[element.id].map(
                (socketId) => {
                  const { background } = getClientColors(socketId, appState);
                  return background;
                },
              ),
            );
          }

          if (selectionColors.length) {
            const [elementX1, elementY1, elementX2, elementY2, cx, cy] =
              getElementAbsoluteCoords(element, true);
            acc.push({
              angle: element.angle,
              elementX1,
              elementY1,
              elementX2,
              elementY2,
              selectionColors,
              dashed: !!renderConfig.remoteSelectedElementIds[element.id],
              cx,
              cy,
            });
          }
          return acc;
        }, [] as { angle: number; elementX1: number; elementY1: number; elementX2: number; elementY2: number; selectionColors: string[]; dashed?: boolean; cx: number; cy: number }[]);

        const addSelectionForGroupId = (groupId: GroupId) => {
          const groupElements = getElementsInGroup(elements, groupId);
          const [elementX1, elementY1, elementX2, elementY2] =
            getCommonBounds(groupElements);
          selections.push({
            angle: 0,
            elementX1,
            elementX2,
            elementY1,
            elementY2,
            selectionColors: [oc.black],
            dashed: true,
            cx: elementX1 + (elementX2 - elementX1) / 2,
            cy: elementY1 + (elementY2 - elementY1) / 2,
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
          renderSelectionBorder(context, renderConfig, selection),
        );
      }
      // Paint resize transformHandles
      context.save();
      context.translate(renderConfig.scrollX, renderConfig.scrollY);

      if (locallySelectedElements.length === 1) {
        context.fillStyle = oc.white;
        const transformHandles = getTransformHandles(
          locallySelectedElements[0],
          renderConfig.zoom,
          "mouse", // when we render we don't know which pointer type so use mouse
        );
        if (!appState.viewModeEnabled && showBoundingBox) {
          renderTransformHandles(
            context,
            renderConfig,
            transformHandles,
            locallySelectedElements[0].angle,
          );
        }
      } else if (locallySelectedElements.length > 1 && !appState.isRotating) {
        const dashedLinePadding =
          (DEFAULT_SPACING * 2) / renderConfig.zoom.value;
        context.fillStyle = oc.white;
        const [x1, y1, x2, y2] = getCommonBounds(locallySelectedElements);
        const initialLineDash = context.getLineDash();
        context.setLineDash([2 / renderConfig.zoom.value]);
        const lineWidth = context.lineWidth;
        context.lineWidth = 1 / renderConfig.zoom.value;
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
          0,
          renderConfig.zoom,
          "mouse",
          OMIT_SIDES_FOR_MULTIPLE_ELEMENTS,
        );
        if (locallySelectedElements.some((element) => !element.locked)) {
          renderTransformHandles(context, renderConfig, transformHandles, 0);
        }
      }
      context.restore();
    }

    // Reset zoom
    context.restore();

    // Paint remote pointers
    for (const clientId in renderConfig.remotePointerViewportCoords) {
      let { x, y } = renderConfig.remotePointerViewportCoords[clientId];

      x -= appState.offsetLeft;
      y -= appState.offsetTop;

      const width = 9;
      const height = 14;

      const isOutOfBounds =
        x < 0 ||
        x > normalizedCanvasWidth - width ||
        y < 0 ||
        y > normalizedCanvasHeight - height;

      x = Math.max(x, 0);
      x = Math.min(x, normalizedCanvasWidth - width);
      y = Math.max(y, 0);
      y = Math.min(y, normalizedCanvasHeight - height);

      const { background, stroke } = getClientColors(clientId, appState);

      context.save();
      context.strokeStyle = stroke;
      context.fillStyle = background;

      const userState = renderConfig.remotePointerUserStates[clientId];
      if (isOutOfBounds || userState === UserIdleState.AWAY) {
        context.globalAlpha = 0.48;
      }

      if (
        renderConfig.remotePointerButton &&
        renderConfig.remotePointerButton[clientId] === "down"
      ) {
        context.beginPath();
        context.arc(x, y, 15, 0, 2 * Math.PI, false);
        context.lineWidth = 3;
        context.strokeStyle = "#ffffff88";
        context.stroke();
        context.closePath();

        context.beginPath();
        context.arc(x, y, 15, 0, 2 * Math.PI, false);
        context.lineWidth = 1;
        context.strokeStyle = stroke;
        context.stroke();
        context.closePath();
      }

      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + 1, y + 14);
      context.lineTo(x + 4, y + 9);
      context.lineTo(x + 9, y + 10);
      context.lineTo(x, y);
      context.fill();
      context.stroke();

      const username = renderConfig.remotePointerUsernames[clientId];

      let idleState = "";
      if (userState === UserIdleState.AWAY) {
        idleState = hasEmojiSupport ? "⚫️" : ` (${UserIdleState.AWAY})`;
      } else if (userState === UserIdleState.IDLE) {
        idleState = hasEmojiSupport ? "💤" : ` (${UserIdleState.IDLE})`;
      }

      const usernameAndIdleState = `${username || ""}${
        idleState ? ` ${idleState}` : ""
      }`;

      if (!isOutOfBounds && usernameAndIdleState) {
        const offsetX = x + width;
        const offsetY = y + height;
        const paddingHorizontal = 4;
        const paddingVertical = 4;
        const measure = context.measureText(usernameAndIdleState);
        const measureHeight =
          measure.actualBoundingBoxDescent + measure.actualBoundingBoxAscent;

        const boxX = offsetX - 1;
        const boxY = offsetY - 1;
        const boxWidth = measure.width + 2 * paddingHorizontal + 2;
        const boxHeight = measureHeight + 2 * paddingVertical + 2;
        if (context.roundRect) {
          context.beginPath();
          context.roundRect(
            boxX,
            boxY,
            boxWidth,
            boxHeight,
            4 / renderConfig.zoom.value,
          );
          context.fillStyle = background;
          context.fill();
          context.fillStyle = stroke;
          context.stroke();
        } else {
          // Border
          context.fillStyle = stroke;
          context.fillRect(boxX, boxY, boxWidth, boxHeight);
          // Background
          context.fillStyle = background;
          context.fillRect(offsetX, offsetY, boxWidth - 2, boxHeight - 2);
        }
        context.fillStyle = oc.white;

        context.fillText(
          usernameAndIdleState,
          offsetX + paddingHorizontal,
          offsetY + paddingVertical + measure.actualBoundingBoxAscent,
        );
      }

      context.restore();
      context.closePath();
    }

    // Paint scrollbars
    let scrollBars;
    if (renderScrollbars) {
      scrollBars = getScrollBars(
        elements,
        normalizedCanvasWidth,
        normalizedCanvasHeight,
        renderConfig,
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

    context.restore();
    return { atLeastOneVisibleElement: visibleElements.length > 0, scrollBars };
  };

const renderSceneThrottled = throttleRAF(
  (config: {
    elements: readonly NonDeletedExcalidrawElement[];
    appState: AppState;
    scale: number;
    rc: RoughCanvas;
    canvas: HTMLCanvasElement;
    renderConfig: RenderConfig;
    callback?: (data: ReturnType<typeof _renderScene>) => void;
  }) => {
    const ret = _renderScene(config);
    config.callback?.(ret);
  },
  { trailing: true },
);

/** renderScene throttled to animation framerate */
export const renderScene = <T extends boolean = false>(
  config: {
    elements: readonly NonDeletedExcalidrawElement[];
    appState: AppState;
    scale: number;
    rc: RoughCanvas;
    canvas: HTMLCanvasElement;
    renderConfig: RenderConfig;
    callback?: (data: ReturnType<typeof _renderScene>) => void;
  },
  /** Whether to throttle rendering. Defaults to false.
   * When throttling, no value is returned. Use the callback instead. */
  throttle?: T,
): T extends true ? void : ReturnType<typeof _renderScene> => {
  if (throttle) {
    renderSceneThrottled(config);
    return undefined as T extends true ? void : ReturnType<typeof _renderScene>;
  }
  const ret = _renderScene(config);
  config.callback?.(ret);
  return ret as T extends true ? void : ReturnType<typeof _renderScene>;
};

const renderTransformHandles = (
  context: CanvasRenderingContext2D,
  renderConfig: RenderConfig,
  transformHandles: TransformHandles,
  angle: number,
): void => {
  Object.keys(transformHandles).forEach((key) => {
    const transformHandle = transformHandles[key as TransformHandleType];
    if (transformHandle !== undefined) {
      const [x, y, width, height] = transformHandle;

      context.save();
      context.lineWidth = 1 / renderConfig.zoom.value;
      if (renderConfig.selectionColor) {
        context.strokeStyle = renderConfig.selectionColor;
      }
      if (key === "rotation") {
        fillCircle(context, x + width / 2, y + height / 2, width / 2);
        // prefer round corners if roundRect API is available
      } else if (context.roundRect) {
        context.beginPath();
        context.roundRect(x, y, width, height, 2 / renderConfig.zoom.value);
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

const renderSelectionBorder = (
  context: CanvasRenderingContext2D,
  renderConfig: RenderConfig,
  elementProperties: {
    angle: number;
    elementX1: number;
    elementY1: number;
    elementX2: number;
    elementY2: number;
    selectionColors: string[];
    dashed?: boolean;
    cx: number;
    cy: number;
  },
  padding = DEFAULT_SPACING * 2,
) => {
  const {
    angle,
    elementX1,
    elementY1,
    elementX2,
    elementY2,
    selectionColors,
    cx,
    cy,
    dashed,
  } = elementProperties;
  const elementWidth = elementX2 - elementX1;
  const elementHeight = elementY2 - elementY1;

  const linePadding = padding / renderConfig.zoom.value;
  const lineWidth = 8 / renderConfig.zoom.value;
  const spaceWidth = 4 / renderConfig.zoom.value;

  context.save();
  context.translate(renderConfig.scrollX, renderConfig.scrollY);
  context.lineWidth = 1 / renderConfig.zoom.value;

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
      elementX1 - linePadding,
      elementY1 - linePadding,
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
  renderConfig: RenderConfig,
  suggestedBinding: SuggestedBinding,
) => {
  const renderHighlight = Array.isArray(suggestedBinding)
    ? renderBindingHighlightForSuggestedPointBinding
    : renderBindingHighlightForBindableElement;

  context.save();
  context.translate(renderConfig.scrollX, renderConfig.scrollY);
  renderHighlight(context, suggestedBinding as any);

  context.restore();
};

const renderBindingHighlightForBindableElement = (
  context: CanvasRenderingContext2D,
  element: ExcalidrawBindableElement,
) => {
  const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
  const width = x2 - x1;
  const height = y2 - y1;
  const threshold = maxBindingGap(element, width, height);

  // So that we don't overlap the element itself
  const strokeOffset = 4;
  context.strokeStyle = "rgba(0,0,0,.05)";
  context.lineWidth = threshold - strokeOffset;
  const padding = strokeOffset / 2 + threshold / 2;

  switch (element.type) {
    case "rectangle":
    case "text":
    case "image":
      strokeRectWithRotation(
        context,
        x1 - padding,
        y1 - padding,
        width + padding * 2,
        height + padding * 2,
        x1 + width / 2,
        y1 + height / 2,
        element.angle,
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
    );
    fillCircle(context, x, y, threshold);
  });
};

let linkCanvasCache: any;
const renderLinkIcon = (
  element: NonDeletedExcalidrawElement,
  context: CanvasRenderingContext2D,
  appState: AppState,
) => {
  if (element.link && !appState.selectedElementIds[element.id]) {
    const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
    const [x, y, width, height] = getLinkHandleFromCoords(
      [x1, y1, x2, y2],
      element.angle,
      appState,
    );
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    context.save();
    context.translate(appState.scrollX + centerX, appState.scrollY + centerY);
    context.rotate(element.angle);

    if (!linkCanvasCache || linkCanvasCache.zoom !== appState.zoom.value) {
      linkCanvasCache = document.createElement("canvas");
      linkCanvasCache.zoom = appState.zoom.value;
      linkCanvasCache.width =
        width * window.devicePixelRatio * appState.zoom.value;
      linkCanvasCache.height =
        height * window.devicePixelRatio * appState.zoom.value;
      const linkCanvasCacheContext = linkCanvasCache.getContext("2d")!;
      linkCanvasCacheContext.scale(
        window.devicePixelRatio * appState.zoom.value,
        window.devicePixelRatio * appState.zoom.value,
      );
      linkCanvasCacheContext.fillStyle = "#fff";
      linkCanvasCacheContext.fillRect(0, 0, width, height);
      linkCanvasCacheContext.drawImage(EXTERNAL_LINK_IMG, 0, 0, width, height);
      linkCanvasCacheContext.restore();
      context.drawImage(
        linkCanvasCache,
        x - centerX,
        y - centerY,
        width,
        height,
      );
    } else {
      context.drawImage(
        linkCanvasCache,
        x - centerX,
        y - centerY,
        width,
        height,
      );
    }
    context.restore();
  }
};

const isVisibleElement = (
  element: ExcalidrawElement,
  canvasWidth: number,
  canvasHeight: number,
  viewTransformations: {
    zoom: Zoom;
    offsetLeft: number;
    offsetTop: number;
    scrollX: number;
    scrollY: number;
  },
) => {
  const [x1, y1, x2, y2] = getElementBounds(element); // scene coordinates
  const topLeftSceneCoords = viewportCoordsToSceneCoords(
    {
      clientX: viewTransformations.offsetLeft,
      clientY: viewTransformations.offsetTop,
    },
    viewTransformations,
  );
  const bottomRightSceneCoords = viewportCoordsToSceneCoords(
    {
      clientX: viewTransformations.offsetLeft + canvasWidth,
      clientY: viewTransformations.offsetTop + canvasHeight,
    },
    viewTransformations,
  );

  return (
    topLeftSceneCoords.x <= x2 &&
    topLeftSceneCoords.y <= y2 &&
    bottomRightSceneCoords.x >= x1 &&
    bottomRightSceneCoords.y >= y1
  );
};

// This should be only called for exporting purposes
export const renderSceneToSvg = (
  elements: readonly NonDeletedExcalidrawElement[],
  rsvg: RoughSVG,
  svgRoot: SVGElement,
  files: BinaryFiles,
  {
    offsetX = 0,
    offsetY = 0,
    exportWithDarkMode = false,
  }: {
    offsetX?: number;
    offsetY?: number;
    exportWithDarkMode?: boolean;
  } = {},
) => {
  if (!svgRoot) {
    return;
  }
  // render elements
  elements.forEach((element, index) => {
    if (!element.isDeleted) {
      try {
        renderElementToSvg(
          element,
          rsvg,
          svgRoot,
          files,
          element.x + offsetX,
          element.y + offsetY,
          exportWithDarkMode,
        );
      } catch (error: any) {
        console.error(error);
      }
    }
  });
};
