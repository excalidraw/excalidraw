import { ExcalidrawElement } from "./types";
import { SceneState } from "../scene/types";

import { handlerRectangles } from "./handlerRectangles";

type HandlerRectanglesRet = keyof ReturnType<typeof handlerRectangles>;

export function resizeTest(
  element: ExcalidrawElement,
  x: number,
  y: number,
  sceneState: SceneState
): HandlerRectanglesRet | false {
  if (element.type === "text") return false;

  const handlers = handlerRectangles(element, sceneState);

  const filter = Object.keys(handlers).filter(key => {
    const handler = handlers[key as HandlerRectanglesRet]!;

    return (
      x + sceneState.scrollX >= handler[0] &&
      x + sceneState.scrollX <= handler[0] + handler[2] &&
      y + sceneState.scrollY >= handler[1] &&
      y + sceneState.scrollY <= handler[1] + handler[3]
    );
  });

  if (filter.length > 0) {
    return filter[0] as HandlerRectanglesRet;
  }

  return false;
}
