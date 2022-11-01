import { HelpIcon } from "./icons";

type HelpButtonProps = {
  title?: string;
  name?: string;
  id?: string;
  onClick?(): void;
};

export const HelpButton = (props: HelpButtonProps) => (
  <button
    className="ToolIcon__icon help-icon" //zsviczian (added ToolIcon__icon)
    onClick={props.onClick}
    type="button"
    title={`${props.title} — ?`}
    aria-label={props.title}
  >
    {HelpIcon}
  </button>
);
