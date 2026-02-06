import { t } from "../i18n";
import { HelpIcon, santaHatIcon } from "./icons";

type HelpButtonProps = {
  name?: string;
  id?: string;
  onClick?(): void;
};

export const HelpButton = (props: HelpButtonProps) => {
  const today = new Date();
  const month = today.getMonth(); // 0 = Januar, 11 = Dezember
  const date = today.getDate();

  // nur vom 1.12 bis 26.12. anzeigen
  const showSantaHat = month === 11 && date >= 1 && date <= 26;

  return (
    <button
      className="help-icon"
      onClick={props.onClick}
      type="button"
      title={`${t("helpDialog.title")} — ?`}
      aria-label={t("helpDialog.title")}
    >
      {showSantaHat && santaHatIcon}
      {HelpIcon}
    </button>
  );
};
