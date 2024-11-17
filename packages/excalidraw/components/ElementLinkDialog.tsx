import { TextField } from "./TextField";
import type { AppState, UIAppState } from "../types";
import DialogActionButton from "./DialogActionButton";
import { getSelectedElements } from "../scene";
import { createElementLink } from "../element/elementLink";
import { mutateElement } from "../element/mutateElement";
import { useCallback, useEffect, useState } from "react";
import { t } from "../i18n";
import type { ElementsMap } from "../element/types";
import { ToolButton } from "./ToolButton";
import { TrashIcon } from "./icons";
import { KEYS } from "../keys";

import "./ElementLinkDialog.scss";

const ElementLinkDialog = ({
  onClose,
  elementsMap,
  appState,
}: {
  elementsMap: ElementsMap;
  appState: UIAppState;
  onClose?: () => void;
}) => {
  const originalLink = appState.elementToLink
    ? elementsMap.get(appState.elementToLink)?.link ?? null
    : null;

  const [nextLink, setNextLink] = useState<string | null>(originalLink);
  const [linkEdited, setLinkEdited] = useState(false);

  useEffect(() => {
    const selectedElements = getSelectedElements(elementsMap, appState);
    const nextLink =
      selectedElements.length > 0
        ? createElementLink(
            selectedElements,
            window.location.origin,
            appState as AppState,
          )
        : originalLink;

    setNextLink(nextLink);
  }, [elementsMap, appState, appState.selectedElementIds, originalLink]);

  const handleConfirm = useCallback(() => {
    if (
      nextLink &&
      appState.elementToLink &&
      nextLink !== elementsMap.get(appState.elementToLink)?.link
    ) {
      const elementToLink = elementsMap.get(appState.elementToLink);
      elementToLink &&
        mutateElement(elementToLink, {
          link: nextLink,
        });
    }

    if (!nextLink && linkEdited && appState.elementToLink) {
      const elementToLink = elementsMap.get(appState.elementToLink);
      elementToLink &&
        mutateElement(elementToLink, {
          link: null,
        });
    }

    onClose?.();
  }, [nextLink, elementsMap, appState, linkEdited, onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        appState.openDialog?.name === "elementLinkSelector" &&
        event.key === KEYS.ENTER
      ) {
        handleConfirm();
      }

      if (
        appState.openDialog?.name === "elementLinkSelector" &&
        event.key === KEYS.ESCAPE
      ) {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [appState, onClose, handleConfirm]);

  return (
    <div className="ElementLinkDialog">
      <div className="ElementLinkDialog__header">
        <h2>{t("elementLink.title")}</h2>
        <p>{t("elementLink.desc")}</p>
      </div>

      <div className="ElementLinkDialog__input">
        <TextField
          value={nextLink ?? ""}
          onChange={(value) => {
            if (!linkEdited) {
              setLinkEdited(true);
            }
            setNextLink(value);
          }}
          onKeyDown={(event) => {
            if (event.key === KEYS.ENTER) {
              handleConfirm();
            }
          }}
          className="ElementLinkDialog__input-field"
        />

        {nextLink && (
          <ToolButton
            type="button"
            title={t("buttons.remove")}
            aria-label={t("buttons.remove")}
            label={t("buttons.remove")}
            onClick={() => {
              // removes the link from the input
              // but doesn't update the element

              // when confirmed, will remove the link from the element
              setNextLink(null);
              setLinkEdited(true);
            }}
            className="ElementLinkDialog__remove"
            icon={TrashIcon}
          />
        )}
      </div>

      <div className="ElementLinkDialog__actions">
        <DialogActionButton
          label={t("buttons.cancel")}
          onClick={() => {
            onClose?.();
          }}
          style={{
            marginRight: 10,
          }}
        />

        <DialogActionButton
          label={t("buttons.confirm")}
          onClick={handleConfirm}
          actionType="primary"
        />
      </div>
    </div>
  );
};

export default ElementLinkDialog;
