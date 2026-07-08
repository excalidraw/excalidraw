import { useState } from "react";

import { isImageElement } from "@excalidraw/element";

import type { ExcalidrawImageElement } from "@excalidraw/element/types";

import { useApp } from "../components/App";
import { Dialog } from "../components/Dialog";
import DialogActionButton from "../components/DialogActionButton";
import { TextField } from "../components/TextField";
import { atom, useAtom } from "../editor-jotai";
import { t } from "../i18n";

import { announce } from "./announcer";

import type { AppClassProperties } from "../types";

export const imageAltTextDialogAtom = atom<{ elementId: string } | null>(null);

/** the persisted accessible description of an image element */
export const getImageAltText = (element: ExcalidrawImageElement) =>
  (element.customData?.a11y?.altText as string | undefined) || null;

const ImageAltTextDialogInner = ({
  app,
  element,
  onClose,
}: {
  app: AppClassProperties;
  element: ExcalidrawImageElement;
  onClose: () => void;
}) => {
  const [altText, setAltText] = useState(getImageAltText(element) ?? "");

  const onSave = () => {
    app.scene.mutateElement(element, {
      customData: {
        ...element.customData,
        a11y: {
          ...element.customData?.a11y,
          altText: altText.trim() || undefined,
        },
      },
    });
    announce(t("a11y.altTextSaved"));
    onClose();
  };

  return (
    <Dialog
      size="small"
      onCloseRequest={onClose}
      title={t("labels.imageAltTextTitle")}
    >
      <TextField
        label={t("labels.imageAltTextTitle")}
        placeholder={t("labels.imageAltTextPlaceholder")}
        value={altText}
        onChange={setAltText}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSave();
          }
        }}
        selectOnRender
        fullWidth
      />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <DialogActionButton
          label={t("buttons.confirm")}
          actionType="primary"
          onClick={onSave}
        />
      </div>
    </Dialog>
  );
};

export const ImageAltTextDialog = () => {
  const [dialogState, setDialogState] = useAtom(imageAltTextDialogAtom);
  const app = useApp();

  if (!dialogState) {
    return null;
  }

  const element = app.scene
    .getNonDeletedElementsMap()
    .get(dialogState.elementId);
  if (!element || !isImageElement(element)) {
    return null;
  }

  return (
    <ImageAltTextDialogInner
      // remount when target changes so the input state resets
      key={element.id}
      app={app}
      element={element}
      onClose={() => setDialogState(null)}
    />
  );
};
