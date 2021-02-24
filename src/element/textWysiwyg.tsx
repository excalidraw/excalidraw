import { KEYS } from "../keys";
import { isWritableElement, getFontString } from "../utils";
import Scene from "../scene/Scene";
import { isTextElement } from "./typeChecks";
import { CLASSES } from "../constants";
import { ExcalidrawElement } from "./types";
import { AppState } from "../types";

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
) => {
  const { zoom, offsetTop, offsetLeft } = appState;
  const degree = (180 * angle) / Math.PI;
  // offsets must be multiplied by 2 to account for the division by 2 of
  // the whole expression afterwards
  return `translate(${((width - offsetLeft * 2) * (zoom.value - 1)) / 2}px, ${
    ((height - offsetTop * 2) * (zoom.value - 1)) / 2
  }px) scale(${zoom.value}) rotate(${degree}deg)`;
};

export const textWysiwyg = ({
  id,
  appState,
  onChange,
  onSubmit,
  getViewportCoords,
  element,
  canvas,
}: {
  id: ExcalidrawElement["id"];
  appState: AppState;
  onChange?: (text: string) => void;
  onSubmit: (text: string) => void;
  getViewportCoords: (x: number, y: number) => [number, number];
  element: ExcalidrawElement;
  canvas: HTMLCanvasElement | null;
}) => {
  const updateWysiwygStyle = () => {
    const updatedElement = Scene.getScene(element)?.getElement(id);
    if (updatedElement && isTextElement(updatedElement)) {
      const [viewportX, viewportY] = getViewportCoords(
        updatedElement.x,
        updatedElement.y,
      );
      const { textAlign, angle } = updatedElement;

      editable.value = updatedElement.text;

      const lines = updatedElement.text.replace(/\r\n?/g, "\n").split("\n");
      const lineHeight = updatedElement.height / lines.length;

      Object.assign(editable.style, {
        font: getFontString(updatedElement),
        // must be defined *after* font ¯\_(ツ)_/¯
        lineHeight: `${lineHeight}px`,
        width: `${updatedElement.width}px`,
        height: `${updatedElement.height}px`,
        left: `${viewportX}px`,
        top: `${viewportY}px`,
        transform: getTransform(
          updatedElement.width,
          updatedElement.height,
          angle,
          appState,
        ),
        textAlign,
        color: updatedElement.strokeColor,
        opacity: updatedElement.opacity / 100,
        filter: "var(--appearance-filter)",
      });
    }
  };

  const editable = document.createElement("textarea");

  editable.dir = "auto";
  editable.tabIndex = 0;
  editable.dataset.type = "wysiwyg";
  // prevent line wrapping on Safari
  editable.wrap = "off";

  Object.assign(editable.style, {
    position: "fixed",
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
    // prevent line wrapping (`whitespace: nowrap` doesn't work on FF)
    whiteSpace: "pre",
    // must be specified because in dark mode canvas creates a stacking context
    zIndex: "var(--zIndex-wysiwyg)",
  });

  updateWysiwygStyle();

  if (onChange) {
    editable.oninput = () => {
      onChange(normalizeText(editable.value));
    };
  }

  editable.onkeydown = (event) => {
    if (event.key === KEYS.ESCAPE) {
      event.preventDefault();
      handleSubmit();
    } else if (event.key === KEYS.ENTER && event[KEYS.CTRL_OR_CMD]) {
      event.preventDefault();
      if (event.isComposing || event.keyCode === 229) {
        return;
      }
      handleSubmit();
    } else if (event.key === KEYS.ENTER && !event.altKey) {
      event.stopPropagation();
    }
  };

  const stopEvent = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleSubmit = () => {
    onSubmit(normalizeText(editable.value));
    cleanup();
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
    window.removeEventListener("pointerup", rebindBlur);
    window.removeEventListener("blur", handleSubmit);

    unbindUpdate();

    editable.remove();
  };

  const rebindBlur = () => {
    window.removeEventListener("pointerup", rebindBlur);
    // deferred to guard against focus traps on various UIs that steal focus
    // upon pointerUp
    setTimeout(() => {
      editable.onblur = handleSubmit;
      // case: clicking on the same property → no change → no update → no focus
      editable.focus();
    });
  };

  // prevent blur when changing properties from the menu
  const onPointerDown = (event: MouseEvent) => {
    if (
      event.target instanceof HTMLElement &&
      event.target.closest(`.${CLASSES.SHAPE_ACTIONS_MENU}`) &&
      !isWritableElement(event.target)
    ) {
      editable.onblur = null;
      window.addEventListener("pointerup", rebindBlur);
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

  let isDestroyed = false;

  editable.onblur = handleSubmit;

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
  document
    .querySelector(".excalidraw-textEditorContainer")!
    .appendChild(editable);
  editable.focus();
  editable.select();
};
