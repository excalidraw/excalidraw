import clsx from "clsx";
import * as Popover from "@radix-ui/react-popover";
import { t } from "../../i18n";
import { ColorPickerType } from "./colorPickerUtils";

interface ActiveColorProps {
  color: string | null;
  label: string;
  type: ColorPickerType;
}

const ActiveColor = ({ label, color, type }: ActiveColorProps) => {
  return (
    <Popover.Trigger
      type="button"
      className={clsx("color-picker__button active-color", {
        "is-transparent": color === "transparent" || !color,
      })}
      aria-label={label}
      style={color ? { "--swatch-color": color } : undefined}
      title={
        type === "elementStroke"
          ? t("labels.showStroke")
          : t("labels.showBackground")
      }
    >
      <div className="color-picker__button-outline" />
    </Popover.Trigger>
  );
};

export default ActiveColor;
