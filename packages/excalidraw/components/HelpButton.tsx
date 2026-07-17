import { t } from "../i18n";

import { HelpIcon } from "./icons";
import { Tooltip } from "./Tooltip";

type HelpButtonProps = {
  name?: string;
  id?: string;
  onClick?(): void;
};

export const HelpButton = (props: HelpButtonProps) => (
  <Tooltip label={`${t("helpDialog.title")} — ?`}>
    <button
      className="help-icon"
      onClick={props.onClick}
      type="button"
      aria-label={t("helpDialog.title")}
    >
      {HelpIcon}
    </button>
  </Tooltip>
);

