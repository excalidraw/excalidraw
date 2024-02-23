import { RoughSVG } from "roughjs/bin/svg";
import { isFrameLikeElement, isIframeLikeElement } from "../element/typeChecks";
import { NonDeletedExcalidrawElement } from "../element/types";
import { RenderableElementsMap, SVGRenderConfig } from "../scene/types";
import { BinaryFiles } from "../types";
import { renderElementToSvg } from "./renderElement";

export const renderSceneToSvg = (
  elements: readonly NonDeletedExcalidrawElement[],
  elementsMap: RenderableElementsMap,
  rsvg: RoughSVG,
  svgRoot: SVGElement,
  files: BinaryFiles,
  renderConfig: SVGRenderConfig,
) => {
  if (!svgRoot) {
    return;
  }

  // render elements
  elements
    .filter((el) => !isFrameLikeElement(el))
    .forEach((element) => {
      if (!element.isDeleted) {
        try {
          renderElementToSvg(
            element,
            elementsMap,
            rsvg,
            svgRoot,
            files,
            element.x + renderConfig.offsetX,
            element.y + renderConfig.offsetY,
            renderConfig,
          );
        } catch (error: any) {
          console.error(error);
        }
      }
    });

  // render embeddables on top
  elements
    .filter((el) => isIframeLikeElement(el))
    .forEach((element) => {
      if (!element.isDeleted) {
        try {
          renderElementToSvg(
            element,
            elementsMap,
            rsvg,
            svgRoot,
            files,
            element.x + renderConfig.offsetX,
            element.y + renderConfig.offsetY,
            renderConfig,
          );
        } catch (error: any) {
          console.error(error);
        }
      }
    });
};
