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

export const ActiveFile = ({ fileName, onSave }: ActiveFileProps) => (
  <MenuItem
    label={`${t("buttons.save")}`}
    shortcut={getShortcutFromShortcutName("saveScene")}
    dataTestId="save-button"
    onClick={onSave}
    icon={save}
  />
);
