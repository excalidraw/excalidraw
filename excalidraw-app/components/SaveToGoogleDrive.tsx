import React, { useState } from "react";

import { Card } from "@excalidraw/excalidraw/components/Card";
import { IconButton } from "@excalidraw/excalidraw/components/IconButton";
import { ProjectName } from "@excalidraw/excalidraw/components/ProjectName";
import { GoogleDriveIcon } from "@excalidraw/excalidraw/components/icons";
import { useI18n } from "@excalidraw/excalidraw/i18n";

import type { DriveFile } from "../data/googleDrive";

/**
 * "Save to Google Drive" card rendered inside the "Save to..." dialog
 * (`UIOptions.canvasActions.export.renderCustomUI`), mirroring the
 * Excalidraw+ export card.
 */
export const SaveToGoogleDrive: React.FC<{
  defaultName: string;
  onSave: (name: string) => Promise<DriveFile>;
  onError: (error: unknown) => void;
  onSuccess: (file: DriveFile) => void;
}> = ({ defaultName, onSave, onError, onSuccess }) => {
  const { t } = useI18n();
  const [name, setName] = useState(defaultName);

  return (
    <Card color="blue">
      <div className="Card-icon">{GoogleDriveIcon}</div>
      <h2>{t("googleDrive.saveCardTitle")}</h2>
      <div className="Card-details">
        {t("googleDrive.saveCardDetails")}
        <ProjectName
          value={name}
          onChange={setName}
          label={t("labels.fileTitle")}
        />
      </div>
      <IconButton
        className="Card-button"
        type="button"
        title={t("googleDrive.saveCardButton")}
        aria-label={t("googleDrive.saveCardButton")}
        showAriaLabel={true}
        onClick={async () => {
          try {
            const file = await onSave(name);
            onSuccess(file);
          } catch (error) {
            onError(error);
          }
        }}
      />
    </Card>
  );
};
