import { NonDeletedExcalidrawElement } from "../element/types";
import { CanvasUIRenderConfig } from "../scene/types";

export const renderSelectionElement = (
  element: NonDeletedExcalidrawElement,
  context: CanvasRenderingContext2D,
  renderConfig: CanvasUIRenderConfig,
) => {
  switch (element.type) {
    case "selection": {
      context.save();
      context.translate(
        element.x + renderConfig.scrollX,
        element.y + renderConfig.scrollY,
      );
      context.fillStyle = "rgba(0, 0, 200, 0.04)";

      // render from 0.5px offset  to get 1px wide line
      // https://stackoverflow.com/questions/7530593/html5-canvas-and-line-width/7531540#7531540
      // TODO can be be improved by offseting to the negative when user selects
      // from right to left
      const offset = 0.5 / renderConfig.zoom.value;

      context.fillRect(offset, offset, element.width, element.height);
      context.lineWidth = 1 / renderConfig.zoom.value;
      context.strokeStyle = "rgb(105, 101, 219)";
      context.strokeRect(offset, offset, element.width, element.height);

      context.restore();
      break;
    }
    default: {
      // @ts-ignore
      throw new Error(`Unimplemented type ${element.type}`);
    }
  }
};
