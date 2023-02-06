import clsx from "clsx";

interface ActiveColorProps {
  color: string | null;
  label: string;
  isActive: boolean;
  setActive: (active: boolean) => void;
  pickerButton: React.RefObject<HTMLButtonElement>;
}

const ActiveColor = ({
  label,
  color,
  setActive,
  pickerButton,
  isActive,
}: ActiveColorProps) => {
  return (
    <button
      type="button"
      className={clsx("color-picker__button", {
        "is-transparent": color === "transparent" || !color,
        "with-border": color === "#ffffff" || color === "transparent" || !color,
      })}
      aria-label={label}
      style={color ? { "--swatch-color": color } : undefined}
      onClick={() => setActive(!isActive)}
      ref={pickerButton}
    />
  );
};

export default ActiveColor;
