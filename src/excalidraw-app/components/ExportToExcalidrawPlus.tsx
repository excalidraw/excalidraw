import React from "react";
import { Card } from "../../components/Card";
import { ToolButton } from "../../components/ToolButton";
import { serializeAsJSON } from "../../data/json";
import { getImportedKey, createIV, generateEncryptionKey } from "../data";
import { loadFirebaseStorage } from "../data/firebase";
import { NonDeletedExcalidrawElement } from "../../element/types";
import { AppState } from "../../types";
import { nanoid } from "nanoid";
import { t } from "../../i18n";
import { excalidrawPlusIcon } from "./icons";

const encryptData = async (
  key: string,
  json: string,
): Promise<{ blob: Blob; iv: Uint8Array }> => {
  const importedKey = await getImportedKey(key, "encrypt");
  const iv = createIV();
  const encoded = new TextEncoder().encode(json);
  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    importedKey,
    encoded,
  );

  return { blob: new Blob([new Uint8Array(ciphertext)]), iv };
};

const exportToExcalidrawPlus = async (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: AppState,
) => {
  const firebase = await loadFirebaseStorage();

  const id = `${nanoid(12)}`;

  const key = (await generateEncryptionKey())!;
  const encryptedData = await encryptData(
    key,
    serializeAsJSON(elements, appState),
  );

  const blob = new Blob([encryptedData.iv, encryptedData.blob], {
    type: "application/octet-stream",
  });

  await firebase
    .storage()
    .ref(`/migrations/scenes/${id}`)
    .put(blob, {
      customMetadata: {
        data: JSON.stringify({ version: 1, name: appState.name }),
        created: Date.now().toString(),
      },
    });

  window.open(`https://plus.excalidraw.com/import?excalidraw=${id},${key}`);
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
