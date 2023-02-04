import { Button } from "./Button";
import { HelpIcon } from "./icons";

type HelpButtonProps = {
  title?: string;
  name?: string;
  id?: string;
  onClick?(): void;
};

export const HelpButton = (props: HelpButtonProps) => (
  <Button
    onSelect={props.onClick || (() => {})}
    className="help-icon"
    title={`${props.title} — ?`}
    aria-label={props.title}
  >
    {HelpIcon}
  </Button>
);
