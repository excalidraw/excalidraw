import * as React from "react";

type FontSizeInputProps = {
  value: number;
  onChange: (size: number) => void;
};

export const FontSizeInput: React.FC<FontSizeInputProps> = ({
  value,
  onChange,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = Number(e.target.value);
    if (!isNaN(newSize) && newSize >= 8 && newSize <= 200) {
      onChange(newSize);
    }
  };

  return (
    <div style={{ marginTop: "0.75rem" }}>
      <label
        htmlFor="fontSizeInput"
        style={{
          fontSize: "0.9rem",
          marginRight: "0.5rem",
        }}
      >
        Custom Size:
      </label>
      <input
        id="fontSizeInput"
        type="number"
        min={8}
        max={200}
        step={1}
        value={value}
        onChange={handleChange}
        style={{
          width: "70px",
          padding: "4px 6px",
          border: "1px solid #ccc",
          borderRadius: "6px",
          background: "var(--input-bg, #fff)",
          color: "var(--text-color, #000)",
        }}
      />
    </div>
  );
};
