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

const ShapeLinkDialog = ({
  onClose,
  isOpen,
  elementsMap,
  appState,
}: {
  isOpen: boolean;
  elementsMap: ElementsMap;
  appState: UIAppState;
  onClose?: () => void;
}) => {
  const originalLink = appState.elementToLink
    ? elementsMap.get(appState.elementToLink)?.link
    : "";

  const [nextLink, setNextLink] = useState<string | null>(null);

  useEffect(() => {
    const selectedElements = getSelectedElements(elementsMap, appState);
    const nextLink =
      selectedElements.length > 0
        ? createShapeLink(selectedElements, window.location.origin)
        : null;

    setNextLink(nextLink);
  }, [elementsMap, appState, appState.selectedElementIds]);

  return (
    <>
      {isOpen && (
        <div className="ShapeLinkDialog">
          <div className="ShapeLinkDialog__header">
            <h2>{t("shapeLink.title")}</h2>
            <p>{t("shapeLink.desc")}</p>
          </div>

          <TextField
            value={nextLink ?? originalLink ?? ""}
            onChange={(value) => {
              setNextLink(value);
            }}
          />

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
              onClick={() => {
                if (
                  nextLink &&
                  nextLink !== originalLink &&
                  appState.elementToLink
                ) {
                  const elementToLink = elementsMap.get(appState.elementToLink);
                  elementToLink &&
                    mutateElement(elementToLink, {
                      link: nextLink,
                    });
                }

                onClose?.();
              }}
              actionType="primary"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default ShapeLinkDialog;
