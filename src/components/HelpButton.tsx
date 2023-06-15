import { t } from "../i18n";
import { HelpIcon } from "./icons";

type HelpButtonProps = {
  name?: string;
  id?: string;
  onClick?(): void;
};

export const HelpButton = (props: HelpButtonProps) => (
  <button
    className="ToolIcon__icon help-icon" //zsviczian (added ToolIcon__icon)
    onClick={props.onClick}
    type="button"
    title={`${t("helpDialog.title")} — ?`}
    aria-label={t("helpDialog.title")}
  >
    {HelpIcon}
  </button>
);
