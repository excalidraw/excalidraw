import React, { useEffect } from "react";

import "./Range.scss";

export type RangeProps = {
  updateData: (value: number) => void;
  appState: any;
  elements: any;
  testId?: string;
};

export const Range = ({
  updateData,
  appState,
  elements,
  testId,
  min,
  max,
  step,
  value,
  label,
}: RangeProps & {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
}) => {
  const rangeRef = React.useRef<HTMLInputElement>(null);
  const valueRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rangeRef.current && valueRef.current) {
      const rangeElement = rangeRef.current;
      const valueElement = valueRef.current;
      const inputWidth = rangeElement.offsetWidth;
      const thumbWidth = 15; // 15 is the width of the thumb
      const position =
        (value / (max - min)) * (inputWidth - thumbWidth) + thumbWidth / 2;
      valueElement.style.left = `${position}px`;
      rangeElement.style.background = `linear-gradient(to right, var(--color-slider-track) 0%, var(--color-slider-track) ${
        ((value - min) * 100) / (max - min)
      }%, var(--button-bg) ${
        ((value - min) * 100) / (max - min)
      }%, var(--button-bg) 100%)`;
    }
  }, [value, max, min]);

  return (
    <label className="control-label">
      {label}
      <div className="range-wrapper">
        <input
          ref={rangeRef}
          type="range"
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            updateData(parseFloat(event.target.value));
          }}
          value={value}
          className="range-input"
          data-testid={testId}
        />
        <div className="value-bubble" ref={valueRef}>
          {value !== 0 ? value.toFixed(1) : null} {}
        </div>
      </div>
    </label>
  );
};
