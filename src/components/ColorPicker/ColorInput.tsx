import { useCallback, useEffect, useState } from "react";
import { getColor } from "./ColorPicker";
import ActiveColor from "./ActiveColor";
import clsx from "clsx";

interface ColorInputProps {
  color: string | null;
  onChange: (color: string) => void;
  label: string;
}

export const ColorInput = ({ color, onChange, label }: ColorInputProps) => {
  const [innerValue, setInnerValue] = useState(color);

  useEffect(() => {
    setInnerValue(color);
  }, [color]);

  const changeColor = useCallback(
    (inputValue: string) => {
      const value = inputValue.toLowerCase();
      const color = getColor(value);
      if (color) {
        onChange(color);
      }
      setInnerValue(value);
    },
    [onChange],
  );

  return (
    <label
      style={{
        // display: "flex",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto",
        gap: "8px",
        alignItems: "center",
        border: "1px solid var(--default-border-color)",
        borderRadius: "8px",
        padding: "0 12px",
        margin: "8px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ padding: "0 8px" }}>#</div>
      <input
        style={{
          border: 0,
          padding: 0,
          // width: "auto",
        }}
        spellCheck={false}
        className="color-picker-input"
        aria-label={label}
        onChange={(event) => changeColor(event.target.value)}
        value={(innerValue || "").replace(/^#/, "")}
        onBlur={() => setInnerValue(color)}
      />
      <div
        style={{
          width: "1px",
          height: "1.25rem",
          backgroundColor: "var(--default-border-color)",
        }}
      />
      <div
        style={color ? { "--swatch-color": color } : undefined}
        className={clsx("color-picker__button", {
          "is-transparent": color === "transparent" || !color,
          "with-border":
            color === "#ffffff" || color === "transparent" || !color,
        })}
      />
    </label>
    // <label className="color-input-container">
    //   <div className="color-picker-hash">#</div>
    //   <input
    //     spellCheck={false}
    //     className="color-picker-input"
    //     aria-label={label}
    //     onChange={(event) => changeColor(event.target.value)}
    //     value={(innerValue || "").replace(/^#/, "")}
    //     onBlur={() => setInnerValue(color)}
    //   />
    //   <div
    //     style={{ width: "1px", backgroundColor: "var(--default-border-color)" }}
    //   />
    //   <div
    //     style={color ? { "--swatch-color": color } : undefined}
    //     className={clsx("color-picker__button", {
    //       "is-transparent": color === "transparent" || !color,
    //       "with-border":
    //         color === "#ffffff" || color === "transparent" || !color,
    //     })}
    //   />
    // </label>
  );
};

// export const ColorInput = React.forwardRef(
//   (
//     {
//       color,
//       onChange,
//       label,
//     }: {
//       color: string | null;
//       onChange: (color: string) => void;
//       label: string;
//     },
//     ref,
//   ) => {
//     const [innerValue, setInnerValue] = React.useState(color);
//     const inputRef = React.useRef(null);

//     React.useEffect(() => {
//       setInnerValue(color);
//     }, [color]);

//     React.useImperativeHandle(ref, () => inputRef.current);

//     const changeColor = React.useCallback(
//       (inputValue: string) => {
//         const value = inputValue.toLowerCase();
//         const color = getColor(value);
//         if (color) {
//           onChange(color);
//         }
//         setInnerValue(value);
//       },
//       [onChange],
//     );

//     return (
//       <label className="color-input-container">
//         <div className="color-picker-hash">#</div>
//         <input
//           spellCheck={false}
//           className="color-picker-input"
//           aria-label={label}
//           onChange={(event) => changeColor(event.target.value)}
//           value={(innerValue || "").replace(/^#/, "")}
//           onBlur={() => setInnerValue(color)}
//           ref={inputRef}
//         />
//       </label>
//     );
//   },
// );
// ColorInput.displayName = "ColorInput";
