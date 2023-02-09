import clsx from "clsx";
import * as Popover from "@radix-ui/react-popover";

interface ActiveColorProps {
  color: string | null;
  label: string;
  isActive: boolean;
  setActive: (active: boolean) => void;
}

const ActiveColor = ({
  label,
  color,
  setActive,
  isActive,
}: ActiveColorProps) => {
  return (
    <Popover.Trigger
      type="button"
      className={clsx("color-picker__button", {
        "is-transparent": color === "transparent" || !color,
        "with-border": color === "#ffffff" || color === "transparent" || !color,
      })}
      aria-label={label}
      style={color ? { "--swatch-color": color } : undefined}
      onClick={() => setActive(!isActive)}
    />
  );
};

export default ActiveColor;
