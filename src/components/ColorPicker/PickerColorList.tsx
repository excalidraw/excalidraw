import clsx from "clsx";
import { Palette, getColorNameAndShadeFromHex } from "../../utils";

interface PickerColorListProps {
  palette: Palette;
  color: string | null;
  onChange: (color: string) => void;
  label: string;
}

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

  return (
    <div className="color-picker-content--default">
      {[...Object.entries(palette)].map(([key, value]) => {
        // console.log(key, value);

        const prevShade = colorObj?.shade;
        // console.log("prevShade", prevShade);

        const color =
          (Array.isArray(value) ? value[3] : value) || "transparent";

        // console.log("color", color);

        console.log("colorObj", colorObj);

        return (
          <button
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
            onClick={(event) => {
              (event.currentTarget as HTMLButtonElement).focus();
              // const hasShade = (colorObj?.shade ?? -1) > -1;
              // const color =
              //   (Array.isArray(value)
              //     ? value[hasShade ? prevShade! : 3]
              //     : value) || "transparent";
              onChange(color);
            }}
            title={`${label} — ${key}`}
            // title={`${label}${
            //   !isTransparent(_color) ? ` (${_color})` : ""
            // } — ${keyBinding.toUpperCase()}`}
            aria-label={label}
            // aria-keyshortcuts={keyBindings[i]}
            style={color ? { "--swatch-color": color } : undefined}
            key={key}
          ></button>
        );
      })}
    </div>
  );
};

export default PickerColorList;
