import { CODES, KEYS } from "../keys";
import {
  isWritableElement,
  getFontString,
  getFontFamilyString,
  isTestEnv,
} from "../utils";
import Scene from "../scene/Scene";
import {
  isArrowElement,
  isBoundToContainer,
  isTextElement,
} from "./typeChecks";
import { CLASSES, isSafari, VERTICAL_ALIGN } from "../constants";
import {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElementWithContainer,
  ExcalidrawTextElement,
  ExcalidrawTextContainer,
} from "./types";
import { AppState } from "../types";
import { mutateElement } from "./mutateElement";
import {
  getBoundTextElementId,
  getContainerCoords,
  getContainerDims,
  getContainerElement,
  getTextElementAngle,
  getTextWidth,
  measureText,
  normalizeText,
  redrawTextBoundingBox,
  wrapText,
  getBoundTextMaxHeight,
  getBoundTextMaxWidth,
  computeContainerDimensionForBoundText,
  detectLineHeight,
} from "./textElement";
import {
  actionDecreaseFontSize,
  actionIncreaseFontSize,
} from "../actions/actionProperties";
import { actionZoomIn, actionZoomOut } from "../actions/actionCanvas";
import App from "../components/App";
import { LinearElementEditor } from "./linearElementEditor";
import { parseClipboard } from "../clipboard";

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

const originalContainerCache: {
  [id: ExcalidrawTextContainer["id"]]:
    | {
        height: ExcalidrawTextContainer["height"];
      }
    | undefined;
} = {};

export const updateOriginalContainerCache = (
  id: ExcalidrawTextContainer["id"],
  height: ExcalidrawTextContainer["height"],
) => {
  const data =
    originalContainerCache[id] || (originalContainerCache[id] = { height });
  data.height = height;
  return data;
};

export const resetOriginalContainerCache = (
  id: ExcalidrawTextContainer["id"],
) => {
  if (originalContainerCache[id]) {
    delete originalContainerCache[id];
  }
};

export const getOriginalContainerHeightFromCache = (
  id: ExcalidrawTextContainer["id"],
) => {
  return originalContainerCache[id]?.height ?? null;
};

export const textWysiwyg = ({
  id,
  onChange,
  onSubmit,
  getViewportCoords,
  element,
  canvas,
  excalidrawContainer,
  app,
}: {
  id: ExcalidrawElement["id"];
  onChange?: (text: string) => void;
  onSubmit: (data: {
    text: string;
    viaKeyboard: boolean;
    originalText: string;
  }) => void;
  getViewportCoords: (x: number, y: number) => [number, number];
  element: ExcalidrawTextElement;
  canvas: HTMLCanvasElement | null;
  excalidrawContainer: HTMLDivElement | null;
  app: App;
}) => {
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
    const updatedTextElement =
      Scene.getScene(element)?.getElement<ExcalidrawTextElement>(id);

    if (!updatedTextElement) {
      return;
    }
    const { textAlign, verticalAlign } = updatedTextElement;

    if (updatedTextElement && isTextElement(updatedTextElement)) {
      let coordX = updatedTextElement.x;
      let coordY = updatedTextElement.y;
      const container = getContainerElement(updatedTextElement);
      let maxWidth = updatedTextElement.width;

      let maxHeight = updatedTextElement.height;
      let textElementWidth = updatedTextElement.width;
      // Set to element height by default since that's
      // what is going to be used for unbounded text
      let textElementHeight = updatedTextElement.height;

      if (container && updatedTextElement.containerId) {
        if (isArrowElement(container)) {
          const boundTextCoords =
            LinearElementEditor.getBoundTextElementPosition(
              container,
              updatedTextElement as ExcalidrawTextElementWithContainer,
            );
          coordX = boundTextCoords.x;
          coordY = boundTextCoords.y;
        }
        const propertiesUpdated = textPropertiesUpdated(
          updatedTextElement,
          editable,
        );
        const containerDims = getContainerDims(container);
        // using editor.style.height to get the accurate height of text editor
        const editorHeight = Number(editable.style.height.slice(0, -2));
        if (editorHeight > 0) {
          textElementHeight = editorHeight;
        }
        if (propertiesUpdated) {
          // update height of the editor after properties updated
          textElementHeight = updatedTextElement.height;
        }

        let originalContainerData;
        if (propertiesUpdated) {
          originalContainerData = updateOriginalContainerCache(
            container.id,
            containerDims.height,
          );
        } else {
          originalContainerData = originalContainerCache[container.id];
          if (!originalContainerData) {
            originalContainerData = updateOriginalContainerCache(
              container.id,
              containerDims.height,
            );
          }
        }

        maxWidth = getBoundTextMaxWidth(container);
        maxHeight = getBoundTextMaxHeight(
          container,
          updatedTextElement as ExcalidrawTextElementWithContainer,
        );

        // autogrow container height if text exceeds
        if (!isArrowElement(container) && textElementHeight > maxHeight) {
          const targetContainerHeight = computeContainerDimensionForBoundText(
            textElementHeight,
            container.type,
          );

          mutateElement(container, { height: targetContainerHeight });
          return;
        } else if (
          // autoshrink container height until original container height
          // is reached when text is removed
          !isArrowElement(container) &&
          containerDims.height > originalContainerData.height &&
          textElementHeight < maxHeight
        ) {
          const targetContainerHeight = computeContainerDimensionForBoundText(
            textElementHeight,
            container.type,
          );
          mutateElement(container, { height: targetContainerHeight });
        }
        // Start pushing text upward until a diff of 30px (padding)
        // is reached
        else {
          const containerCoords = getContainerCoords(container);

          // vertically center align the text
          if (verticalAlign === VERTICAL_ALIGN.MIDDLE) {
            if (!isArrowElement(container)) {
              coordY =
                containerCoords.y + maxHeight / 2 - textElementHeight / 2;
            }
          }
          if (verticalAlign === VERTICAL_ALIGN.BOTTOM) {
            coordY = containerCoords.y + (maxHeight - textElementHeight);
          }
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
        textElementWidth = Math.min(textElementWidth, maxWidth);
      } else {
        textElementWidth += 0.5;
      }

      let lineHeight = updatedTextElement.lineHeight;

      // In Safari the font size gets rounded off when rendering hence calculating the line height by rounding off font size
      if (isSafari) {
        lineHeight = detectLineHeight({
          ...updatedTextElement,
          fontSize: Math.round(updatedTextElement.fontSize),
        });
      }

      // Make sure text editor height doesn't go beyond viewport
      const editorMaxHeight =
        (appState.height - viewportY) / appState.zoom.value;
      Object.assign(editable.style, {
        font: getFontString(updatedTextElement),
        // must be defined *after* font ¯\_(ツ)_/¯
        lineHeight,
        width: `${textElementWidth}px`,
        height: `${textElementHeight}px`,
        left: `${viewportX}px`,
        top: `${viewportY}px`,
        transform: getTransform(
          textElementWidth,
          textElementHeight,
          getTextElementAngle(updatedTextElement),
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
      mutateElement(updatedTextElement, { x: coordX, y: coordY });
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

  if (isBoundToContainer(element)) {
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
      const container = getContainerElement(element);

      const font = getFontString({
        fontSize: app.state.currentItemFontSize,
        fontFamily: app.state.currentItemFontFamily,
      });
      if (container) {
        const wrappedText = wrapText(
          `${editable.value}${data}`,
          font,
          getBoundTextMaxWidth(container),
        );
        const width = getTextWidth(wrappedText, font);
        editable.style.width = `${width}px`;
      }
    };

    editable.oninput = () => {
      const updatedTextElement = Scene.getScene(element)?.getElement(
        id,
      ) as ExcalidrawTextElement;
      const font = getFontString(updatedTextElement);
      if (isBoundToContainer(element)) {
        const container = getContainerElement(element);
        const wrappedText = wrapText(
          normalizeText(editable.value),
          font,
          getBoundTextMaxWidth(container!),
        );
        const { width, height } = measureText(
          wrappedText,
          font,
          updatedTextElement.lineHeight,
        );
        editable.style.width = `${width}px`;
        editable.style.height = `${height}px`;
      }
      onChange(normalizeText(editable.value));
    };
  }

  editable.onkeydown = (event) => {
    if (!event.shiftKey && actionZoomIn.keyTest(event)) {
      event.preventDefault();
      app.actionManager.executeAction(actionZoomIn);
      updateWysiwygStyle();
    } else if (!event.shiftKey && actionZoomOut.keyTest(event)) {
      event.preventDefault();
      app.actionManager.executeAction(actionZoomOut);
      updateWysiwygStyle();
    } else if (actionDecreaseFontSize.keyTest(event)) {
      app.actionManager.executeAction(actionDecreaseFontSize);
    } else if (actionIncreaseFontSize.keyTest(event)) {
      app.actionManager.executeAction(actionIncreaseFontSize);
    } else if (event.key === KEYS.ESCAPE) {
      event.preventDefault();
      submittedViaKeyboard = true;
      handleSubmit();
    } else if (event.key === KEYS.ENTER && event[KEYS.CTRL_OR_CMD]) {
      event.preventDefault();
      if (event.isComposing || event.keyCode === 229) {
        return;
      }
      submittedViaKeyboard = true;
      handleSubmit();
    } else if (
      event.key === KEYS.TAB ||
      (event[KEYS.CTRL_OR_CMD] &&
        (event.code === CODES.BRACKET_LEFT ||
          event.code === CODES.BRACKET_RIGHT))
    ) {
      event.preventDefault();
      if (event.isComposing) {
        return;
      } else if (event.shiftKey || event.code === CODES.BRACKET_LEFT) {
        outdent();
      } else {
        indent();
      }
      // We must send an input event to resize the element
      editable.dispatchEvent(new Event("input"));
    }
  };

  const TAB_SIZE = 4;
  const TAB = " ".repeat(TAB_SIZE);
  const RE_LEADING_TAB = new RegExp(`^ {1,${TAB_SIZE}}`);
  const indent = () => {
    const { selectionStart, selectionEnd } = editable;
    const linesStartIndices = getSelectedLinesStartIndices();

    let value = editable.value;
    linesStartIndices.forEach((startIndex: number) => {
      const startValue = value.slice(0, startIndex);
      const endValue = value.slice(startIndex);

      value = `${startValue}${TAB}${endValue}`;
    });

    editable.value = value;

    editable.selectionStart = selectionStart + TAB_SIZE;
    editable.selectionEnd = selectionEnd + TAB_SIZE * linesStartIndices.length;
  };

  const outdent = () => {
    const { selectionStart, selectionEnd } = editable;
    const linesStartIndices = getSelectedLinesStartIndices();
    const removedTabs: number[] = [];

    let value = editable.value;
    linesStartIndices.forEach((startIndex) => {
      const tabMatch = value
        .slice(startIndex, startIndex + TAB_SIZE)
        .match(RE_LEADING_TAB);

      if (tabMatch) {
        const startValue = value.slice(0, startIndex);
        const endValue = value.slice(startIndex + tabMatch[0].length);

        // Delete a tab from the line
        value = `${startValue}${endValue}`;
        removedTabs.push(startIndex);
      }
    });

    editable.value = value;

    if (removedTabs.length) {
      if (selectionStart > removedTabs[removedTabs.length - 1]) {
        editable.selectionStart = Math.max(
          selectionStart - TAB_SIZE,
          removedTabs[removedTabs.length - 1],
        );
      } else {
        // If the cursor is before the first tab removed, ex:
        // Line| #1
        //     Line #2
        // Lin|e #3
        // we should reset the selectionStart to his initial value.
        editable.selectionStart = selectionStart;
      }
      editable.selectionEnd = Math.max(
        editable.selectionStart,
        selectionEnd - TAB_SIZE * removedTabs.length,
      );
    }
  };

  /**
   * @returns indices of start positions of selected lines, in reverse order
   */
  const getSelectedLinesStartIndices = () => {
    let { selectionStart, selectionEnd, value } = editable;

    // chars before selectionStart on the same line
    const startOffset = value.slice(0, selectionStart).match(/[^\n]*$/)![0]
      .length;
    // put caret at the start of the line
    selectionStart = selectionStart - startOffset;

    const selected = value.slice(selectionStart, selectionEnd);

    return selected
      .split("\n")
      .reduce(
        (startIndices, line, idx, lines) =>
          startIndices.concat(
            idx
              ? // curr line index is prev line's start + prev line's length + \n
                startIndices[idx - 1] + lines[idx - 1].length + 1
              : // first selected line
                selectionStart,
          ),
        [] as number[],
      )
      .reverse();
  };

  const stopEvent = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  // using a state variable instead of passing it to the handleSubmit callback
  // so that we don't need to create separate a callback for event handlers
  let submittedViaKeyboard = false;
  const handleSubmit = () => {
    // cleanup must be run before onSubmit otherwise when app blurs the wysiwyg
    // it'd get stuck in an infinite loop of blur→onSubmit after we re-focus the
    // wysiwyg on update
    cleanup();
    const updateElement = Scene.getScene(element)?.getElement(
      element.id,
    ) as ExcalidrawTextElement;
    if (!updateElement) {
      return;
    }
    let text = editable.value;
    const container = getContainerElement(updateElement);

    if (container) {
      text = updateElement.text;
      if (editable.value.trim()) {
        const boundTextElementId = getBoundTextElementId(container);
        if (!boundTextElementId || boundTextElementId !== element.id) {
          mutateElement(container, {
            boundElements: (container.boundElements || []).concat({
              type: "text",
              id: element.id,
            }),
          });
        }
      } else {
        mutateElement(container, {
          boundElements: container.boundElements?.filter(
            (ele) =>
              !isTextElement(
                ele as ExcalidrawTextElement | ExcalidrawLinearElement,
              ),
          ),
        });
      }
      redrawTextBoundingBox(updateElement, container);
    }

    onSubmit({
      text,
      viaKeyboard: submittedViaKeyboard,
      originalText: editable.value,
    });
  };

  const cleanup = () => {
    if (isDestroyed) {
      return;
    }
    isDestroyed = true;
    // remove events to ensure they don't late-fire
    editable.onblur = null;
    editable.oninput = null;
    editable.onkeydown = null;

    if (observer) {
      observer.disconnect();
    }

    window.removeEventListener("resize", updateWysiwygStyle);
    window.removeEventListener("wheel", stopEvent, true);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", bindBlurEvent);
    window.removeEventListener("blur", handleSubmit);

    unbindUpdate();

    editable.remove();
  };

  const bindBlurEvent = (event?: MouseEvent) => {
    window.removeEventListener("pointerup", bindBlurEvent);
    // Deferred so that the pointerdown that initiates the wysiwyg doesn't
    // trigger the blur on ensuing pointerup.
    // Also to handle cases such as picking a color which would trigger a blur
    // in that same tick.
    const target = event?.target;

    const isTargetPickerTrigger =
      target instanceof HTMLElement &&
      target.classList.contains("active-color");

    setTimeout(() => {
      editable.onblur = handleSubmit;

      if (isTargetPickerTrigger) {
        const callback = (
          mutationList: MutationRecord[],
          observer: MutationObserver,
        ) => {
          const radixIsRemoved = mutationList.find(
            (mutation) =>
              mutation.removedNodes.length > 0 &&
              (mutation.removedNodes[0] as HTMLElement).dataset
                ?.radixPopperContentWrapper !== undefined,
          );

          if (radixIsRemoved) {
            // should work without this in theory
            // and i think it does actually but radix probably somewhere,
            // somehow sets the focus elsewhere
            setTimeout(() => {
              editable.focus();
            });

            observer.disconnect();
          }
        };

        const observer = new MutationObserver(callback);

        observer.observe(document.querySelector(".excalidraw-container")!, {
          childList: true,
        });
      }

      // case: clicking on the same property → no change → no update → no focus
      if (!isTargetPickerTrigger) {
        editable.focus();
      }
    });
  };

  // prevent blur when changing properties from the menu
  const onPointerDown = (event: MouseEvent) => {
    const isTargetPickerTrigger =
      event.target instanceof HTMLElement &&
      event.target.classList.contains("active-color");

    if (
      ((event.target instanceof HTMLElement ||
        event.target instanceof SVGElement) &&
        event.target.closest(`.${CLASSES.SHAPE_ACTIONS_MENU}`) &&
        !isWritableElement(event.target)) ||
      isTargetPickerTrigger
    ) {
      editable.onblur = null;
      window.addEventListener("pointerup", bindBlurEvent);
      // handle edge-case where pointerup doesn't fire e.g. due to user
      // alt-tabbing away
      window.addEventListener("blur", handleSubmit);
    }
  };

  // handle updates of textElement properties of editing element
  const unbindUpdate = Scene.getScene(element)!.addCallback(() => {
    updateWysiwygStyle();
    const isColorPickerActive = !!document.activeElement?.closest(
      ".color-picker-content",
    );
    if (!isColorPickerActive) {
      editable.focus();
    }
  });

  // ---------------------------------------------------------------------------

  let isDestroyed = false;

  // select on init (focusing is done separately inside the bindBlurEvent()
  // because we need it to happen *after* the blur event from `pointerdown`)
  editable.select();
  bindBlurEvent();

  // reposition wysiwyg in case of canvas is resized. Using ResizeObserver
  // is preferred so we catch changes from host, where window may not resize.
  let observer: ResizeObserver | null = null;
  if (canvas && "ResizeObserver" in window) {
    observer = new window.ResizeObserver(() => {
      updateWysiwygStyle();
    });
    observer.observe(canvas);
  } else {
    window.addEventListener("resize", updateWysiwygStyle);
  }

  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("wheel", stopEvent, {
    passive: false,
    capture: true,
  });
  excalidrawContainer
    ?.querySelector(".excalidraw-textEditorContainer")!
    .appendChild(editable);
};
