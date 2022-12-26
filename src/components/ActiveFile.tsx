// TODO barnabasmolnar/editor-redesign
// this icon is not great
import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { save } from "../components/icons";
import { t } from "../i18n";

import "./ActiveFile.scss";
import MenuItem from "./menu/MenuItem";

type ActiveFileProps = {
  fileName?: string;
  onSave: () => void;
};

export const ActiveFile = ({ fileName, onSave }: ActiveFileProps) => (
  <MenuItem
    shortcut={getShortcutFromShortcutName("saveScene")}
    dataTestId="save-button"
    onClick={onSave}
    icon={save}
  >{`${t("buttons.save")}`}</MenuItem>
);
