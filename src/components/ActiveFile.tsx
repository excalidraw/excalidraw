// TODO barnabasmolnar/editor-redesign
// this icon is not great
import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { save } from "../components/icons";
import { t } from "../i18n";

import "./ActiveFile.scss";
import MenuItem from "./MenuItem";

type ActiveFileProps = {
  fileName?: string;
  onSave: () => void;
};

const removeFileExtension = (fileName: string): string => {
  return fileName.replace(/.excalidraw$/, "");
};

export const ActiveFile = ({ fileName, onSave }: ActiveFileProps) => (
  <MenuItem
    label={`${t("buttons.save")} ${fileName && removeFileExtension(fileName)}`}
    shortcut={getShortcutFromShortcutName("saveScene")}
    dataTestId="save-button"
    onClick={onSave}
    icon={save}
  />
);
