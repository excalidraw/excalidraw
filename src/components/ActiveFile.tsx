// TODO barnabasmolnar/editor-redesign
// this icon is not great
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
    label={`${t("buttons.save")}: ${fileName}`}
    dataTestId="save-button"
    onClick={onSave}
    icon={save}
  />
);
