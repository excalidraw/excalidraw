import React from "react";
import { nanoid } from "nanoid";

import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { Card } from "@excalidraw/excalidraw/components/Card";
import { ExcalidrawLogo } from "@excalidraw/excalidraw/components/ExcalidrawLogo";
import { ToolButton } from "@excalidraw/excalidraw/components/ToolButton";
import { getFrame } from "@excalidraw/common";
import {
  encryptData,
  generateEncryptionKey,
} from "@excalidraw/excalidraw/data/encryption";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import { isInitializedImageElement } from "@excalidraw/element";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { useAuth, supabase } from "./AuthContext";

import type {
  FileId,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFileData,
  BinaryFiles,
} from "@excalidraw/excalidraw/types";

import { FILE_UPLOAD_MAX_BYTES } from "../app_constants";
import { encodeFilesForUpload } from "../data/FileManager";
import {
  saveFilesToSupabase,
  saveSceneToSupabaseStorage,
  saveSceneMetadata,
} from "../data/supabase";

export const exportToExcalidrawPlus = async (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: Partial<AppState>,
  files: BinaryFiles,
  name: string,
) => {
  const id = `${nanoid(12)}`;

  const encryptionKey = (await generateEncryptionKey())!;
  const encryptedData = await encryptData(
    encryptionKey,
    serializeAsJSON(elements, appState, files, "database"),
  );

  // Combine IV and encrypted data into a single Uint8Array
  const sceneData = new Uint8Array(
    encryptedData.iv.length + encryptedData.encryptedBuffer.byteLength,
  );
  sceneData.set(encryptedData.iv);
  sceneData.set(
    new Uint8Array(encryptedData.encryptedBuffer),
    encryptedData.iv.length,
  );

  // Check authentication before attempting to save
  if (!supabase) {
    throw new Error("Supabase not configured");
  }

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    throw new Error("Authentication error: " + error.message);
  }
  if (!user) {
    throw new Error("User must be authenticated to export to Excalidraw+");
  }

  // Save to Supabase storage
  await saveSceneToSupabaseStorage(sceneData, id, {
    name,
    version: 2,
  });

  // Save metadata to database
  await saveSceneMetadata(id, encryptionKey, {
    name,
    description: `Exported diagram: ${name}`,
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

    await saveFilesToSupabase({
      prefix: `files/shareLinks/${id}`,
      files: filesToUpload,
    });
  }

  // Generate local URL that can load from Supabase storage
  const url = `http://localhost:3000#json=${id},${encryptionKey}`;

  window.open(url, "_blank");

  // Return the scene ID
  return { sceneId: id };
};

export const ExportToExcalidrawPlus: React.FC<{
  elements: readonly NonDeletedExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
  name: string;
  onError: (error: Error) => void;
  onSuccess: () => void;
  onVersionCreated?: (sceneId: string) => void;
  onOpenAuthModal?: () => void;
}> = ({ elements, appState, files, name, onError, onSuccess, onVersionCreated, onOpenAuthModal }) => {
  const { t } = useI18n();
  const { user, loading } = useAuth();

  // Show loading state while checking authentication
  if (loading) {
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
          Checking authentication...
        </div>
      </Card>
    );
  }

  // Show login prompt if user is not authenticated
  if (!user) {
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
          Please sign in to export your diagrams to Excalidraw+ cloud storage.
        </div>
        <ToolButton
          className="Card-button"
          type="button"
          title="Sign In"
          aria-label="Sign In"
          showAriaLabel={true}
          onClick={() => {
            if (onOpenAuthModal) {
              onOpenAuthModal();
            } else {
              // Fallback to error message
              onError(new Error("Please sign in to export to Excalidraw+"));
            }
          }}
        />
      </Card>
    );
  }

  // User is authenticated, show normal export option
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
            const result = await exportToExcalidrawPlus(elements, appState, files, name);
            if (result && typeof result === 'object' && 'sceneId' in result) {
              onVersionCreated?.(result.sceneId);
            }
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
