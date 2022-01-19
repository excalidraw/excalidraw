import { AppState } from "../types";
import { sceneCoordsToViewportCoords } from "../utils";
import { mutateElement } from "./mutateElement";
import { ExcalidrawTextElement, NonDeletedExcalidrawElement } from "./types";

import "./hyperlink.scss";
import Scene from "../scene/Scene";
import { register } from "../actions/register";
import { ToolButton } from "../components/ToolButton";
import { link } from "../components/icons";
import { t } from "../i18n";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";

const PREFIX = "https://";

export const Hyperlink = ({
  element,
  appState,
  onSubmit,
}: {
  element: NonDeletedExcalidrawElement;
  appState: AppState;
  onSubmit: () => void;
}) => {
  let linkVal = "";
  if (element.link) {
    linkVal = element.link.split(PREFIX).pop()!;
  }
  const [isEditing, setIsEditing] = useState(false);
  const [inputVal, setInputVal] = useState(linkVal);
  const inputRef = useRef<HTMLInputElement>(null);
  const showInput = isEditing || !linkVal;

  const handleSubmit = useCallback(() => {
    if (!inputRef.current) {
      return;
    }

    let link = inputRef.current.value;
    if (link && link.substr(0, PREFIX.length) !== PREFIX) {
      link = `${PREFIX}${link}`;
    }
    const updatedTextElement = Scene.getScene(element)!.getElement(
      element.id,
    )! as ExcalidrawTextElement;
    mutateElement(updatedTextElement, { link });
    onSubmit();
  }, [element, onSubmit]);

  useLayoutEffect(() => {
    return () => {
      handleSubmit();
    };
  }, [handleSubmit]);

  const handleRemove = useCallback(() => {
    const updatedTextElement = Scene.getScene(element)!.getElement(
      element.id,
    )! as ExcalidrawTextElement;
    mutateElement(updatedTextElement, { link: null });
    onSubmit();
  }, [onSubmit, element]);

  const onEdit = () => {
    setIsEditing(true);
  };

  const updatedTextElement = Scene.getScene(element)!.getElement(element.id)!;
  const { x: viewPortX, y: viewPortY } = sceneCoordsToViewportCoords(
    { sceneX: updatedTextElement.x, sceneY: updatedTextElement.y },
    appState,
  );
  return (
    <div
      className="excalidraw-hyperlinkContainer"
      style={{ top: `${viewPortY - 85}px`, left: `${viewPortX - 50}px` }}
    >
      {showInput ? (
        <input
          className={clsx("excalidraw-hyperlinkContainer-input")}
          placeholder="Type or paste your link here"
          ref={inputRef}
          value={inputVal}
          onChange={(event) => setInputVal(event.target.value)}
          autoFocus
        />
      ) : (
        <a
          href={element.link || ""}
          className={clsx("excalidraw-hyperlinkContainer-link", {
            "d-none": isEditing,
          })}
        >
          {element.link}
        </a>
      )}

      {!showInput && (
        <div>
          <button
            className={clsx("excalidraw-hyperlinkContainer--edit")}
            onClick={onEdit}
          >
            Edit
          </button>
          <button
            className={clsx("excalidraw-hyperlinkContainer--remove")}
            onClick={handleRemove}
          >
            Remove
          </button>
        </div>
      )}
      {showInput && (
        <button
          className={clsx("excalidraw-hyperlinkContainer--apply")}
          onClick={handleSubmit}
        >
          Apply
        </button>
      )}
    </div>
  );
};

export const actionLink = register({
  name: "link",
  perform: (elements, appState) => {
    return {
      elements,
      appState: { ...appState, showHyperlinkPopup: true },
      commitToHistory: true,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => (
    <ToolButton
      type="button"
      icon={link}
      aria-label={t("labels.link")}
      onClick={() => updateData(null)}
    />
  ),
});
