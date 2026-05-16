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
  const rangeRef = React.useRef<HTMLInputElement>(null);
  const valueRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rangeRef.current && valueRef.current) {
      const rangeElement = rangeRef.current;
      const valueElement = valueRef.current;
      const inputWidth = rangeElement.offsetWidth;
      const computed = getComputedStyle(rangeElement);
      const thumbWidth =
        parseFloat(computed.getPropertyValue("--slider-thumb-size")) || 16;
      const progress = ((value - min) / (max - min || 1)) * 100;
      const position =
        (progress / 100) * (inputWidth - thumbWidth) + thumbWidth / 2;
      // `inset-inline-start` anchors the bubble to the slider's logical start,
      // so the position stays aligned with the thumb whether `dir` is `ltr` or
      // `rtl`. The gradient direction is in physical CSS keywords and has to
      // be flipped explicitly when the document is RTL — browsers don't flip
      // `to right` automatically.
      const isRTL = computed.direction === "rtl";
      valueElement.style.insetInlineStart = `${position}px`;
      rangeElement.style.background = `linear-gradient(${
        isRTL ? "to left" : "to right"
      }, var(--color-slider-track) 0%, var(--color-slider-track) ${progress}%, var(--button-bg) ${progress}%, var(--button-bg) 100%)`;
    }
  }, [max, min, value]);

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
          {value !== min ? value : null}
        </div>
        <div className="zero-label">{minLabel}</div>
      </div>
    </label>
  );
};
