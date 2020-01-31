import { ExcalidrawElement } from "./types";
import { SceneScroll } from "../scene/types";
import { getArrowAbsoluteBounds } from "./bounds";

type Sides = "n" | "s" | "w" | "e" | "nw" | "ne" | "sw" | "se";

export function handlerRectangles(
  element: ExcalidrawElement,
  { scrollX, scrollY }: SceneScroll,
) {
  let elementX2 = 0;
  let elementY2 = 0;
  let elementX1 = Infinity;
  let elementY1 = Infinity;
  let marginX = -8;
  let marginY = -8;

  let minimumSize = 40;
  if (element.type === "arrow") {
    [elementX1, elementY1, elementX2, elementY2] = getArrowAbsoluteBounds(
      element,
    );
  } else {
    elementX1 = element.x;
    elementX2 = element.x + element.width;
    elementY1 = element.y;
    elementY2 = element.y + element.height;

    marginX = element.width < 0 ? 8 : -8;
    marginY = element.height < 0 ? 8 : -8;
  }

  const margin = 4;
  const handlers = {} as { [T in Sides]: number[] };

  if (Math.abs(elementX2 - elementX1) > minimumSize) {
    handlers["n"] = [
      elementX1 + (elementX2 - elementX1) / 2 + scrollX - 4,
      elementY1 - margin + scrollY + marginY,
      8,
      8,
    ];

    handlers["s"] = [
      elementX1 + (elementX2 - elementX1) / 2 + scrollX - 4,
      elementY2 - margin + scrollY - marginY,
      8,
      8,
    ];
  }

  if (Math.abs(elementY2 - elementY1) > minimumSize) {
    handlers["w"] = [
      elementX1 - margin + scrollX + marginX,
      elementY1 + (elementY2 - elementY1) / 2 + scrollY - 4,
      8,
      8,
    ];

    handlers["e"] = [
      elementX2 - margin + scrollX - marginX,
      elementY1 + (elementY2 - elementY1) / 2 + scrollY - 4,
      8,
      8,
    ];
  }

  handlers["nw"] = [
    elementX1 - margin + scrollX + marginX,
    elementY1 - margin + scrollY + marginY,
    8,
    8,
  ]; // nw
  handlers["ne"] = [
    elementX2 - margin + scrollX - marginX,
    elementY1 - margin + scrollY + marginY,
    8,
    8,
  ]; // ne
  handlers["sw"] = [
    elementX1 - margin + scrollX + marginX,
    elementY2 - margin + scrollY - marginY,
    8,
    8,
  ]; // sw
  handlers["se"] = [
    elementX2 - margin + scrollX - marginX,
    elementY2 - margin + scrollY - marginY,
    8,
    8,
  ]; // se

  if (element.type === "line") {
    return {
      nw: handlers.nw,
      se: handlers.se,
    } as typeof handlers;
  } else if (element.type === "arrow") {
    if (element.points.length === 2) {
      // only check the last point because starting point is always (0,0)
      const [, p1] = element.points;

      if (p1[0] === 0 || p1[1] === 0) {
        return {
          nw: handlers.nw,
          se: handlers.se,
        } as typeof handlers;
      }

      if (p1[0] > 0 && p1[1] < 0) {
        return {
          ne: handlers.ne,
          sw: handlers.sw,
        } as typeof handlers;
      }

      if (p1[0] > 0 && p1[1] > 0) {
        return {
          nw: handlers.nw,
          se: handlers.se,
        } as typeof handlers;
      }

      if (p1[0] < 0 && p1[1] > 0) {
        return {
          ne: handlers.ne,
          sw: handlers.sw,
        } as typeof handlers;
      }

      if (p1[0] < 0 && p1[1] < 0) {
        return {
          nw: handlers.nw,
          se: handlers.se,
        } as typeof handlers;
      }
    }

    return {
      n: handlers.n,
      s: handlers.s,
      w: handlers.w,
      e: handlers.e,
    } as typeof handlers;
  }

  return handlers;
}
