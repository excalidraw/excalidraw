import clsx from "clsx";
import { getColorNameAndShadeFromHex } from "../../utils";
import { ocPalette } from "./ColorPicker";

interface ShadeListProps {
  hex: string | null;
  onChange: (color: string) => void;
}

export const ShadeList = ({ hex, onChange }: ShadeListProps) => {
  const colorObj = getColorNameAndShadeFromHex({
    hex: hex || "transparent",
    palette: ocPalette,
  });

  if (colorObj) {
    const { colorName, shade } = colorObj;

    const shades = ocPalette[colorName];

    if (Array.isArray(shades)) {
      return (
        <div className="color-picker-content--default">
          {shades.map((color, i) => (
            <button
              type="button"
              className={clsx(
                "color-picker__button color-picker__button--large",
                { active: i === shade },
              )}
              title={`${colorName} - ${i}`}
              style={color ? { "--swatch-color": color } : undefined}
              onClick={() => onChange(color)}
            />
          ))}
        </div>
      );
    }
  }

  return (
    <div
      className="color-picker-content--default"
      style={{ position: "relative" }}
    >
      <button className="color-picker__button color-picker__button--large" />
      <div
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
