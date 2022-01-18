import { EVENT } from "../constants";
import { AppState } from "../types";
import { sceneCoordsToViewportCoords } from "../utils";
import { mutateElement } from "./mutateElement";
import { ExcalidrawTextElement } from "./types";

import "./hyperlink.scss";
import Scene from "../scene/Scene";
const PREFIX = "https://";

export const hyperlink = ({
  textElement,
  appState,
  excalidrawContainer,
}: {
  textElement: ExcalidrawTextElement;
  appState: AppState;
  excalidrawContainer: HTMLDivElement | null;
}) => {
  const isEditable = !!textElement.link;

  const updateHyperlinkStyle = () => {
    const updatedTextElement = Scene.getScene(textElement)!.getElement(
      textElement.id,
    )!;

    const { x: viewPortX, y: viewPortY } = sceneCoordsToViewportCoords(
      { sceneX: updatedTextElement.x, sceneY: updatedTextElement.y },
      appState,
    );
    Object.assign(div.style, {
      top: `${viewPortY - 100}px`,
      left: `${viewPortX - 20}px`,
    });
    linkInput.placeholder = "Type or paste your link here";
    if (isEditable) {
      link.setAttribute("href", textElement.link!);
      link.innerText = textElement.link;
      link.setAttribute("target", "_blank");
    }
    let linkVal = "";
    if (textElement.link) {
      linkVal = textElement.link.split(PREFIX).pop()!;
    }
    linkInput.value = linkVal;
    applyBtn.innerText = "Apply";
    editButn.innerText = "Edit";
    removeBtn.innerText = "Remove";
    linkInput.classList.add("excalidraw-hyperlinkContainer-input");
    editButn.classList.add("excalidraw-hyperlinkContainer--edit");
    applyBtn.classList.add("excalidraw-hyperlinkContainer--apply");
    removeBtn.classList.add("excalidraw-hyperlinkContainer--remove");
    link.classList.add("excalidraw-hyperlinkContainer-link");

    if (isEditable) {
      linkInput.classList.add("d-none");
      applyBtn.classList.add("d-none");
    } else {
      removeBtn.classList.add("d-none");
      editButn.classList.add("d-none");
    }
  };

  const bindBlurEvent = () => {
    window.removeEventListener(EVENT.POINTER_UP, bindBlurEvent, false);
    linkInput.onblur = handleSubmit;
  };
  const onPointerDown = (event: MouseEvent) => {
    if (
      event.target instanceof Element &&
      !event.target.closest(".excalidraw-hyperlinkContainer")
    ) {
      window.addEventListener(EVENT.POINTER_UP, bindBlurEvent);
      window.addEventListener(EVENT.BLUR, handleSubmit, false);
      div.remove();
    }
  };
  const cleanup = () => {
    div.remove();

    window.removeEventListener("pointerdown", onPointerDown, false);
    window.removeEventListener(EVENT.BLUR, handleSubmit, false);
  };
  const handleSubmit = () => {
    let link = linkInput.value;
    cleanup();
    if (link && link.substr(0, PREFIX.length) !== PREFIX) {
      link = `${PREFIX}${link}`;
    }
    const updatedTextElement = Scene.getScene(textElement)!.getElement(
      textElement.id,
    )! as ExcalidrawTextElement;
    mutateElement(updatedTextElement, { link });
  };

  const handleRemove = () => {
    cleanup();
    const updatedTextElement = Scene.getScene(textElement)!.getElement(
      textElement.id,
    )! as ExcalidrawTextElement;
    mutateElement(updatedTextElement, { link: null });
  };
  window.addEventListener("pointerdown", onPointerDown, false);
  const div = document.createElement("div");
  div.classList.add("excalidraw-hyperlinkContainer");
  const editButn = document.createElement("button");
  const applyBtn = document.createElement("button");
  const removeBtn = document.createElement("button");
  const linkInput = document.createElement("input");
  const link = document.createElement("a");

  editButn.onclick = () => {
    linkInput.readOnly = false;
    linkInput.classList.remove("d-none");
    link.classList.add("d-none");
    removeBtn.classList.add("d-none");
    applyBtn.classList.remove("d-none");
    editButn.classList.add("d-none");
  };

  applyBtn.onclick = handleSubmit;

  removeBtn.onclick = handleRemove;

  updateHyperlinkStyle();

  div.appendChild(link);
  div.appendChild(linkInput);
  div.appendChild(editButn);
  div.appendChild(applyBtn);
  div.appendChild(removeBtn);
  excalidrawContainer
    ?.querySelector(".excalidraw-textEditorContainer")!
    .appendChild(div);
};
