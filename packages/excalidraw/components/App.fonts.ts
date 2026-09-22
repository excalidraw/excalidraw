import { getFontString } from "@excalidraw/common";

import {
  CaptureUpdateAction,
  charWidth,
  isNonDeletedElement,
  isTextElement,
  updateBoundElements,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { remeasureTextElements } from "../data/restore";
import { Fonts } from "../fonts";

import type App from "./App";

/**
 * Owns font loading on behalf of the scene, and the correction of text
 * bounds that were measured before the fonts they need were loaded. Only
 * text entering the scene through paste or file import, or typed into the
 * editor, is corrected; text arriving any other way (initial data, host
 * `updateScene`, collab) keeps the bounds it came with.
 */
export class AppFonts {
  constructor(private app: App) {}

  /**
   * Loads the fonts of the initial scene explicitly — faster than waiting for
   * `loadingdone` even in browsers that do fire it.
   */
  loadSceneFonts = () => {
    this.app.fonts.loadSceneFonts().then((fontFaces) => {
      this.app.fonts.onLoaded(fontFaces);
    });
  };

  /**
   * Rerenders text elements once font faces land (#637, #1553).
   */
  handleLoadingDone = (event: Event) => {
    const fontFaces = (event as FontFaceSetLoadEvent).fontfaces;
    this.app.fonts.onLoaded(fontFaces);
  };

  /**
   * Font loading for one text editing session. Typed text may need font
   * subsets (e.g. CJK) that only load now, so the text gets wrapped with
   * fallback metrics first; the session loads what the latest text needs
   * and reflows the element once the faces arrive.
   *
   * @param element the text element being edited
   * @param reflow re-wraps the element in the scene from its original text
   */
  createEditSession = (
    element: ExcalidrawTextElement,
    reflow: (originalText: string) => void,
  ) => {
    let isEditing = true;
    const pendingFontLoads = new Map<string, Promise<unknown>>();

    const remeasureOnceFontLoads = (nextOriginalText: string) => {
      const latestTextElement =
        this.app.scene.getElement<ExcalidrawTextElement>(element.id);
      if (!latestTextElement || !nextOriginalText) {
        return;
      }
      const font = getFontString(latestTextElement);
      if (
        pendingFontLoads.has(font) ||
        this.app.ownerDocument.fonts.check(font, nextOriginalText)
      ) {
        return;
      }
      pendingFontLoads.set(
        font,
        this.app.ownerDocument.fonts
          .load(font, nextOriginalText)
          .then((fontFaces) => {
            pendingFontLoads.delete(font);
            if (!isEditing) {
              return;
            }
            const currentTextElement =
              this.app.scene.getElement<ExcalidrawTextElement>(element.id);
            if (!currentTextElement || currentTextElement.isDeleted) {
              return;
            }
            // drop the fallback glyph widths before wrapping again
            charWidth.clearCache(font);
            this.app.fonts.onLoaded(fontFaces);
            reflow(currentTextElement.originalText);
            if (isNonDeletedElement(element)) {
              updateBoundElements(element, this.app.scene);
            }
            // text typed while this load was in flight may need subsets this
            // load didn't cover — re-check once against the latest text
            remeasureOnceFontLoads(currentTextElement.originalText);
          })
          .catch((error) => {
            pendingFontLoads.delete(font);
            console.error(error);
          }),
      );
    };

    return {
      /** call with the text as it is typed */
      onChange: remeasureOnceFontLoads,
      /** call on submit; loads still in flight then leave the element alone */
      end: () => {
        isEditing = false;
      },
    };
  };

  /**
   * Loads the fonts the given (pasted or imported) text elements need and
   * remeasures them with the local metrics once the faces arrive.
   */
  remeasureTextOnceLoaded = (elements: readonly ExcalidrawElement[]) => {
    const text = elements.filter((element) =>
      isTextElement(element),
    ) as ExcalidrawTextElement[];
    if (!text.length) {
      return;
    }
    Fonts.loadElementsFonts(text, this.app.ownerDocument)
      .then((fontFaces) => {
        // only the faces that had to be loaded come back
        if (!fontFaces.length) {
          return;
        }
        // drops the fallback glyph widths and rerenders — or bails when the
        // `loadingdone` listener got there first, which cleared them as well
        this.app.fonts.onLoaded(fontFaces);
        this.remeasureText(new Set(text.map((element) => element.id)));
      })
      .catch((error) => console.error(error));
  };

  /**
   * Remeasures the given text elements with the local font metrics.
   */
  private remeasureText = (
    elementIds: ReadonlySet<ExcalidrawElement["id"]>,
  ) => {
    this.app.setState({}, () => {
      const editingTextElementId = this.app.state.editingTextElement?.id;

      const remeasuredElements = remeasureTextElements(
        this.app.scene.getElementsIncludingDeleted(),
        (element) =>
          elementIds.has(element.id) && element.id !== editingTextElementId,
      );

      if (remeasuredElements) {
        this.app.updateScene({
          elements: remeasuredElements,
          captureUpdate: CaptureUpdateAction.NEVER,
        });
      }
    });
  };
}
