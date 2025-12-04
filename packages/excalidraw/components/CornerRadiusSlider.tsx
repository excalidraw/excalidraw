import React, { useEffect } from "react";

import { ROUNDNESS, DEFAULT_ADAPTIVE_RADIUS } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { t } from "../i18n";

import "./CornerRadiusSlider.scss";

import type { AppClassProperties } from "../types";

export type CornerRadiusSliderProps = {
  elements: readonly ExcalidrawElement[];
  updateData: (radius: number) => void;
  app: AppClassProperties;
};

export const CornerRadiusSlider = ({
  elements,
  updateData,
  app,
}: CornerRadiusSliderProps) => {
  const rangeRef = React.useRef<HTMLInputElement>(null);
  const valueRef = React.useRef<HTMLDivElement>(null);

  // Calculate current radius from elements (minimum across selection)
  const getCurrentRadius = () => {
    const radii = elements
      .filter((el) => el.roundness?.type === ROUNDNESS.ADAPTIVE_RADIUS)
      .map((el) => el.roundness?.value ?? DEFAULT_ADAPTIVE_RADIUS);

    if (radii.length === 0) {
      return DEFAULT_ADAPTIVE_RADIUS;
    }

    // Use minimum radius (consistent with Range.tsx pattern)
    return Math.min(...radii);
  };

  // Check if all elements have same radius
  const hasCommonRadius = () => {
    const radii = elements
      .filter((el) => el.roundness?.type === ROUNDNESS.ADAPTIVE_RADIUS)
      .map((el) => el.roundness?.value ?? DEFAULT_ADAPTIVE_RADIUS);

    if (radii.length === 0) {
      return true;
    }

    return radii.every((r) => r === radii[0]);
  };

  // Calculate dynamic maximum: min across all selected elements
  const maxRadius = Math.floor(
    Math.min(
      ...elements.map((el) => Math.min(el.width, el.height) / 2),
      200, // Reasonable cap for very large elements
    ),
  );

  const leastCommonRadius = getCurrentRadius();
  const hasCommon = hasCommonRadius();

  // Use leastCommonRadius as the current value
  const value = leastCommonRadius;

  useEffect(() => {
    if (rangeRef.current && valueRef.current) {
      const rangeElement = rangeRef.current;
      const valueElement = valueRef.current;
      const inputWidth = rangeElement.offsetWidth;
      const thumbWidth = 15; // 15 is the width of the thumb
      const percentage = value / maxRadius;
      const position = percentage * (inputWidth - thumbWidth) + thumbWidth / 2;
      valueElement.style.left = `${position}px`;
      rangeElement.style.background = `linear-gradient(to right, var(--color-slider-track) 0%, var(--color-slider-track) ${
        percentage * 100
      }%, var(--button-bg) ${percentage * 100}%, var(--button-bg) 100%)`;
    }
  }, [value, maxRadius]);

  return (
    <label className="control-label">
      {t("labels.cornerRadius")}
      <div className="range-wrapper">
        <input
          style={{
            ["--color-slider-track" as string]: hasCommon
              ? undefined
              : "var(--button-bg)",
          }}
          ref={rangeRef}
          type="range"
          min="0"
          max={maxRadius}
          step="4"
          onChange={(event) => {
            updateData(+event.target.value);
          }}
          value={value}
          className="range-input"
          data-testid="cornerRadius-slider"
        />
        <div className="value-bubble" ref={valueRef}>
          {value !== 0 ? value : null}
        </div>
        <div className="zero-label">0</div>
      </div>
    </label>
  );
};
