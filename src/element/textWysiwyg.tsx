import { KEYS } from "../keys";
import { isWritableElement, getFontString } from "../utils";
import { globalSceneState } from "../scene";
import { isTextElement } from "./typeChecks";
import { CLASSES } from "../constants";
import { TextAlign, VerticalAlign, ExcalidrawTextElement } from "./types";

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
  textAlign: TextAlign,
  verticalAlign: VerticalAlign,
  angle: number,
  zoom: number,
) => {
  const degree = (180 * angle) / Math.PI;
  return `translate(${(width * (zoom - 1)) / 2}px, ${
    (height * (zoom - 1)) / 2
  }px) scale(${zoom}) rotate(${degree}deg)`;
};

export const textWysiwyg = (
  element: ExcalidrawTextElement,
  {
    zoom,
    onChange,
    onSubmit,
    onCancel,
    getViewportCoords,
  }: {
    zoom: number;
    onChange?: (text: string) => void;
    onSubmit: (text: string) => void;
    onCancel: () => void;
    getViewportCoords: (x: number, y: number) => [number, number];
  },
) => {
  const {
    id,
    x,
    y,
    text,
    width,
    height,
    strokeColor,
    fontSize,
    fontFamily,
    opacity,
    angle,
    textAlign,
    verticalAlign,
  } = element;

  function getPositions(element: {
    width: number;
    x: number;
    y: number;
    textAlign: TextAlign;
  }): { left: string; top: string } {
    const [viewportX, viewportY] = getViewportCoords(element.x, element.y);
    return {
      left: `${viewportX}px`,
      top: `${viewportY}px`,
    };
  }

  const editable = document.createElement("textarea");

  editable.dir = "auto";
  editable.tabIndex = 0;
  editable.value = text;
  editable.dataset.type = "wysiwyg";
  // prevent line wrapping on Safari
  editable.wrap = "off";

  const { left, top } = getPositions({ textAlign, x, y, width });

  Object.assign(editable.style, {
    color: strokeColor,
    opacity: opacity / 100,
    position: "fixed",
    top,
    left,
    width: `${width}px`,
    height: `${height}px`,
    transform: getTransform(
      width,
      height,
      textAlign,
      verticalAlign,
      angle,
      zoom,
    ),
    textAlign: textAlign,
    display: "inline-block",
    font: getFontString({ fontSize, fontFamily }),
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
  });

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
    event.stopPropagation();
  };

  const handleSubmit = () => {
    if (editable.value) {
      onSubmit(normalizeText(editable.value));
    } else {
      onCancel();
    }
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

    window.removeEventListener("wheel", stopEvent, true);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", rebindBlur);
    window.removeEventListener("blur", handleSubmit);

    unbindUpdate();

    document.body.removeChild(editable);
  };

  const rebindBlur = () => {
    window.removeEventListener("pointerup", rebindBlur);
    // deferred to guard against focus traps on various UIs that steal focus
    //  upon pointerUp
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
      //  alt-tabbing away
      window.addEventListener("blur", handleSubmit);
    }
  };

  // handle updates of textElement properties of editing element
  const unbindUpdate = globalSceneState.addCallback(() => {
    const editingElement = globalSceneState
      .getElementsIncludingDeleted()
      .find((element) => element.id === id);
    if (editingElement && isTextElement(editingElement)) {
      const { left, top } = getPositions(editingElement);
      const { textAlign, verticalAlign, angle } = editingElement;

      editable.value = editingElement.text;

      Object.assign(editable.style, {
        font: getFontString(editingElement),
        width: `${editingElement.width}px`,
        height: `${editingElement.height}px`,
        top,
        left,
        transform: getTransform(
          editingElement.width,
          editingElement.height,
          textAlign,
          verticalAlign,
          angle,
          zoom,
        ),
        textAlign: textAlign,
        color: editingElement.strokeColor,
        opacity: editingElement.opacity / 100,
      });
    }
    editable.focus();
  });

  let isDestroyed = false;

  editable.onblur = handleSubmit;
  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("wheel", stopEvent, true);
  document.body.appendChild(editable);
  editable.focus();
  editable.select();
};
