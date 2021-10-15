import React from "react";
import { Card } from "../../components/Card";
import { ToolButton } from "../../components/ToolButton";
import { serializeAsJSON } from "../../data/json";
import { loadFirebaseStorage, saveFilesToFirebase } from "../data/firebase";
import { FileId, NonDeletedExcalidrawElement } from "../../element/types";
import { AppState, DataURL } from "../../types";
import { nanoid } from "nanoid";
import { t } from "../../i18n";
import { excalidrawPlusIcon } from "./icons";
import { encryptData, generateEncryptionKey } from "../../data/encryption";
import { ALLOWED_IMAGE_MIME_TYPES } from "../../constants";
import { isInitializedImageElement } from "../../element/typeChecks";
import { FILE_UPLOAD_MAX_BYTES } from "../app_constants";
import { encodeFilesForUpload } from "../data/FileManager";

const exportToExcalidrawPlus = async (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
) => {
  const firebase = await loadFirebaseStorage();

  const id = `${nanoid(12)}`;

  const encryptionKey = (await generateEncryptionKey())!;
  const encryptedData = await encryptData(
    encryptionKey,
    serializeAsJSON(elements, appState, "database"),
  );

  const blob = new Blob(
    [encryptedData.iv, new Uint8Array(encryptedData.encryptedBuffer)],
    {
      type: "application/octet-stream",
    },
  );

  await firebase
    .storage()
    .ref(`/migrations/scenes/${id}`)
    .put(blob, {
      customMetadata: {
        data: JSON.stringify({ version: 2, name: appState.name }),
        created: Date.now().toString(),
      },
    });

  const files = new Map<FileId, DataURL>();
  for (const element of elements) {
    if (isInitializedImageElement(element) && appState.files[element.fileId]) {
      files.set(element.fileId, appState.files[element.fileId].dataURL);
    }
  }

  if (files.size) {
    const filesToUpload = await encodeFilesForUpload({
      files,
      encryptionKey,
      maxBytes: FILE_UPLOAD_MAX_BYTES,
      allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES,
    });

    await saveFilesToFirebase({
      prefix: `/migrations/files/scenes/${id}`,
      files: filesToUpload,
    });
  }

  window.open(
    `https://plus.excalidraw.com/import?excalidraw=${id},${encryptionKey}`,
  );
};

export const ExportToExcalidrawPlus: React.FC<{
  elements: readonly NonDeletedExcalidrawElement[];
  appState: AppState;
  onError: (error: Error) => void;
}> = ({ elements, appState, onError }) => {
  return (
    <Card color="indigo">
      <div className="Card-icon">{excalidrawPlusIcon}</div>
      <h2>Excalidraw+</h2>
      <div className="Card-details">
        {t("exportDialog.excalidrawplus_description")}
      </div>
      <ToolButton
        className="Card-button"
        type="button"
        title={t("exportDialog.excalidrawplus_button")}
        aria-label={t("exportDialog.excalidrawplus_button")}
        showAriaLabel={true}
        onClick={async () => {
          try {
            await exportToExcalidrawPlus(elements, appState);
          } catch (error) {
            console.error(error);
            onError(new Error(t("exportDialog.excalidrawplus_exportError")));
          }
        }}
      />
    </Card>
  );
};
