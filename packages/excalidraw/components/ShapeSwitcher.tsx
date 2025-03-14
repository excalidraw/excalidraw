// render the shape switcher div on top of the canvas at the selected element's position

import { THEME } from "../constants";
import type { ExcalidrawElement } from "../element/types";
import type { AppState } from "../types";
import { sceneCoordsToViewportCoords } from "../utils";

const ShapeSwitcher = ({
  appState,
  element,
}: {
  appState: AppState;
  element: ExcalidrawElement;
  elements: readonly ExcalidrawElement[];
}) => {
  const isDarkTheme = appState.theme === THEME.DARK;
  const { x, y } = sceneCoordsToViewportCoords(
    {
      sceneX: element.x,
      sceneY: element.y,
    },
    appState,
  );

  return (
    <div
      style={{
        position: "absolute",
        bottom: `${appState.height - y + appState.offsetTop}px`,
        left: `${x - appState.offsetLeft}px`,
        backgroundColor: isDarkTheme
          ? "rgba(0, 0, 0, 0.9)"
          : "rgba(255, 255, 255, 0.9)",
      }}
    ></div>
  );
};

export default ShapeSwitcher;
