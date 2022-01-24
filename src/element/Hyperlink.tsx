import { AppState } from "../types";
import { sceneCoordsToViewportCoords } from "../utils";
import { mutateElement, newElementWith } from "./mutateElement";
import { NonDeletedExcalidrawElement } from "./types";

import "./Hyperlink.scss";
import Scene from "../scene/Scene";
import { register } from "../actions/register";
import { ToolButton } from "../components/ToolButton";
import { checkCircleIcon, editIcon, link, trash } from "../components/icons";
import { t } from "../i18n";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";
import { KEYS } from "../keys";

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

    if (link === element.link) {
      return;
    }
    const elementWithLink = newElementWith(element, { link });
    mutateElement(element, elementWithLink);
    onSubmit();
  }, [element, onSubmit]);

  useLayoutEffect(() => {
    return () => {
      handleSubmit();
    };
  }, [handleSubmit]);

  const handleRemove = useCallback(() => {
    const elementWithoutLink = newElementWith(element, {
      link: null,
    });
    mutateElement(element, elementWithoutLink);
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
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === KEYS.ENTER || event.key === KEYS.ESCAPE) {
              handleSubmit();
            }
          }}
        />
      ) : (
        <a
          href={element.link || ""}
          className={clsx("excalidraw-hyperlinkContainer-link", {
            "d-none": isEditing,
          })}
          target="_blank"
          rel="noreferrer"
        >
          {element.link}
        </a>
      )}

      {!showInput && (
        <div>
          <ToolButton
            type="button"
            title={t("buttons.edit")}
            aria-label={t("buttons.edit")}
            label={t("buttons.edit")}
            onClick={onEdit}
            className="excalidraw-hyperlinkContainer--edit"
            icon={editIcon}
          />
          <ToolButton
            type="button"
            title={t("buttons.remove")}
            aria-label={t("buttons.remove")}
            label={t("buttons.remove")}
            onClick={handleRemove}
            className="excalidraw-hyperlinkContainer--remove"
            icon={trash}
          />
        </div>
      )}
      {showInput && (
        <ToolButton
          type="button"
          title={t("buttons.save")}
          aria-label={t("buttons.save")}
          label={t("buttons.save")}
          onClick={handleSubmit}
          className="excalidraw-hyperlinkContainer--save"
          icon={checkCircleIcon}
        />
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
