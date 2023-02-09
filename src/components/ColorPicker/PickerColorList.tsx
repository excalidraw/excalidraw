import clsx from "clsx";
import { Palette, getColorNameAndShadeFromHex } from "../../utils";
import { activeColorPickerSectionAtom } from "./Picker";
import { useAtom } from "jotai";

interface PickerColorListProps {
  palette: Palette;
  color: string | null;
  onChange: (color: string) => void;
  label: string;
}

export const defaultPickerKeys = [
  ["q", "w", "e", "r", "t"],
  ["a", "s", "d", "f", "g"],
  ["z", "x", "c", "v", "b"],
].flat();

const PickerColorList = ({
  palette,
  color,
  onChange,
  label,
}: PickerColorListProps) => {
  const colorObj = getColorNameAndShadeFromHex({
    hex: color || "transparent",
    palette,
  });
  const [, setActiveColorPickerSection] = useAtom(activeColorPickerSectionAtom);

  return (
    <div className="color-picker-content--default" tabIndex={-1}>
      {Object.entries(palette).map(([key, value], index) => {
        // const prevShade = colorObj?.shade;

        const color =
          (Array.isArray(value) ? value[3] : value) || "transparent";

        return (
          <button
            tabIndex={-1}
            type="button"
            className={clsx(
              "color-picker__button color-picker__button--large",
              {
                active: colorObj?.colorName === key,
                "is-transparent": color === "transparent" || !color,
                "with-border":
                  color === "#ffffff" || color === "transparent" || !color,
              },
            )}
            onClick={() => {
              // const hasShade = (colorObj?.shade ?? -1) > -1;
              // const color =
              //   (Array.isArray(value)
              //     ? value[hasShade ? prevShade! : 3]
              //     : value) || "transparent";
              onChange(color);
              setActiveColorPickerSection("default");
            }}
            onFocus={() => {
              onChange(color);
              setActiveColorPickerSection("default");
            }}
            title={`${label} — ${key}`}
            aria-label={label}
            style={color ? { "--swatch-color": color } : undefined}
            key={key}
          >
            {defaultPickerKeys[index]}
          </button>
        );
      })}
    </div>
  );
};

export default PickerColorList;
