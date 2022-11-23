import { isTextElement, refreshTextDimensions } from "../element";
import { newElementWith } from "../element/mutateElement";
import { ExcalidrawElement, ExcalidrawTextElement } from "../element/types";
import { invalidateShapeForElement } from "../renderer/renderElement";
import { getFontString } from "../utils";
import type Scene from "./Scene";

export class Fonts {
  private scene: Scene;
  private onSceneUpdated: () => void;

  constructor({
    scene,
    onSceneUpdated,
  }: {
    scene: Scene;
    onSceneUpdated: () => void;
  }) {
    this.scene = scene;
    this.onSceneUpdated = onSceneUpdated;
  }

  // it's ok to track fonts across multiple instances only once, so let's use
  // a static member to reduce memory footprint
  private static loadedFontFaces = new Set<string>();

  /**
   * if we load a (new) font, it's likely that text elements using it have
   * already been rendered using a fallback font. Thus, we want invalidate
   * their shapes and rerender. See #637.
   *
   * Invalidates text elements and rerenders scene, provided that at least one
   * of the supplied fontFaces has not already been processed.
   */
  public onFontsLoaded = (fontFaces: readonly FontFace[]) => {
    if (
      // bail if all fonts with have been processed. We're checking just a
      // subset of the font properties (though it should be enough), so it
      // can technically bail on a false positive.
      fontFaces.every((fontFace) => {
        const sig = `${fontFace.family}-${fontFace.style}-${fontFace.weight}`;
        if (Fonts.loadedFontFaces.has(sig)) {
          return true;
        }
        Fonts.loadedFontFaces.add(sig);
        return false;
      })
    ) {
      return false;
    }

    let didUpdate = false;

    this.scene.mapElements((element) => {
      if (isTextElement(element)) {
        invalidateShapeForElement(element);
        didUpdate = true;
        return newElementWith(element, {
          ...refreshTextDimensions(element),
        });
      }
      return element;
    });

    if (didUpdate) {
      this.onSceneUpdated();
    }
  };

  public loadFontsForElements = async (
    elements: readonly ExcalidrawElement[],
  ) => {
    const fontFaces = await Promise.all(
      [
        ...new Set(
          elements
            .filter((element) => isTextElement(element))
            .map((element) => (element as ExcalidrawTextElement).fontFamily),
        ),
      ].map((fontFamily) => {
        const fontString = getFontString({
          fontFamily,
          fontSize: 16,
        });
        if (!document.fonts?.check?.(fontString)) {
          return document.fonts?.load?.(fontString);
        }
        return undefined;
      }),
    );
    this.onFontsLoaded(fontFaces.flat().filter(Boolean) as FontFace[]);
  };
}
