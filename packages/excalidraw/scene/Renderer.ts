import { isElementInViewport } from "../element/sizeHelpers";
import { isImageElement } from "../element/typeChecks";
import {
  NonDeletedElementsMap,
  NonDeletedExcalidrawElement,
} from "../element/types";
import { cancelRender } from "../renderer/renderScene";
import { AppState } from "../types";
import { memoize, toBrandedType } from "../utils";
import Scene from "./Scene";
import { RenderableElementsMap } from "./types";

export class Renderer {
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public getRenderableElements = (() => {
    const getVisibleCanvasElements = ({
      elementsMap,
      zoom,
      offsetLeft,
      offsetTop,
      scrollX,
      scrollY,
      height,
      width,
    }: {
      elementsMap: NonDeletedElementsMap;
      zoom: AppState["zoom"];
      offsetLeft: AppState["offsetLeft"];
      offsetTop: AppState["offsetTop"];
      scrollX: AppState["scrollX"];
      scrollY: AppState["scrollY"];
      height: AppState["height"];
      width: AppState["width"];
    }): readonly NonDeletedExcalidrawElement[] => {
      const visibleElements: NonDeletedExcalidrawElement[] = [];
      for (const element of elementsMap.values()) {
        if (
          isElementInViewport(element, width, height, {
            zoom,
            offsetLeft,
            offsetTop,
            scrollX,
            scrollY,
          })
        ) {
          visibleElements.push(element);
        }
      }
      return visibleElements;
    };

    const getRenderableElements = ({
      elements,
      editingElement,
      pendingImageElementId,
    }: {
      elements: readonly NonDeletedExcalidrawElement[];
      editingElement: AppState["editingElement"];
      pendingImageElementId: AppState["pendingImageElementId"];
    }) => {
      const elementsMap = toBrandedType<RenderableElementsMap>(new Map());

      for (const element of elements) {
        if (isImageElement(element)) {
          if (
            // => not placed on canvas yet (but in elements array)
            pendingImageElementId === element.id
          ) {
            continue;
          }
        }

        // we don't want to render text element that's being currently edited
        // (it's rendered on remote only)
        if (
          !editingElement ||
          editingElement.type !== "text" ||
          element.id !== editingElement.id
        ) {
          elementsMap.set(element.id, element);
        }
      }
      return elementsMap;
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

        const elementsMap = getRenderableElements({
          elements,
          editingElement,
          pendingImageElementId,
        });

        const visibleElements = getVisibleCanvasElements({
          elementsMap,
          zoom,
          offsetLeft,
          offsetTop,
          scrollX,
          scrollY,
          height,
          width,
        });

        return { elementsMap, visibleElements };
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
