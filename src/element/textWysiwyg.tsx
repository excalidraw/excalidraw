import { KEYS } from "../keys";
import { selectNode } from "../utils";

type TextWysiwygParams = {
  initText: string;
  x: number;
  y: number;
  strokeColor: string;
  font: string;
  onSubmit: (text: string) => void;
};

export function textWysiwyg({
  initText,
  x,
  y,
  strokeColor,
  font,
  onSubmit
}: TextWysiwygParams) {
  // Using contenteditable here as it has dynamic width.
  // But this solution has an issue — it allows to paste
  // multiline text, which is not currently supported
  const editable = document.createElement("div");
  editable.contentEditable = "true";
  editable.tabIndex = 0;
  editable.innerText = initText;
  editable.dataset.type = "wysiwyg";

  Object.assign(editable.style, {
    color: strokeColor,
    position: "absolute",
    top: y + "px",
    left: x + "px",
    transform: "translate(-50%, -50%)",
    textAlign: "center",
    display: "inline-block",
    font: font,
    padding: "4px",
    outline: "transparent",
    whiteSpace: "nowrap",
    minHeight: "1em"
  });

  editable.onkeydown = ev => {
    if (ev.key === KEYS.ESCAPE) {
      ev.preventDefault();
      if (initText) {
        editable.innerText = initText;
        handleSubmit();
        return;
      }
      cleanup();
      return;
    }
    if (ev.key === KEYS.ENTER) {
      ev.preventDefault();
      handleSubmit();
    }
  };
  editable.onblur = handleSubmit;
  // override paste to disallow non-textual data, and replace newlines
  editable.onpaste = ev => {
    ev.preventDefault();
    try {
      const text = ev.clipboardData!.getData("text").replace(/\n+/g, " ");
      editable.textContent = text;
    } catch {}
  };

  function stopEvent(ev: Event) {
    ev.stopPropagation();
  }

  function handleSubmit() {
    if (editable.innerText) {
      onSubmit(editable.innerText);
    }
    cleanup();
  }

  function cleanup() {
    editable.onblur = null;
    editable.onkeydown = null;
    editable.onpaste = null;
    window.removeEventListener("wheel", stopEvent, true);
    document.body.removeChild(editable);
  }

  window.addEventListener("wheel", stopEvent, true);
  document.body.appendChild(editable);
  editable.focus();
  selectNode(editable);
}
