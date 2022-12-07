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
import { CLASSES, VERTICAL_ALIGN } from "../constants";
import {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElementWithContainer,
  ExcalidrawTextElement,
} from "./types";
import { AppState } from "../types";
import { mutateElement } from "./mutateElement";
import {
  getApproxLineHeight,
  getBoundTextElementId,
  getBoundTextElementOffset,
  getContainerDims,
  getContainerElement,
  getTextElementAngle,
  normalizeText,
  wrapText,
} from "./textElement";
import {
  actionDecreaseFontSize,
  actionIncreaseFontSize,
} from "../actions/actionProperties";
import { actionZoomIn, actionZoomOut } from "../actions/actionCanvas";
import App from "../components/App";
import { getMaxContainerHeight, getMaxContainerWidth } from "./newElement";
import { LinearElementEditor } from "./linearElementEditor";

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
  let originalContainerHeight: number;

  const updateWysiwygStyle = () => {
    const appState = app.state;
    const updatedTextElement =
      Scene.getScene(element)?.getElement<ExcalidrawTextElement>(id);
    if (!updatedTextElement) {
      return;
    }
    const { textAlign, verticalAlign } = updatedTextElement;

    const approxLineHeight = getApproxLineHeight(
      getFontString(updatedTextElement),
    );
    if (updatedTextElement && isTextElement(updatedTextElement)) {
      let coordX = updatedTextElement.x;
      let coordY = updatedTextElement.y;
      const container = getContainerElement(updatedTextElement);
      let maxWidth = updatedTextElement.width;

      let maxHeight = updatedTextElement.height;
      const width = updatedTextElement.width;
      // Set to element height by default since that's
      // what is going to be used for unbounded text
      let height = updatedTextElement.height;
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
          height = editorHeight;
        }
        if (propertiesUpdated) {
          originalContainerHeight = containerDims.height;

          // update height of the editor after properties updated
          height = updatedTextElement.height;
        }
        if (!originalContainerHeight) {
          originalContainerHeight = containerDims.height;
        }
        maxWidth = getMaxContainerWidth(container);
        maxHeight = getMaxContainerHeight(container);

        // autogrow container height if text exceeds

        if (!isArrowElement(container) && height > maxHeight) {
          const diff = Math.min(height - maxHeight, approxLineHeight);
          mutateElement(container, { height: containerDims.height + diff });
          return;
        } else if (
          // autoshrink container height until original container height
          // is reached when text is removed
          !isArrowElement(container) &&
          containerDims.height > originalContainerHeight &&
          height < maxHeight
        ) {
          const diff = Math.min(maxHeight - height, approxLineHeight);
          mutateElement(container, { height: containerDims.height - diff });
        }
        // Start pushing text upward until a diff of 30px (padding)
        // is reached
        else {
          // vertically center align the text
          if (verticalAlign === VERTICAL_ALIGN.MIDDLE) {
            if (!isArrowElement(container)) {
              coordY = container.y + containerDims.height / 2 - height / 2;
            }
          }
          if (verticalAlign === VERTICAL_ALIGN.BOTTOM) {
            coordY =
              container.y +
              containerDims.height -
              height -
              getBoundTextElementOffset(updatedTextElement);
          }
        }
      }
      const [viewportX, viewportY] = getViewportCoords(coordX, coordY);
      const initialSelectionStart = editable.selectionStart;
      const initialSelectionEnd = editable.selectionEnd;
      const initialLength = editable.value.length;
      editable.value = updatedTextElement.originalText;

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

      const lines = updatedTextElement.originalText.split("\n");
      const lineHeight = updatedTextElement.containerId
        ? approxLineHeight
        : updatedTextElement.height / lines.length;
      if (!container) {
        maxWidth = (appState.width - 8 - viewportX) / appState.zoom.value;
      }

      // Make sure text editor height doesn't go beyond viewport
      const editorMaxHeight =
        (appState.height - viewportY) / appState.zoom.value;

      Object.assign(editable.style, {
        font: getFontString(updatedTextElement),
        // must be defined *after* font ¯\_(ツ)_/¯
        lineHeight: `${lineHeight}px`,
        width: `${Math.min(width, maxWidth)}px`,
        height: `${height}px`,
        left: `${viewportX}px`,
        top: `${viewportY}px`,
        transform: getTransform(
          width,
          height,
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
  const isContainerArrow = isArrowElement(getContainerElement(element));
  const background = isContainerArrow ? "#fff" : "transparent";
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
    background,
    overflow: "hidden",
    // must be specified because in dark mode canvas creates a stacking context
    zIndex: "var(--zIndex-wysiwyg)",
    wordBreak,
    // prevent line wrapping (`whitespace: nowrap` doesn't work on FF)
    whiteSpace,
    overflowWrap: "break-word",
    boxSizing: "content-box",
  });
  updateWysiwygStyle();

  if (onChange) {
    editable.oninput = () => {
      const updatedTextElement = Scene.getScene(element)?.getElement(
        id,
      ) as ExcalidrawTextElement;
      const font = getFontString(updatedTextElement);
      // using scrollHeight here since we need to calculate
      // number of lines so cannot use editable.style.height
      // as that gets updated below
      // Rounding here so that the lines calculated is more accurate in all browsers.
      // The scrollHeight and approxLineHeight differs in diff browsers
      // eg it gives 1.05 in firefox for handewritten small font due to which
      // height gets updated as lines > 1 and leads to jumping text for first line in bound container
      // hence rounding here to avoid that
      const lines = Math.round(
        editable.scrollHeight / getApproxLineHeight(font),
      );
      // auto increase height only when lines  > 1 so its
      // measured correctly and vertically aligns for
      // first line as well as setting height to "auto"
      // doubles the height as soon as user starts typing
      if (isBoundToContainer(element) && lines > 1) {
        let height = "auto";
        editable.style.height = "0px";
        let heightSet = false;
        if (lines === 2) {
          const container = getContainerElement(element);
          const actualLineCount = wrapText(
            editable.value,
            font,
            getMaxContainerWidth(container!),
          ).split("\n").length;
          // This is browser behaviour when setting height to "auto"
          // It sets the height needed for 2 lines even if actual
          // line count is 1 as mentioned above as well
          // hence reducing the height by half if actual line count is 1
          // so single line aligns vertically when deleting
          if (actualLineCount === 1) {
            height = `${editable.scrollHeight / 2}px`;
            editable.style.height = height;
            heightSet = true;
          }
        }
        if (!heightSet) {
          editable.style.height = `${editable.scrollHeight}px`;
        }
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
      if (event.shiftKey || event.code === CODES.BRACKET_LEFT) {
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

    const isTargetColorPicker =
      target instanceof HTMLInputElement &&
      target.closest(".color-picker-input") &&
      isWritableElement(target);

    setTimeout(() => {
      editable.onblur = handleSubmit;
      if (target && isTargetColorPicker) {
        target.onblur = () => {
          editable.focus();
        };
      }
      // case: clicking on the same property → no change → no update → no focus
      if (!isTargetColorPicker) {
        editable.focus();
      }
    });
  };

  // prevent blur when changing properties from the menu
  const onPointerDown = (event: MouseEvent) => {
    const isTargetColorPicker =
      event.target instanceof HTMLInputElement &&
      event.target.closest(".color-picker-input") &&
      isWritableElement(event.target);
    if (
      ((event.target instanceof HTMLElement ||
        event.target instanceof SVGElement) &&
        event.target.closest(`.${CLASSES.SHAPE_ACTIONS_MENU}`) &&
        !isWritableElement(event.target)) ||
      isTargetColorPicker
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
      ".color-picker-input",
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
