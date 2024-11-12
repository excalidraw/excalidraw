import { TextField } from "./TextField";
import type { UIAppState } from "../types";
import DialogActionButton from "./DialogActionButton";
import { getSelectedElements } from "../scene";
import { createShapeLink } from "../element/shapeLinks";
import { mutateElement } from "../element/mutateElement";
import { useEffect, useState } from "react";
import "./ShapeLinkDialog.scss";
import { t } from "../i18n";
import type { ElementsMap } from "../element/types";
import { ToolButton } from "./ToolButton";
import { TrashIcon } from "./icons";
import { KEYS } from "../keys";

const ShapeLinkDialog = ({
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
        ? createShapeLink(selectedElements, window.location.origin)
        : originalLink;

    setNextLink(nextLink);
  }, [elementsMap, appState, appState.selectedElementIds, originalLink]);

  const handleConfirm = () => {
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
  };

  return (
    <div className="ShapeLinkDialog">
      <div className="ShapeLinkDialog__header">
        <h2>{t("shapeLink.title")}</h2>
        <p>{t("shapeLink.desc")}</p>
      </div>

      <div className="ShapeLinkDialog__input">
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
          className="ShapeLinkDialog__input-field"
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
            className="ShapeLinkDialog__remove"
            icon={TrashIcon}
          />
        )}
      </div>

      <div className="ShapeLinkDialog__actions">
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

export default ShapeLinkDialog;
