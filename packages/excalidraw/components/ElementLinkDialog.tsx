import { useCallback, useEffect, useState } from "react";

import { normalizeLink, KEYS } from "@excalidraw/common";

import {
  defaultGetElementLinkFromSelection,
  getLinkIdAndTypeFromSelection,
} from "@excalidraw/element/elementLink";
import { mutateElement } from "@excalidraw/element/mutateElement";

import type { ElementsMap, ExcalidrawElement } from "@excalidraw/element/types";

import { t } from "../i18n";
import { getSelectedElements } from "../scene";

import DialogActionButton from "./DialogActionButton";
import { TextField } from "./TextField";
import { ToolButton } from "./ToolButton";
import { TrashIcon } from "./icons";

import "./ElementLinkDialog.scss";

import type { AppProps, AppState, UIAppState } from "../types";

const ElementLinkDialog = ({
  sourceElementId,
  onClose,
  elementsMap,
  appState,
  generateLinkForSelection = defaultGetElementLinkFromSelection,
}: {
  sourceElementId: ExcalidrawElement["id"];
  elementsMap: ElementsMap;
  appState: UIAppState;
  onClose?: () => void;
  generateLinkForSelection: AppProps["generateLinkForSelection"];
}) => {
  const originalLink = elementsMap.get(sourceElementId)?.link ?? null;

  const [nextLink, setNextLink] = useState<string | null>(originalLink);
  const [linkEdited, setLinkEdited] = useState(false);

  useEffect(() => {
    const selectedElements = getSelectedElements(elementsMap, appState);
    let nextLink = originalLink;

    if (selectedElements.length > 0 && generateLinkForSelection) {
      const idAndType = getLinkIdAndTypeFromSelection(
        selectedElements,
        appState as AppState,
      );

      if (idAndType) {
        nextLink = normalizeLink(
          generateLinkForSelection(idAndType.id, idAndType.type),
        );
      }
    }

    setNextLink(nextLink);
  }, [
    elementsMap,
    appState,
    appState.selectedElementIds,
    originalLink,
    generateLinkForSelection,
  ]);

  const handleConfirm = useCallback(() => {
    if (nextLink && nextLink !== elementsMap.get(sourceElementId)?.link) {
      const elementToLink = elementsMap.get(sourceElementId);
      elementToLink &&
        mutateElement(elementToLink, {
          link: nextLink,
        });
    }

    if (!nextLink && linkEdited && sourceElementId) {
      const elementToLink = elementsMap.get(sourceElementId);
      elementToLink &&
        mutateElement(elementToLink, {
          link: null,
        });
    }

    onClose?.();
  }, [sourceElementId, nextLink, elementsMap, linkEdited, onClose]);

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
          selectOnRender
        />

        {originalLink && nextLink && (
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
