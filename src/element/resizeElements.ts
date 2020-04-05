import { AppState } from "../types";
import { SHIFT_LOCKING_ANGLE } from "../constants";
import { getSelectedElements, globalSceneState } from "../scene";
import { rescalePoints } from "../points";
import { rotate, adjustXYWithRotation } from "../math";
import { ExcalidrawElement, ExcalidrawLinearElement } from "./types";
import { getElementAbsoluteCoords, getCommonBounds } from "./bounds";
import { isLinearElement } from "./typeChecks";
import { mutateElement } from "./mutateElement";
import { getPerfectElementSize, normalizeDimensions } from "./sizeHelpers";
import {
  resizeTest,
  getCursorForResizingElement,
  normalizeResizeHandle,
} from "./resizeTest";

type ResizeTestType = ReturnType<typeof resizeTest>;

export type ResizeArrowFnType = (
  element: ExcalidrawLinearElement,
  pointIndex: number,
  deltaX: number,
  deltaY: number,
  pointerX: number,
  pointerY: number,
  perfect: boolean,
) => void;

const arrowResizeOrigin: ResizeArrowFnType = (
  element: ExcalidrawLinearElement,
  pointIndex: number,
  deltaX: number,
  deltaY: number,
  pointerX: number,
  pointerY: number,
  perfect: boolean,
) => {
  const [px, py] = element.points[pointIndex];
  let x = element.x + deltaX;
  let y = element.y + deltaY;
  let pointX = px - deltaX;
  let pointY = py - deltaY;

  if (perfect) {
    const { width, height } = getPerfectElementSize(
      element.type,
      px + element.x - pointerX,
      py + element.y - pointerY,
    );
    x = px + element.x - width;
    y = py + element.y - height;
    pointX = width;
    pointY = height;
  }

  mutateElement(element, {
    x,
    y,
    points: element.points.map((point, i) =>
      i === pointIndex ? ([pointX, pointY] as const) : point,
    ),
  });
};

const arrowResizeEnd: ResizeArrowFnType = (
  element: ExcalidrawLinearElement,
  pointIndex: number,
  deltaX: number,
  deltaY: number,
  pointerX: number,
  pointerY: number,
  perfect: boolean,
) => {
  const [px, py] = element.points[pointIndex];
  if (perfect) {
    const { width, height } = getPerfectElementSize(
      element.type,
      pointerX - element.x,
      pointerY - element.y,
    );
    mutateElement(element, {
      points: element.points.map((point, i) =>
        i === pointIndex ? ([width, height] as const) : point,
      ),
    });
  } else {
    mutateElement(element, {
      points: element.points.map((point, i) =>
        i === pointIndex ? ([px + deltaX, py + deltaY] as const) : point,
      ),
    });
  }
};

export function resizeElements(
  resizeHandle: ResizeTestType,
  setResizeHandle: (nextResizeHandle: ResizeTestType) => void,
  appState: AppState,
  setAppState: (obj: any) => void,
  resizeArrowFn: ResizeArrowFnType | null,
  setResizeArrowFn: (fn: ResizeArrowFnType) => void,
  event: PointerEvent,
  x: number,
  y: number,
  lastX: number,
  lastY: number,
) {
  setAppState({
    isResizing: resizeHandle !== "rotation",
    isRotating: resizeHandle === "rotation",
  });
  const selectedElements = getSelectedElements(
    globalSceneState.getAllElements(),
    appState,
  );
  if (selectedElements.length === 1) {
    const element = selectedElements[0];
    const angle = element.angle;
    // reverse rotate delta
    const [deltaX, deltaY] = rotate(x - lastX, y - lastY, 0, 0, -angle);
    switch (resizeHandle) {
      case "nw":
        if (isLinearElement(element) && element.points.length === 2) {
          const [, p1] = element.points;

          if (!resizeArrowFn) {
            if (p1[0] < 0 || p1[1] < 0) {
              resizeArrowFn = arrowResizeEnd;
            } else {
              resizeArrowFn = arrowResizeOrigin;
            }
          }
          resizeArrowFn(element, 1, deltaX, deltaY, x, y, event.shiftKey);
          setResizeArrowFn(resizeArrowFn);
        } else {
          const width = element.width - deltaX;
          const height = event.shiftKey ? width : element.height - deltaY;
          const dY = element.height - height;
          mutateElement(element, {
            width,
            height,
            ...adjustXYWithRotation("nw", element, deltaX, dY, angle),
            ...(isLinearElement(element) && width >= 0 && height >= 0
              ? {
                  points: rescalePoints(
                    0,
                    width,
                    rescalePoints(1, height, element.points),
                  ),
                }
              : {}),
          });
        }
        break;
      case "ne":
        if (isLinearElement(element) && element.points.length === 2) {
          const [, p1] = element.points;
          if (!resizeArrowFn) {
            if (p1[0] >= 0) {
              resizeArrowFn = arrowResizeEnd;
            } else {
              resizeArrowFn = arrowResizeOrigin;
            }
          }
          resizeArrowFn(element, 1, deltaX, deltaY, x, y, event.shiftKey);
          setResizeArrowFn(resizeArrowFn);
        } else {
          const width = element.width + deltaX;
          const height = event.shiftKey ? width : element.height - deltaY;
          const dY = element.height - height;
          mutateElement(element, {
            width,
            height,
            ...adjustXYWithRotation("ne", element, deltaX, dY, angle),
            ...(isLinearElement(element) && width >= 0 && height >= 0
              ? {
                  points: rescalePoints(
                    0,
                    width,
                    rescalePoints(1, height, element.points),
                  ),
                }
              : {}),
          });
        }
        break;
      case "sw":
        if (isLinearElement(element) && element.points.length === 2) {
          const [, p1] = element.points;
          if (!resizeArrowFn) {
            if (p1[0] <= 0) {
              resizeArrowFn = arrowResizeEnd;
            } else {
              resizeArrowFn = arrowResizeOrigin;
            }
          }
          resizeArrowFn(element, 1, deltaX, deltaY, x, y, event.shiftKey);
          setResizeArrowFn(resizeArrowFn);
        } else {
          const width = element.width - deltaX;
          const height = event.shiftKey ? width : element.height + deltaY;
          const dY = height - element.height;
          mutateElement(element, {
            width,
            height,
            ...adjustXYWithRotation("sw", element, deltaX, dY, angle),
            ...(isLinearElement(element) && width >= 0 && height >= 0
              ? {
                  points: rescalePoints(
                    0,
                    width,
                    rescalePoints(1, height, element.points),
                  ),
                }
              : {}),
          });
        }
        break;
      case "se":
        if (isLinearElement(element) && element.points.length === 2) {
          const [, p1] = element.points;
          if (!resizeArrowFn) {
            if (p1[0] > 0 || p1[1] > 0) {
              resizeArrowFn = arrowResizeEnd;
            } else {
              resizeArrowFn = arrowResizeOrigin;
            }
          }
          resizeArrowFn(element, 1, deltaX, deltaY, x, y, event.shiftKey);
          setResizeArrowFn(resizeArrowFn);
        } else {
          const width = element.width + deltaX;
          const height = event.shiftKey ? width : element.height + deltaY;
          const dY = height - element.height;
          mutateElement(element, {
            width,
            height,
            ...adjustXYWithRotation("se", element, deltaX, dY, angle),
            ...(isLinearElement(element) && width >= 0 && height >= 0
              ? {
                  points: rescalePoints(
                    0,
                    width,
                    rescalePoints(1, height, element.points),
                  ),
                }
              : {}),
          });
        }
        break;
      case "n": {
        const height = element.height - deltaY;

        if (isLinearElement(element)) {
          if (element.points.length > 2 && height <= 0) {
            // Someday we should implement logic to flip the shape.
            // But for now, just stop.
            break;
          }
          mutateElement(element, {
            height,
            ...adjustXYWithRotation("n", element, 0, deltaY, angle),
            points: rescalePoints(1, height, element.points),
          });
        } else {
          mutateElement(element, {
            height,
            ...adjustXYWithRotation("n", element, 0, deltaY, angle),
          });
        }

        break;
      }
      case "w": {
        const width = element.width - deltaX;

        if (isLinearElement(element)) {
          if (element.points.length > 2 && width <= 0) {
            // Someday we should implement logic to flip the shape.
            // But for now, just stop.
            break;
          }

          mutateElement(element, {
            width,
            ...adjustXYWithRotation("w", element, deltaX, 0, angle),
            points: rescalePoints(0, width, element.points),
          });
        } else {
          mutateElement(element, {
            width,
            ...adjustXYWithRotation("w", element, deltaX, 0, angle),
          });
        }
        break;
      }
      case "s": {
        const height = element.height + deltaY;

        if (isLinearElement(element)) {
          if (element.points.length > 2 && height <= 0) {
            // Someday we should implement logic to flip the shape.
            // But for now, just stop.
            break;
          }
          mutateElement(element, {
            height,
            ...adjustXYWithRotation("s", element, 0, deltaY, angle),
            points: rescalePoints(1, height, element.points),
          });
        } else {
          mutateElement(element, {
            height,
            ...adjustXYWithRotation("s", element, 0, deltaY, angle),
          });
        }
        break;
      }
      case "e": {
        const width = element.width + deltaX;

        if (isLinearElement(element)) {
          if (element.points.length > 2 && width <= 0) {
            // Someday we should implement logic to flip the shape.
            // But for now, just stop.
            break;
          }
          mutateElement(element, {
            width,
            ...adjustXYWithRotation("e", element, deltaX, 0, angle),
            points: rescalePoints(0, width, element.points),
          });
        } else {
          mutateElement(element, {
            width,
            ...adjustXYWithRotation("e", element, deltaX, 0, angle),
          });
        }
        break;
      }
      case "rotation": {
        const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        let angle = (5 * Math.PI) / 2 + Math.atan2(y - cy, x - cx);
        if (event.shiftKey) {
          angle += SHIFT_LOCKING_ANGLE / 2;
          angle -= angle % SHIFT_LOCKING_ANGLE;
        }
        if (angle >= 2 * Math.PI) {
          angle -= 2 * Math.PI;
        }
        mutateElement(element, { angle });
        break;
      }
    }

    if (resizeHandle) {
      setResizeHandle(normalizeResizeHandle(element, resizeHandle));
    }
    normalizeDimensions(element);

    // do we need this?
    document.documentElement.style.cursor = getCursorForResizingElement({
      element,
      resizeHandle,
    });
    // why do we need this?
    if (appState.resizingElement) {
      mutateElement(appState.resizingElement, {
        x: element.x,
        y: element.y,
      });
    }

    return true;
  } else if (selectedElements.length > 1) {
    const [x1, y1, x2, y2] = getCommonBounds(selectedElements);
    const handleOffset = 4 / appState.zoom; // XXX import constant
    const dashedLinePadding = 4 / appState.zoom; // XXX import constant
    const minSize = handleOffset * 4;
    const minScale = Math.max(minSize / (x2 - x1), minSize / (y2 - y1));
    switch (resizeHandle) {
      case "se": {
        const scale = Math.max(
          (x - handleOffset - dashedLinePadding - x1) / (x2 - x1),
          (y - handleOffset - dashedLinePadding - y1) / (y2 - y1),
        );
        if (scale > minScale) {
          selectedElements.forEach((element) => {
            const width = element.width * scale;
            const height = element.height * scale;
            const x = element.x + (element.x - x1) * (scale - 1);
            const y = element.y + (element.y - y1) * (scale - 1);
            mutateElement(element, { width, height, x, y });
          });
        }
        return true;
      }
      case "nw": {
        const scale = Math.max(
          (x2 - handleOffset - dashedLinePadding - x) / (x2 - x1),
          (y2 - handleOffset - dashedLinePadding - y) / (y2 - y1),
        );
        if (scale > minScale) {
          selectedElements.forEach((element) => {
            const width = element.width * scale;
            const height = element.height * scale;
            const x = element.x - (x2 - element.x) * (scale - 1);
            const y = element.y - (y2 - element.y) * (scale - 1);
            mutateElement(element, { width, height, x, y });
          });
        }
        return true;
      }
      case "ne": {
        const scale = Math.max(
          (x - handleOffset - dashedLinePadding - x1) / (x2 - x1),
          (y2 - handleOffset - dashedLinePadding - y) / (y2 - y1),
        );
        if (scale > minScale) {
          selectedElements.forEach((element) => {
            const width = element.width * scale;
            const height = element.height * scale;
            const x = element.x + (element.x - x1) * (scale - 1);
            const y = element.y - (y2 - element.y) * (scale - 1);
            mutateElement(element, { width, height, x, y });
          });
        }
        return true;
      }
      case "sw": {
        const scale = Math.max(
          (x2 - handleOffset - dashedLinePadding - x) / (x2 - x1),
          (y - handleOffset - dashedLinePadding - y1) / (y2 - y1),
        );
        if (scale > minScale) {
          selectedElements.forEach((element) => {
            const width = element.width * scale;
            const height = element.height * scale;
            const x = element.x - (x2 - element.x) * (scale - 1);
            const y = element.y + (element.y - y1) * (scale - 1);
            mutateElement(element, { width, height, x, y });
          });
        }
        return true;
      }
    }
  }
  return false;
}

export function canResizeMutlipleElements(
  elements: readonly ExcalidrawElement[],
) {
  return elements.every((element) =>
    ["rectangle", "diamond", "ellipse"].includes(element.type),
  );
}
