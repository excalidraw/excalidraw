// TODO barnabasmolnar/editor-redesign
// this icon is not great
import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { save } from "../components/icons";
import { t } from "../i18n";

import "./ActiveFile.scss";
import DropdownMenuItem from "./dropdownMenu/DropdownMenuItem";

type ActiveFileProps = {
  fileName?: string;
  onSave: () => void;
};

export const ActiveFile = ({ fileName, onSave }: ActiveFileProps) => (
  <DropdownMenuItem
    shortcut={getShortcutFromShortcutName("saveScene")}
    dataTestId="save-button"
    onSelect={onSave}
    icon={save}
    ariaLabel={`${t("buttons.save")}`}
  >{`${t("buttons.save")}`}</DropdownMenuItem>
);
