import { Point } from "roughjs/bin/geometry";

import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { DataState } from "./types";
import { isInvisiblySmallElement, normalizeDimensions } from "../element";
import nanoid from "nanoid";
import { calculateScrollCenter } from "../scene";

export function restore(
  savedElements: readonly ExcalidrawElement[],
  savedState: AppState | null,
  opts?: { scrollToContent: boolean },
): DataState {
  const elements = savedElements
    .filter(el => {
      // filtering out selection, which is legacy, no longer kept in elements,
      //  and causing issues if retained
      return el.type !== "selection" && !isInvisiblySmallElement(el);
    })
    .map(element => {
      let points: Point[] = [];
      if (element.type === "arrow") {
        if (Array.isArray(element.points)) {
          // if point array is empty, add one point to the arrow
          // this is used as fail safe to convert incoming data to a valid
          // arrow. In the new arrow, width and height are not being usde
          points = element.points.length > 0 ? element.points : [[0, 0]];
        } else {
          // convert old arrow type to a new one
          // old arrow spec used width and height
          // to determine the endpoints
          points = [
            [0, 0],
            [element.width, element.height],
          ];
        }
      } else if (element.type === "line") {
        // old spec, pre-arrows
        // old spec, post-arrows
        if (!Array.isArray(element.points) || element.points.length === 0) {
          points = [
            [0, 0],
            [element.width, element.height],
          ];
        } else {
          points = element.points;
        }
      } else {
        normalizeDimensions(element);
      }

      return {
        ...element,
        version: element.id ? element.version + 1 : element.version || 0,
        id: element.id || nanoid(),
        fillStyle: element.fillStyle || "hachure",
        strokeWidth: element.strokeWidth || 1,
        roughness: element.roughness || 1,
        opacity:
          element.opacity === null || element.opacity === undefined
            ? 100
            : element.opacity,
        points,
      };
    });

  if (opts?.scrollToContent && savedState) {
    savedState = { ...savedState, ...calculateScrollCenter(elements) };
  }

  return {
    elements: elements,
    appState: savedState,
  };
}
