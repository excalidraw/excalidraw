import { ExcalidrawElement } from "./types";
import { SceneScroll } from "../scene/types";
import { getArrowAbsoluteBounds } from "./bounds";

type Sides = "n" | "s" | "w" | "e" | "nw" | "ne" | "sw" | "se";

export function handlerRectangles(
  element: ExcalidrawElement,
  { scrollX, scrollY }: SceneScroll
) {
  let elementX2 = 0;
  let elementY2 = 0;
  let elementX1 = Infinity;
  let elementY1 = Infinity;
  let minimumSize = 40;
  if (element.type === "arrow") {
    [elementX1, elementY1, elementX2, elementY2] = getArrowAbsoluteBounds(
      element
    );
  } else {
    elementX1 = element.x;
    elementX2 = element.x + element.width;
    elementY1 = element.y;
    elementY2 = element.y + element.height;
  }

  const margin = 4;
  const handlers = {} as { [T in Sides]: number[] };

  const marginX = element.width < 0 ? 8 : -8;
  const marginY = element.height < 0 ? 8 : -8;

  if (Math.abs(elementX2 - elementX1) > minimumSize) {
    handlers["n"] = [
      elementX1 + (elementX2 - elementX1) / 2 + scrollX - 4,
      elementY1 - margin + scrollY + marginY,
      8,
      8
    ];

    handlers["s"] = [
      elementX1 + (elementX2 - elementX1) / 2 + scrollX - 4,
      elementY2 - margin + scrollY - marginY,
      8,
      8
    ];
  }

  if (Math.abs(elementY2 - elementY1) > minimumSize) {
    handlers["w"] = [
      elementX1 - margin + scrollX + marginX,
      elementY1 + (elementY2 - elementY1) / 2 + scrollY - 4,
      8,
      8
    ];

    handlers["e"] = [
      elementX2 - margin + scrollX - marginX,
      elementY1 + (elementY2 - elementY1) / 2 + scrollY - 4,
      8,
      8
    ];
  }

  handlers["nw"] = [
    elementX1 - margin + scrollX + marginX,
    elementY1 - margin + scrollY + marginY,
    8,
    8
  ]; // nw
  handlers["ne"] = [
    elementX2 - margin + scrollX - marginX,
    elementY1 - margin + scrollY + marginY,
    8,
    8
  ]; // ne
  handlers["sw"] = [
    elementX1 - margin + scrollX + marginX,
    elementY2 - margin + scrollY - marginY,
    8,
    8
  ]; // sw
  handlers["se"] = [
    elementX2 - margin + scrollX - marginX,
    elementY2 - margin + scrollY - marginY,
    8,
    8
  ]; // se

  if (element.type === "line") {
    return {
      nw: handlers.nw,
      se: handlers.se
    } as typeof handlers;
  } else if (element.type === "arrow") {
    return {
      n: handlers.n,
      s: handlers.s,
      w: handlers.w,
      e: handlers.e
    } as typeof handlers;
  }

  return handlers;
}
