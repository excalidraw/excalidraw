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
  const input = document.createElement("input");
  input.value = initText;
  Object.assign(input.style, {
    color: strokeColor,
    position: "absolute",
    top: y - 8 + "px",
    left: x + "px",
    transform: "translate(-50%, -50%)",
    boxShadow: "none",
    textAlign: "center",
    width: (window.innerWidth - x) * 2 + "px",
    font: font,
    border: "none",
    background: "transparent"
  });

  input.onkeydown = ev => {
    if (ev.key === KEYS.ESCAPE) {
      ev.preventDefault();
      cleanup();
      return;
    }
    if (ev.key === KEYS.ENTER) {
      ev.preventDefault();
      handleSubmit();
    }
  };
  input.onblur = handleSubmit;

  function stopEvent(ev: Event) {
    ev.stopPropagation();
  }

  function handleSubmit() {
    if (input.value) {
      onSubmit(input.value);
    }
    cleanup();
  }

  function cleanup() {
    input.onblur = null;
    input.onkeydown = null;
    window.removeEventListener("wheel", stopEvent, true);
    document.body.removeChild(input);
  }

  window.addEventListener("wheel", stopEvent, true);
  document.body.appendChild(input);
  input.focus();
  input.select();
}
