import { KEYS } from "../index";

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
  editable.contentEditable = "plaintext-only";
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
    whiteSpace: "nowrap"
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
    window.removeEventListener("wheel", stopEvent, true);
    document.body.removeChild(editable);
  }

  window.addEventListener("wheel", stopEvent, true);
  document.body.appendChild(editable);
  editable.focus();
  const selection = window.getSelection();
  if (selection) {
    const range = document.createRange();
    range.selectNodeContents(editable);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}
