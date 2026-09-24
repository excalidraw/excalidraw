import React, { useEffect } from "react";

import "./Range.scss";

export type RangeProps = {
  label: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  minLabel?: React.ReactNode;
  /**
   * Renders a fixed label at the right end of the track. Omitted by default:
   * a slider whose range is self-evident (opacity is always 0–100) does not
   * need one, but one whose max varies with what is selected does.
   */
  maxLabel?: React.ReactNode;
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
  maxLabel,
  hasCommonValue = true,
  testId,
}: RangeProps) => {
  const rangeRef = React.useRef<HTMLInputElement>(null);
  const valueRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rangeRef.current && valueRef.current) {
      const rangeElement = rangeRef.current;
      const valueElement = valueRef.current;
      const inputWidth = rangeElement.offsetWidth;
      const thumbWidth =
        parseFloat(
          getComputedStyle(rangeElement).getPropertyValue(
            "--slider-thumb-size",
          ),
        ) || 16;
      const progress = ((value - min) / (max - min || 1)) * 100;
      const position =
        (progress / 100) * (inputWidth - thumbWidth) + thumbWidth / 2;
      valueElement.style.left = `${position}px`;
      rangeElement.style.background = `linear-gradient(to right, var(--color-slider-track) 0%, var(--color-slider-track) ${progress}%, var(--button-bg) ${progress}%, var(--button-bg) 100%)`;
    }
  }, [max, min, value]);

  // The bubble travels with the thumb, so at either end of the track it lands
  // on top of the fixed edge label. Hiding it at `min` is why the zero label
  // reads cleanly; do the same at `max`, but only when a max label is actually
  // rendered — sliders without one (opacity) must keep showing their value
  // when they reach the top of the range.
  const showValueBubble = value !== min && !(maxLabel != null && value === max);

  return (
    <label className="control-label">
      {label}
      <div className="range-wrapper">
        <input
          style={{
            ["--color-slider-track" as string]: hasCommonValue
              ? undefined
              : "var(--button-bg)",
          }}
          ref={rangeRef}
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
        <div className="value-bubble" ref={valueRef}>
          {showValueBubble ? value : null}
        </div>
        <div className="zero-label">{minLabel}</div>
        {maxLabel != null && <div className="max-label">{maxLabel}</div>}
      </div>
    </label>
  );
};
