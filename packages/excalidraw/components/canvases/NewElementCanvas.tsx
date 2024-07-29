import { useEffect } from "react";
import type {
  ExcalidrawElement,
  NonDeletedSceneElementsMap,
} from "../../element/types";
import { t } from "../../i18n";
import type { AppState } from "../../types";
import type {
  RenderableElementsMap,
  StaticCanvasRenderConfig,
} from "../../scene/types";
import type { RoughCanvas } from "roughjs/bin/canvas";
import { renderNewElementScene } from "../../renderer/renderNewElementScene";

interface NewElementCanvasProps {
  newElement: ExcalidrawElement | null;
  canvas: HTMLCanvasElement | null;
  appState: AppState;
  elementsMap: RenderableElementsMap;
  allElementsMap: NonDeletedSceneElementsMap;
  scale: number;
  rc: RoughCanvas;
  renderConfig: StaticCanvasRenderConfig;
  handleCanvasRef: (canvas: HTMLCanvasElement | null) => void;
}

const NewElementCanvas = (props: NewElementCanvasProps) => {
  // handle collab

  useEffect(() => {
    renderNewElementScene({
      canvas: props.canvas,
      scale: props.scale,
      newElement: props.newElement,
      elementsMap: props.elementsMap,
      allElementsMap: props.allElementsMap,
      rc: props.rc,
      renderConfig: props.renderConfig,
      appState: props.appState,
    });
  });

  return (
    <canvas
      style={{
        width: props.appState.width,
        height: props.appState.height,
      }}
      width={props.appState.width * props.scale}
      height={props.appState.height * props.scale}
      ref={props.handleCanvasRef}
    >
      {t("labels.newElementCanvas")}
    </canvas>
  );
};

export default NewElementCanvas;
