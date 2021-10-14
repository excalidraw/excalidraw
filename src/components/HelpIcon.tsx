import { questionCircle } from "../components/icons";

type HelpIconProps = {
  title?: string;
  name?: string;
  id?: string;
  onClick?(): void;
};

export const HelpIcon = (props: HelpIconProps) => (
  <button
    className="help-icon"
    onClick={props.onClick}
    type="button"
    title={`${props.title} — ?`}
    aria-label={props.title}
  >
    {questionCircle}
  </button>
);
