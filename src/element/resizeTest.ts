import { ExcalidrawElement } from "./types";
import { SceneState } from "../scene/types";

import { handlerRectangles } from "./handlerRectangles";

export function resizeTest(
  element: ExcalidrawElement,
  x: number,
  y: number,
  sceneState: SceneState
): string | false {
  if (element.type === "text") return false;

  const handlers = handlerRectangles(element, sceneState);

  const filter = Object.keys(handlers).filter(key => {
    const handler = handlers[key];

    return (
      x + sceneState.scrollX >= handler[0] &&
      x + sceneState.scrollX <= handler[0] + handler[2] &&
      y + sceneState.scrollY >= handler[1] &&
      y + sceneState.scrollY <= handler[1] + handler[3]
    );
  });

  if (filter.length > 0) {
    return filter[0];
  }

  return false;
}
