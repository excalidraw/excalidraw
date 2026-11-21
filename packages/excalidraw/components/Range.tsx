import React from "react";

import "./Range.scss";

export type RangeProps = {
  label: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  minLabel?: React.ReactNode;
  hasCommonValue?: boolean;
  testId?: string;
};

export const Range = ({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 10,
  minLabel = min,
  hasCommonValue = true,
  testId,
}: RangeProps) => {
  const progress = (value - min) / (max - min || 1);

  return (
    <label className="control-label">
      {label}
      <div
        className="range-wrapper"
        style={{ ["--range-progress" as string]: progress }}
      >
        <input
          style={{
            ["--color-slider-track" as string]: hasCommonValue
              ? undefined
              : "var(--button-bg)",
          }}
          type="range"
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            onChange(+event.target.value);
          }}
          value={value}
          className="range-input"
          data-testid={testId}
        />
        <div className="value-bubble">{value !== min ? value : null}</div>
        <div className="zero-label">{minLabel}</div>
      </div>
    </label>
  );
};
