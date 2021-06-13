import React from "react";
import Stack from "../components/Stack";
import { ToolButton } from "../components/ToolButton";
import { save, file } from "../components/icons";
import { t } from "../i18n";

import "./ActiveFile.scss";

type ActiveFileProps = {
  fileName?: string;
  onSave: () => void;
};

export const ActiveFile = ({ fileName, onSave }: ActiveFileProps) => (
  <Stack.Row className="ActiveFile" gap={1} align="center">
    <span className="ActiveFile__fileName">
      {file}
      <span>{fileName}</span>
    </span>
    <ToolButton
      type="icon"
      icon={save}
      title={t("buttons.save")}
      aria-label={t("buttons.save")}
      onClick={onSave}
      data-testid="save-button"
    />
  </Stack.Row>
);
