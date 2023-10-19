import React from "react";
import { Card } from "../../src/components/Card";
import { ToolButton } from "../../src/components/ToolButton";
import { serializeAsJSON } from "../../src/data/json";
import { loadFirebaseStorage, saveFilesToFirebase } from "../data/firebase";
import { FileId, NonDeletedExcalidrawElement } from "../../src/element/types";
import { AppState, BinaryFileData, BinaryFiles } from "../../src/types";
import { nanoid } from "nanoid";
import { useI18n } from "../../src/i18n";
import { encryptData, generateEncryptionKey } from "../../src/data/encryption";
import { isInitializedImageElement } from "../../src/element/typeChecks";
import { FILE_UPLOAD_MAX_BYTES } from "../app_constants";
import { encodeFilesForUpload } from "../data/FileManager";
import { MIME_TYPES } from "../../src/constants";
import { trackEvent } from "../../src/analytics";
import { getFrame } from "../../src/utils";
import { ExcalidrawLogo } from "../../src/components/ExcalidrawLogo";

export const exportToExcalidrawPlus = async (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
) => {
  const firebase = await loadFirebaseStorage();

  const id = `${nanoid(12)}`;

  const encryptionKey = (await generateEncryptionKey())!;
  const encryptedData = await encryptData(
    encryptionKey,
    serializeAsJSON(elements, appState, files, "database"),
  );

  const blob = new Blob(
    [encryptedData.iv, new Uint8Array(encryptedData.encryptedBuffer)],
    {
      type: MIME_TYPES.binary,
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

  const filesMap = new Map<FileId, BinaryFileData>();
  for (const element of elements) {
    if (isInitializedImageElement(element) && files[element.fileId]) {
      filesMap.set(element.fileId, files[element.fileId]);
    }
  }

  if (filesMap.size) {
    const filesToUpload = await encodeFilesForUpload({
      files: filesMap,
      encryptionKey,
      maxBytes: FILE_UPLOAD_MAX_BYTES,
    });

    await saveFilesToFirebase({
      prefix: `/migrations/files/scenes/${id}`,
      files: filesToUpload,
    });
  }

  window.open(
    `${
      import.meta.env.VITE_APP_PLUS_APP
    }/import?excalidraw=${id},${encryptionKey}`,
  );
};

export const ExportToExcalidrawPlus: React.FC<{
  elements: readonly NonDeletedExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
  onError: (error: Error) => void;
  onSuccess: () => void;
}> = ({ elements, appState, files, onError, onSuccess }) => {
  const { t } = useI18n();
  return (
    <Card color="primary">
      <div className="Card-icon">
        <ExcalidrawLogo
          style={{
            [`--color-logo-icon` as any]: "#fff",
            width: "2.8rem",
            height: "2.8rem",
          }}
        />
      </div>
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
            trackEvent("export", "eplus", `ui (${getFrame()})`);
            await exportToExcalidrawPlus(elements, appState, files);
            onSuccess();
          } catch (error: any) {
            console.error(error);
            if (error.name !== "AbortError") {
              onError(new Error(t("exportDialog.excalidrawplus_exportError")));
            }
          }
        }}
      />
    </Card>
  );
};
