import { questionCircle } from "../components/icons";

type HelpIconProps = {
  title?: string;
  name?: string;
  id?: string;
  onClick?(): void;
};

export const HelpIcon = (props: HelpIconProps) => (
  <button
    className="ToolIcon__icon help-icon" //zsviczian (added ToolIcon__icon)
    onClick={props.onClick}
    type="button"
    title={`${props.title} — ?`}
    aria-label={props.title}
  >
    {questionCircle}
  </button>
);
