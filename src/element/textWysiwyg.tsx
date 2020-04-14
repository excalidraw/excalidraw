import { KEYS } from "../keys";
import { selectNode, isWritableElement } from "../utils";
import { globalSceneState } from "../scene";
import { isTextElement } from "./typeChecks";
import { CLASSES } from "../constants";

function trimText(text: string) {
  // whitespace only → trim all because we'd end up inserting invisible element
  if (!text.trim()) {
    return "";
  }
  // replace leading/trailing newlines (only) otherwise it messes up bounding
  //  box calculation (there's also a bug in FF which inserts trailing newline
  //  for multiline texts)
  return text.replace(/^\n+|\n+$/g, "");
}

type TextWysiwygParams = {
  id: string;
  initText: string;
  x: number;
  y: number;
  strokeColor: string;
  font: string;
  opacity: number;
  zoom: number;
  angle: number;
  textAlign: string;
  onChange?: (text: string) => void;
  onSubmit: (text: string) => void;
  onCancel: () => void;
};

export function textWysiwyg({
  id,
  initText,
  x,
  y,
  strokeColor,
  font,
  opacity,
  zoom,
  angle,
  onChange,
  textAlign,
  onSubmit,
  onCancel,
}: TextWysiwygParams) {
  const editable = document.createElement("div");
  try {
    editable.contentEditable = "plaintext-only";
  } catch {
    editable.contentEditable = "true";
  }
  editable.dir = "auto";
  editable.tabIndex = 0;
  editable.innerText = initText;
  editable.dataset.type = "wysiwyg";

  const degree = (180 * angle) / Math.PI;

  Object.assign(editable.style, {
    color: strokeColor,
    position: "fixed",
    opacity: opacity / 100,
    top: `${y}px`,
    left: `${x}px`,
    transform: `translate(-50%, -50%) scale(${zoom}) rotate(${degree}deg)`,
    textAlign: textAlign,
    display: "inline-block",
    font: font,
    padding: "4px",
    // This needs to have "1px solid" otherwise the carret doesn't show up
    // the first time on Safari and Chrome!
    outline: "1px solid transparent",
    whiteSpace: "nowrap",
    minHeight: "1em",
    backfaceVisibility: "hidden",
  });

  editable.onpaste = (event) => {
    try {
      const selection = window.getSelection();
      if (!selection?.rangeCount) {
        return;
      }
      selection.deleteFromDocument();

      const text = event.clipboardData!.getData("text").replace(/\r\n?/g, "\n");

      const span = document.createElement("span");
      span.innerText = text;
      const range = selection.getRangeAt(0);
      range.insertNode(span);

      // deselect
      window.getSelection()!.removeAllRanges();
      range.setStart(span, span.childNodes.length);
      range.setEnd(span, span.childNodes.length);
      selection.addRange(range);

      event.preventDefault();
    } catch (error) {
      console.error(error);
    }
  };

  if (onChange) {
    editable.oninput = () => {
      onChange(trimText(editable.innerText));
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

  function stopEvent(event: Event) {
    event.stopPropagation();
  }

  function handleSubmit() {
    if (editable.innerText) {
      onSubmit(trimText(editable.innerText));
    } else {
      onCancel();
    }
    cleanup();
  }

  function cleanup() {
    if (isDestroyed) {
      return;
    }
    isDestroyed = true;
    // remove events to ensure they don't late-fire
    editable.onblur = null;
    editable.onpaste = null;
    editable.oninput = null;
    editable.onkeydown = null;

    window.removeEventListener("wheel", stopEvent, true);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", rebindBlur);
    window.removeEventListener("blur", handleSubmit);

    unbindUpdate();

    document.body.removeChild(editable);
  }

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
      Object.assign(editable.style, {
        font: editingElement.font,
        textAlign: editingElement.textAlign,
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
  selectNode(editable);
}
