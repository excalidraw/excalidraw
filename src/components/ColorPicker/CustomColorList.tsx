import clsx from "clsx";
import { CustomColorListProps, activeColorPickerSectionAtom } from "./Picker";
import { useAtom } from "jotai";

export const CustomColorList = ({
  colors,
  color,
  onChange,
  label,
}: CustomColorListProps) => {
  const [activeColorPickerSection, setActiveColorPickerSection] = useAtom(
    activeColorPickerSectionAtom,
  );

  console.log("render CustomColorList");

  return (
    <div className="color-picker-content--default" tabIndex={-1}>
      {colors.map((c, i) => {
        return (
          <button
            tabIndex={-1}
            type="button"
            className={clsx(
              "color-picker__button color-picker__button--large",
              { active: color === c },
            )}
            onClick={(event) => {
              (event.currentTarget as HTMLButtonElement).focus();
              // const hasShade = (colorObj?.shade ?? -1) > -1;
              // const color =
              //   (Array.isArray(value)
              //     ? value[hasShade ? prevShade! : 3]
              //     : value) || "transparent";
              onChange(c);
              setActiveColorPickerSection("custom");
            }}
            onFocus={(event) => {
              console.log("onFocus", event.currentTarget);
              (event.currentTarget as HTMLButtonElement).focus();
              onChange(c);
              setActiveColorPickerSection("custom");
            }}
            // title={`${label} — ${key}`}
            // title={`${label}${
            //   !isTransparent(_color) ? ` (${_color})` : ""
            // } — ${keyBinding.toUpperCase()}`}
            aria-label={label}
            // aria-keyshortcuts={keyBindings[i]}
            style={{ "--swatch-color": c }}
            key={i}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
};
