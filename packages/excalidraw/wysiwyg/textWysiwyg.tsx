import {
  CODES,
  KEYS,
  CLASSES,
  POINTER_BUTTON,
  isWritableElement,
  getFontString,
  getFontFamilyString,
  isTestEnv,
} from "@excalidraw/common";
import {
  originalContainerCache,
  updateOriginalContainerCache,
} from "@excalidraw/element";
import { LinearElementEditor } from "@excalidraw/element";
import { bumpVersion } from "@excalidraw/element";
import {
  getBoundTextElementId,
  getContainerElement,
  getTextElementAngle,
  redrawTextBoundingBox,
  getBoundTextMaxHeight,
  getBoundTextMaxWidth,
  computeContainerDimensionForBoundText,
  computeBoundTextPosition,
  getBoundTextElement,
} from "@excalidraw/element";
import { getTextWidth } from "@excalidraw/element";
import { normalizeText } from "@excalidraw/element";
import { wrapText } from "@excalidraw/element";
import {
  isArrowElement,
  isBoundToContainer,
  isTextElement,
} from "@excalidraw/element";
import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElementWithContainer,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";
import { actionSaveToActiveFile } from "../actions";
import { parseClipboard } from "../clipboard";
import {
  actionDecreaseFontSize,
  actionIncreaseFontSize,
} from "../actions/actionProperties";
import {
  actionResetZoom,
  actionZoomIn,
  actionZoomOut,
} from "../actions/actionCanvas";
import type App from "../components/App";
import type { AppState } from "../types";

const getTransform = (
  width: number,
  height: number,
  angle: number,
  appState: AppState,
  maxWidth: number,
  maxHeight: number,
) => {
  const { zoom } = appState;
  const degree = (180 * angle) / Math.PI;
  let translateX = (width * (zoom.value - 1)) / 2;
  let translateY = (height * (zoom.value - 1)) / 2;
  if (width > maxWidth && zoom.value !== 1) {
    translateX = (maxWidth * (zoom.value - 1)) / 2;
  }
  if (height > maxHeight && zoom.value !== 1) {
    translateY = (maxHeight * (zoom.value - 1)) / 2;
  }
  return `translate(${translateX}px, ${translateY}px) scale(${zoom.value}) rotate(${degree}deg)`;
};

type SubmitHandler = () => void;

export const textWysiwyg = ({
  id,
  onChange,
  onSubmit,
  getViewportCoords,
  element,
  canvas,
  excalidrawContainer,
  app,
  autoSelect = true,
}: {
  id: ExcalidrawElement["id"];
  /**
   * textWysiwyg only deals with `originalText`
   *
   * Note: `text`, which can be wrapped and therefore different from `originalText`,
   *       is derived from `originalText`
   */
  onChange?: (nextOriginalText: string) => void;
  onSubmit: (data: { viaKeyboard: boolean; nextOriginalText: string }) => void;
  getViewportCoords: (x: number, y: number) => [number, number];
  element: ExcalidrawTextElement;
  canvas: HTMLCanvasElement;
  excalidrawContainer: HTMLDivElement | null;
  app: App;
  autoSelect?: boolean;
}): SubmitHandler => {
  const textPropertiesUpdated = (
    updatedTextElement: ExcalidrawTextElement,
    editable: HTMLTextAreaElement,
  ) => {
    if (!editable.style.fontFamily || !editable.style.fontSize) {
      return false;
    }
    const currentFont = editable.style.fontFamily.replace(/"/g, "");
    if (
      getFontFamilyString({ fontFamily: updatedTextElement.fontFamily }) !==
      currentFont
    ) {
      return true;
    }
    if (`${updatedTextElement.fontSize}px` !== editable.style.fontSize) {
      return true;
    }
    return false;
  };

  const updateWysiwygStyle = () => {
    const appState = app.state;
    const updatedTextElement = app.scene.getElement<ExcalidrawTextElement>(id);
    if (!updatedTextElement) {
      return;
    }
    const { textAlign, verticalAlign } = updatedTextElement;
    const elementsMap = app.scene.getNonDeletedElementsMap();
    if (updatedTextElement && isTextElement(updatedTextElement)) {
      let coordX = updatedTextElement.x;
      let coordY = updatedTextElement.y;
      const container = getContainerElement(
        updatedTextElement,
        app.scene.getNonDeletedElementsMap(),
      );
      let width = updatedTextElement.width;
      // set to element height by default since that's
      // what is going to be used for unbounded text
      let height = updatedTextElement.height;
      let maxWidth = updatedTextElement.width;
      let maxHeight = updatedTextElement.height;
      if (container && updatedTextElement.containerId) {
        if (isArrowElement(container)) {
          const boundTextCoords =
            LinearElementEditor.getBoundTextElementPosition(
              container,
              updatedTextElement as ExcalidrawTextElementWithContainer,
              elementsMap,
            );
          coordX = boundTextCoords.x;
          coordY = boundTextCoords.y;
        }
        const propertiesUpdated = textPropertiesUpdated(
          updatedTextElement,
          editable,
        );
        let originalContainerData;
        if (propertiesUpdated) {
          originalContainerData = updateOriginalContainerCache(
            container.id,
            container.height,
          );
        } else {
          originalContainerData = originalContainerCache[container.id];
          if (!originalContainerData) {
            originalContainerData = updateOriginalContainerCache(
              container.id,
              container.height,
            );
          }
        }
        maxWidth = getBoundTextMaxWidth(container, updatedTextElement);
        maxHeight = getBoundTextMaxHeight(
          container,
          updatedTextElement as ExcalidrawTextElementWithContainer,
        );
        // autogrow container height if text exceeds
        if (!isArrowElement(container) && height > maxHeight) {
          const targetContainerHeight = computeContainerDimensionForBoundText(
            height,
            container.type,
          );
          app.scene.mutateElement(container, { height: targetContainerHeight });
          return;
        } else if (
          // autoshrink container height until original container height
          // is reached when text is removed
          !isArrowElement(container) &&
          container.height > originalContainerData.height &&
          height < maxHeight
        ) {
          const targetContainerHeight = computeContainerDimensionForBoundText(
            height,
            container.type,
          );
          app.scene.mutateElement(container, { height: targetContainerHeight });
        } else {
          const { y } = computeBoundTextPosition(
            container,
            updatedTextElement as ExcalidrawTextElementWithContainer,
            elementsMap,
          );
          coordY = y;
        }
      }
      const [viewportX, viewportY] = getViewportCoords(coordX, coordY);
      const initialSelectionStart = editable.selectionStart;
      const initialSelectionEnd = editable.selectionEnd;
      const initialLength = editable.value.length;
      // restore cursor position after value updated so it doesn't
      // go to the end of text when container auto expanded
      if (
        initialSelectionStart === initialSelectionEnd &&
        initialSelectionEnd !== initialLength
      ) {
        // get diff between length and selection end and shift
        // the cursor by "diff" times to position correctly
        const diff = initialLength - initialSelectionEnd;
        editable.selectionStart = editable.value.length - diff;
        editable.selectionEnd = editable.value.length - diff;
      }
      if (!container) {
        maxWidth = (appState.width - 8 - viewportX) / appState.zoom.value;
        width = Math.min(width, maxWidth);
      } else {
        width += 0.5;
      }
      // add 5% buffer otherwise it causes wysiwyg to jump
      height *= 1.05;
      const font = getFontString(updatedTextElement);
      // Make sure text editor height doesn't go beyond viewport
      const editorMaxHeight =
        (appState.height - viewportY) / appState.zoom.value;
      Object.assign(editable.style, {
        font,
        // must be defined *after* font ¯\_(ツ)_/¯
        lineHeight: updatedTextElement.lineHeight,
        width: `${width}px`,
        height: `${height}px`,
        left: `${viewportX}px`,
        top: `${viewportY}px`,
        transform: getTransform(
          width,
          height,
          getTextElementAngle(updatedTextElement, container),
          appState,
          maxWidth,
          editorMaxHeight,
        ),
        textAlign,
        verticalAlign,
        color: updatedTextElement.strokeColor,
        opacity: updatedTextElement.opacity / 100,
        filter: "var(--theme-filter)",
        maxHeight: `${editorMaxHeight}px`,
      });
      editable.scrollTop = 0;
      // For some reason updating font attribute doesn't set font family
      // hence updating font family explicitly for test environment
      if (isTestEnv()) {
        editable.style.fontFamily = getFontFamilyString(updatedTextElement);
      }
      app.scene.mutateElement(updatedTextElement, { x: coordX, y: coordY });
    }
  };

  const editable = document.createElement("textarea");
  editable.dir = "auto";
  editable.tabIndex = 0;
  editable.dataset.type = "wysiwyg";
  // prevent line wrapping on Safari
  editable.wrap = "off";
  editable.classList.add("excalidraw-wysiwyg");

  let whiteSpace = "pre";
  let wordBreak = "normal";
  if (isBoundToContainer(element) || !element.autoResize) {
    whiteSpace = "pre-wrap";
    wordBreak = "break-word";
  }
  Object.assign(editable.style, {
    position: "absolute",
    display: "inline-block",
    minHeight: "1em",
    backfaceVisibility: "hidden",
    margin: 0,
    padding: 0,
    border: 0,
    outline: 0,
    resize: "none",
    background: "transparent",
    overflow: "hidden",
    // must be specified because in dark mode canvas creates a stacking context
    zIndex: "var(--zIndex-wysiwyg)",
    wordBreak,
    // prevent line wrapping (`whitespace: nowrap` doesn't work on FF)
    whiteSpace,
    overflowWrap: "break-word",
    boxSizing: "content-box",
  });

  editable.value = element.originalText;
  updateWysiwygStyle();

  if (onChange) {
    editable.onpaste = async (event) => {
      const clipboardData = await parseClipboard(event, true);
      if (!clipboardData.text) {
        return;
      }
      const data = normalizeText(clipboardData.text);
      if (!data) {
        return;
      }
      const container = getContainerElement(
        element,
        app.scene.getNonDeletedElementsMap(),
      );
      const font = getFontString({
        fontSize: app.state.currentItemFontSize,
        fontFamily: app.state.currentItemFontFamily,
      });
      if (container) {
        const boundTextElement = getBoundTextElement(
          container,
          app.scene.getNonDeletedElementsMap(),
        );
        const wrappedText = wrapText(
          `${editable.value}${data}`,
          font,
          getBoundTextMaxWidth(container, boundTextElement),
        );
        const width = getTextWidth(wrappedText, font);
        editable.style.width = `${width}px`;
      }
    };
    editable.oninput = () => {
      const normalized = normalizeText(editable.value);
      if (editable.value !== normalized) {
        const selectionStart = editable.selectionStart;
        editable.value = normalized;
        // put the cursor at some position close to where it was before
        // normalization (otherwise it'll end up at the end of the text)
        editable.selectionStart = selectionStart;
        editable.selectionEnd = selectionStart;
      }
      onChange(editable.value);
    };
  }

  // Helper function to get the leading whitespace from a line
  const getLeadingWhitespace = (line: string): string => {
    const match = line.match(/^[\s\t]*/);
    return match ? match[0] : "";
  };

  editable.onkeydown = (event) => {
    if (!event.shiftKey && actionZoomIn.keyTest(event)) {
      event.preventDefault();
      app.actionManager.executeAction(actionZoomIn);
      updateWysiwygStyle();
    } else if (!
