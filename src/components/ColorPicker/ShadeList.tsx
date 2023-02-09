import clsx from "clsx";
import { Palette, getColorNameAndShadeFromHex } from "../../utils";
import { useAtom } from "jotai";
import { activeColorPickerSectionAtom } from "./Picker";

interface ShadeListProps {
  hex: string | null;
  onChange: (color: string) => void;
  palette: Palette;
}

export const ShadeList = ({ hex, onChange, palette }: ShadeListProps) => {
  const colorObj = getColorNameAndShadeFromHex({
    hex: hex || "transparent",
    palette,
  });

  const [activeColorPickerSection, setActiveColorPickerSection] = useAtom(
    activeColorPickerSectionAtom,
  );

  if (colorObj) {
    const { colorName, shade } = colorObj;

    const shades = palette[colorName];

    if (Array.isArray(shades)) {
      return (
        <div
          className="color-picker-content--default shades"
          data-active-color-picker-section={
            activeColorPickerSection === "shades"
          }
        >
          {shades.map((color, i) => (
            <button
              autoFocus={i === shade}
              tabIndex={-1}
              key={i}
              type="button"
              className={clsx(
                "color-picker__button color-picker__button--large",
                { active: i === shade },
              )}
              aria-label="Shade"
              title={`${colorName} - ${i + 1}`}
              style={color ? { "--swatch-color": color } : undefined}
              onClick={() => {
                onChange(color);
                setActiveColorPickerSection("shades");
              }}
              onFocus={() => {
                onChange(color);
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      );
    }
  }

  return (
    <div
      className="color-picker-content--default"
      style={{ position: "relative" }}
      tabIndex={-1}
    >
      <button
        autoFocus
        tabIndex={-1}
        className="color-picker__button color-picker__button--large"
      />
      <div
        tabIndex={-1}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          fontSize: "0.75rem",
        }}
      >
        no shades available for this color
      </div>
    </div>
  );
};
