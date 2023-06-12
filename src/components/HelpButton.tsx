import { t } from "../i18n";
import { Button } from "./Button";
import { HelpIcon } from "./icons";

type HelpButtonProps = {
  name?: string;
  id?: string;
  onClick?(): void;
};

export const HelpButton = (props: HelpButtonProps) => (
  <Button
    onSelect={props.onClick || (() => {})}
    className="help-icon"
    title={`${t("helpDialog.title")} — ?`}
    aria-label={t("helpDialog.title")}
  >
    {HelpIcon}
  </Button>
);
