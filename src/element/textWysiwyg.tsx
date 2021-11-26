import { CODES, KEYS } from "../keys";
import {
  isWritableElement,
  getFontString,
  wrapText,
  viewportCoordsToSceneCoords,
  getApproxLineHeight,
} from "../utils";
import Scene from "../scene/Scene";
import { isTextElement } from "./typeChecks";
import { CLASSES } from "../constants";
import { ExcalidrawElement } from "./types";
import { AppState } from "../types";
import { mutateElement } from "./mutateElement";

const PADDING = 30;

const normalizeText = (text: string) => {
  return (
    text
      // replace tabs with spaces so they render and measure correctly
      .replace(/\t/g, "        ")
      // normalize newlines
      .replace(/\r?\n|\r/g, "\n")
  );
};

const getTransform = (
  width: number,
  height: number,
  angle: number,
  appState: AppState,
  maxWidth: number,
) => {
  const { zoom, offsetTop, offsetLeft } = appState;
  const degree = (180 * angle) / Math.PI;
  // offsets must be multiplied by 2 to account for the division by 2 of
  // the whole expression afterwards
  let translateX = ((width - offsetLeft * 2) * (zoom.value - 1)) / 2;
  const translateY = ((height - offsetTop * 2) * (zoom.value - 1)) / 2;
  if (width > maxWidth && zoom.value !== 1) {
    translateX = (maxWidth / 2) * (zoom.value - 1);
  }
  return `translate(${translateX}px, ${translateY}px) scale(${zoom.value}) rotate(${degree}deg)`;
};

export const textWysiwyg = ({
  id,
  appState,
  onChange,
  onSubmit,
  getViewportCoords,
  element,
  canvas,
  excalidrawContainer,
}: {
  id: ExcalidrawElement["id"];
  appState: AppState;
  onChange?: (text: string) => void;
  onSubmit: (data: { text: string; viaKeyboard: boolean }) => void;
  getViewportCoords: (x: number, y: number) => [number, number];
  element: ExcalidrawElement;
  canvas: HTMLCanvasElement | null;
  excalidrawContainer: HTMLDivElement | null;
}) => {
  let originalContainerHeight: number;

  //@ts-ignore
  const approxLineHeight = getApproxLineHeight(getFontString(element));

  const updateWysiwygStyle = () => {
    const updatedElement = Scene.getScene(element)?.getElement(id);

    if (updatedElement && isTextElement(updatedElement)) {
      let coordX = updatedElement.x;
      let coordY = updatedElement.y;
      const textContainer = updatedElement?.textContainerId
        ? Scene.getScene(updatedElement)!.getElement(
            updatedElement.textContainerId,
          )
        : null;
      let maxWidth = updatedElement.width;

      let maxHeight = updatedElement.height;
      let width = updatedElement.width;
      let height = updatedElement.height;
      if (textContainer) {
        if (!originalContainerHeight) {
          originalContainerHeight = textContainer.height;
        }
        maxWidth = textContainer.width - PADDING * 2;
        maxHeight = textContainer.height - PADDING * 2;
        width = maxWidth;
        height = Math.min(height, maxHeight);
      }

      if (textContainer) {
        // The coordinates of text box set a distance of
        // 30px to preserve padding
        coordX = textContainer.x + PADDING;

        if (editable.clientHeight >= maxHeight) {
          coordY = textContainer.y + PADDING;
        }
        // autogrow container height if text exceeds
        if (editable.clientHeight > maxHeight) {
          const diff = Math.min(
            editable.clientHeight - maxHeight,
            approxLineHeight,
          );
          mutateElement(textContainer, { height: textContainer.height + diff });
          return;
        } else if (
          // autoshrink container height until original container height
          // is reached when text is removed
          textContainer.height > originalContainerHeight &&
          editable.clientHeight < maxHeight
        ) {
          const diff = Math.min(
            maxHeight - editable.clientHeight,
            approxLineHeight,
          );
          mutateElement(textContainer, { height: textContainer.height - diff });
          return;
        } else if (
          // Start pushing text upward until a diff of 30px (padding)
          // is reached
          editable.clientHeight > maxHeight / 2 &&
          editable.clientHeight !== maxHeight
        ) {
          const lineCount = editable.clientHeight / approxLineHeight;

          // lines beyond maxwidth/2 are considered extra lines as
          // we don't need t to update coordy until then
          const extraLines = Math.floor(
            lineCount - maxHeight / 2 / approxLineHeight,
          );

          const { y: currentCoordY } = viewportCoordsToSceneCoords(
            {
              clientX: Number(editable.style.left.slice(0, -2)),
              clientY: Number(editable.style.top.slice(0, -2)),
            },
            appState,
          );

          // Since we need to maintain padding hence thats the max
          // limit of y coord
          const newCoordY = Math.max(
            coordY - approxLineHeight * extraLines,
            textContainer.y + PADDING,
          );
          if (newCoordY < currentCoordY) {
            coordY = newCoordY;
          } else {
            coordY = currentCoordY;
          }
        }
      }

      const [viewportX, viewportY] = getViewportCoords(coordX, coordY);
      const { textAlign, angle } = updatedElement;

      editable.value = updatedElement.text;
      const lines = updatedElement.text.split("\n");
      const lineHeight = updatedElement.textContainerId
        ? approxLineHeight
        : updatedElement.height / lines.length;
      if (!textContainer) {
        maxWidth =
          (appState.offsetLeft + appState.width - viewportX - 8) /
            appState.zoom.value -
          // margin-right of parent if any
          Number(
            getComputedStyle(
              excalidrawContainer?.parentNode as Element,
            ).marginRight.slice(0, -2),
          );
      }
      Object.assign(editable.style, {
        font: getFontString(updatedElement),
        // must be defined *after* font ¯\_(ツ)_/¯
        lineHeight: `${lineHeight}px`,
        width: `${width}px`,
        height: `${Math.max(editable.clientHeight, updatedElement.height)}px`,
        left: `${viewportX}px`,
        top: `${viewportY}px`,
        transform: getTransform(width, height, angle, appState, maxWidth),
        textAlign,
        color: updatedElement.strokeColor,
        opacity: updatedElement.opacity / 100,
        filter: "var(--theme-filter)",
        maxWidth: `${maxWidth}px`,
      });
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
  if (element.type === "text") {
    whiteSpace = element.textContainerId ? "pre-wrap" : "pre";
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
    overflowWrap: "break-word",
    // prevent line wrapping (`whitespace: nowrap` doesn't work on FF)
    whiteSpace,
    // must be specified because in dark mode canvas creates a stacking context
    zIndex: "var(--zIndex-wysiwyg)",
  });
  updateWysiwygStyle();

  if (onChange) {
    editable.oninput = () => {
      editable.style.height = "auto";
      editable.style.height = `${editable.scrollHeight}px`;
      onChange(normalizeText(editable.value));
    };
  }

  editable.onkeydown = (event) => {
    event.stopPropagation();
    if (event.key === KEYS.ESCAPE) {
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
   * @returns indeces of start positions of selected lines, in reverse order
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
    let wrappedText = "";
    if (element.type === "text" && element?.textContainerId) {
      const textContainer = Scene.getScene(element)!.getElement(
        element.textContainerId,
      );

      if (textContainer && textContainer.type === "rectangle") {
        wrappedText = wrapText(
          editable.value,
          getFontString(element),
          textContainer,
        );
        const { x, y } = viewportCoordsToSceneCoords(
          {
            clientX: Number(editable.style.left.slice(0, -2)),
            clientY: Number(editable.style.top.slice(0, -2)),
          },
          appState,
        );
        if (element.type === "text" && element.textContainerId) {
          mutateElement(element, {
            y,
            height: Number(editable.style.height.slice(0, -2)),
            width: Number(editable.style.width.slice(0, -2)),
            x,
          });

          mutateElement(textContainer, { boundTextElement: element.id });
        }
      }
    } else {
      wrappedText = editable.value;
    }

    onSubmit({
      text: normalizeText(wrappedText),
      viaKeyboard: submittedViaKeyboard,
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

  const bindBlurEvent = () => {
    window.removeEventListener("pointerup", bindBlurEvent);
    // Deferred so that the pointerdown that initiates the wysiwyg doesn't
    // trigger the blur on ensuing pointerup.
    // Also to handle cases such as picking a color which would trigger a blur
    // in that same tick.
    setTimeout(() => {
      editable.onblur = handleSubmit;
      // case: clicking on the same property → no change → no update → no focus
      editable.focus();
    });
  };

  // prevent blur when changing properties from the menu
  const onPointerDown = (event: MouseEvent) => {
    if (
      (event.target instanceof HTMLElement ||
        event.target instanceof SVGElement) &&
      event.target.closest(`.${CLASSES.SHAPE_ACTIONS_MENU}`) &&
      !isWritableElement(event.target)
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
    editable.focus();
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
