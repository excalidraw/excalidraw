import { useEffect, useRef } from "react";

import "./StrokeWidthRange.scss";

const STROKE_WIDTH_MIN = 1;
const STROKE_WIDTH_MAX = 16;
const STROKE_WIDTH_STEP = 1;

// Squiggle wave path (centered, with padding from edges so thick strokes don't clip)
const SQUIGGLE_PATH =
  "M16 28 C24 28, 28 12, 36 12 C44 12, 48 28, 56 28 C64 28, 68 12, 76 12 C80 12, 84 20, 84 20";

export const StrokeWidthRange = ({
  value,
  strokeColor,
  opacity,
  onChange,
}: {
  value: number;
  strokeColor: string;
  opacity: number;
  onChange: (value: number) => void;
}) => {
  const rangeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (rangeRef.current) {
      const pct =
        ((value - STROKE_WIDTH_MIN) / (STROKE_WIDTH_MAX - STROKE_WIDTH_MIN)) *
        100;
      rangeRef.current.style.background = `linear-gradient(to right, var(--color-slider-track) 0%, var(--color-slider-track) ${pct}%, var(--button-bg) ${pct}%, var(--button-bg) 100%)`;
    }
  }, [value]);

  return (
    <div className="stroke-width-range">
      <div className="stroke-width-range__preview">
        <svg
          width="100"
          height="40"
          viewBox="0 0 100 40"
          fill="none"
          aria-hidden="true"
        >
          <path
            d={SQUIGGLE_PATH}
            stroke={strokeColor}
            strokeOpacity={opacity / 100}
            strokeWidth={value}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>
      <input
        ref={rangeRef}
        type="range"
        min={STROKE_WIDTH_MIN}
        max={STROKE_WIDTH_MAX}
        step={STROKE_WIDTH_STEP}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="stroke-width-range__input"
        data-testid="strokeWidth-slider"
      />
    </div>
  );
};
