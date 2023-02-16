import clsx from "clsx";
import { bgTopPicks, strokeTopPicks, canvasTopPicks } from "./colorPickerUtils";

interface TopPicksProps {
  onChange: (color: string) => void;
  type: "elementBackground" | "elementStroke" | "canvasBackground";
  activeColor: string | null;
  topPicks?: string[];
}

export const TopPicks = ({
  onChange,
  type,
  activeColor,
  topPicks,
}: TopPicksProps) => {
  const colors = topPicks
    ? topPicks
    : type === "elementStroke"
    ? strokeTopPicks
    : type === "elementBackground"
    ? bgTopPicks
    : canvasTopPicks;

  return (
    <div className="color-picker__top-picks">
      {colors.map((color) => (
        <button
          className={clsx("color-picker__button", {
            active: color === activeColor,
            "is-transparent": color === "transparent" || !color,
          })}
          style={{ "--swatch-color": color }}
          key={color}
          type="button"
          title={color}
          onClick={() => onChange(color)}
        >
          <div className="color-picker__button-outline" />
        </button>
      ))}
    </div>
  );
};
