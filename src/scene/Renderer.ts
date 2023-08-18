import { isElementInViewport } from "../element/sizeHelpers";
import { isImageElement } from "../element/typeChecks";
import { NonDeletedExcalidrawElement } from "../element/types";
import { cancelRender } from "../renderer/renderScene";
import { AppState } from "../types";
import { memoize } from "../utils";
import Scene from "./Scene";

export class Renderer {
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public getRenderableElements = (() => {
    const getVisibleCanvasElements = ({
      elements,
      zoom,
      offsetLeft,
      offsetTop,
      scrollX,
      scrollY,
      height,
      width,
    }: {
      elements: readonly NonDeletedExcalidrawElement[];
      zoom: AppState["zoom"];
      offsetLeft: AppState["offsetLeft"];
      offsetTop: AppState["offsetTop"];
      scrollX: AppState["scrollX"];
      scrollY: AppState["scrollY"];
      height: AppState["height"];
      width: AppState["width"];
    }): readonly NonDeletedExcalidrawElement[] => {
      return elements.filter((element) =>
        isElementInViewport(element, width, height, {
          zoom,
          offsetLeft,
          offsetTop,
          scrollX,
          scrollY,
        }),
      );
    };

    const getCanvasElements = ({
      editingElement,
      elements,
      pendingImageElementId,
    }: {
      elements: readonly NonDeletedExcalidrawElement[];
      editingElement: AppState["editingElement"];
      pendingImageElementId: AppState["pendingImageElementId"];
    }) => {
      return elements.filter((element) => {
        if (isImageElement(element)) {
          if (
            // => not placed on canvas yet (but in elements array)
            pendingImageElementId === element.id
          ) {
            return false;
          }
        }
        // we don't want to render text element that's being currently edited
        // (it's rendered on remote only)
        return (
          !editingElement ||
          editingElement.type !== "text" ||
          element.id !== editingElement.id
        );
      });
    };

    return memoize(
      ({
        zoom,
        offsetLeft,
        offsetTop,
        scrollX,
        scrollY,
        height,
        width,
        editingElement,
        pendingImageElementId,
        // unused but serves we cache on it to invalidate elements if they
        // get mutated
        versionNonce: _versionNonce,
      }: {
        zoom: AppState["zoom"];
        offsetLeft: AppState["offsetLeft"];
        offsetTop: AppState["offsetTop"];
        scrollX: AppState["scrollX"];
        scrollY: AppState["scrollY"];
        height: AppState["height"];
        width: AppState["width"];
        editingElement: AppState["editingElement"];
        pendingImageElementId: AppState["pendingImageElementId"];
        versionNonce: ReturnType<InstanceType<typeof Scene>["getVersionNonce"]>;
      }) => {
        const elements = this.scene.getNonDeletedElements();

        const canvasElements = getCanvasElements({
          elements,
          editingElement,
          pendingImageElementId,
        });

        const visibleElements = getVisibleCanvasElements({
          elements: canvasElements,
          zoom,
          offsetLeft,
          offsetTop,
          scrollX,
          scrollY,
          height,
          width,
        });

        return { canvasElements, visibleElements };
      },
    );
  })();

  // NOTE Doesn't destroy everything (scene, rc, etc.) because it may not be
  // safe to break TS contract here (for upstream cases)
  public destroy() {
    cancelRender();
    this.getRenderableElements.clear();
  }
}
