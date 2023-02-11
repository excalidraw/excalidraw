import clsx from "clsx";
import * as Popover from "@radix-ui/react-popover";

interface ActiveColorProps {
  color: string | null;
  label: string;
}

const ActiveColor = ({ label, color }: ActiveColorProps) => {
  return (
    <Popover.Trigger
      type="button"
      className={clsx("color-picker__button active-color", {
        "is-transparent": color === "transparent" || !color,
        "with-border": color === "#ffffff" || color === "transparent" || !color,
      })}
      aria-label={label}
      style={color ? { "--swatch-color": color } : undefined}
    />
  );
};

export default ActiveColor;
