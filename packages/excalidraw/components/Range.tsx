import React, { useContext, useEffect } from "react";

import { isBlurElement } from "@excalidraw/element/typeChecks";

import { t } from "../i18n";
import { ExcalidrawPropsCustomOptionsContext } from "../types";

import "./Range.scss";

import type { AppClassProperties } from "../types";

export type RangeProps = {
  updateData: (value: number) => void;
  app: AppClassProperties;
  testId?: string;
};

export const Range = ({ updateData, app, testId }: RangeProps) => {
  const rangeRef = React.useRef<HTMLInputElement>(null);
  const valueRef = React.useRef<HTMLDivElement>(null);
  const selectedElements = app.scene.getSelectedElements(app.state);
  let hasCommonOpacity = true;
  const firstElement = selectedElements.at(0);
  const leastCommonOpacity = selectedElements.reduce((acc, element) => {
    if (acc != null && acc !== element.opacity) {
      hasCommonOpacity = false;
    }
    if (acc == null || acc > element.opacity) {
      return element.opacity;
    }
    return acc;
  }, firstElement?.opacity ?? null);

  const value = leastCommonOpacity ?? app.state.currentItemOpacity;

  useEffect(() => {
    if (rangeRef.current && valueRef.current) {
      const rangeElement = rangeRef.current;
      const valueElement = valueRef.current;
      const inputWidth = rangeElement.offsetWidth;
      const thumbWidth = 15; // 15 is the width of the thumb
      const position =
        (value / 100) * (inputWidth - thumbWidth) + thumbWidth / 2;
      valueElement.style.left = `${position}px`;
      rangeElement.style.background = `linear-gradient(to right, var(--color-slider-track) 0%, var(--color-slider-track) ${value}%, var(--button-bg) ${value}%, var(--button-bg) 100%)`;
    }
  }, [value]);

  const customOptions = useContext(ExcalidrawPropsCustomOptionsContext);

  return (
    <label className="control-label">
      {t("labels.opacity")}
      {customOptions?.pickerRenders?.rangeRender ? (
        customOptions?.pickerRenders?.rangeRender({
          value,
          onChange: (value: number) => {
            updateData(value);
          },
          step: 10,
          min: 0,
          max: 100,
        })
      ) : (
        <div className="range-wrapper">
          <input
            style={{
              ["--color-slider-track" as string]: hasCommonOpacity
                ? undefined
                : "var(--button-bg)",
            }}
            ref={rangeRef}
            type="range"
            min="0"
            max="100"
            step="10"
            onChange={(event) => {
              updateData(+event.target.value);
            }}
            value={value}
            className="range-input"
            data-testid={testId}
          />
          <div className="value-bubble" ref={valueRef}>
            {value !== 0 ? value : null}
          </div>
          <div className="zero-label">0</div>
        </div>
      )}
    </label>
  );
};

export const BlurRange = ({ updateData, app, testId }: RangeProps) => {
  const rangeRef = React.useRef<HTMLInputElement>(null);
  const valueRef = React.useRef<HTMLDivElement>(null);
  const selectedElements = app.scene.getSelectedElements(app.state);
  let hasCommonBlur = true;
  const firstElement = selectedElements.at(0);
  const leastCommonBlur = selectedElements.reduce(
    (acc, element) => {
      if (!isBlurElement(element)) {
        return acc;
      }

      if (acc != null && acc !== element.blur) {
        hasCommonBlur = false;
      }
      if (acc == null || acc > element.blur) {
        return element.blur;
      }
      return acc;
    },
    isBlurElement(firstElement) ? firstElement.blur : null,
  );

  const value = leastCommonBlur ?? app.state.currentItemBlur;

  useEffect(() => {
    if (rangeRef.current && valueRef.current) {
      const rangeElement = rangeRef.current;
      const valueElement = valueRef.current;
      const inputWidth = rangeElement.offsetWidth;
      const thumbWidth = 15; // 15 is the width of the thumb
      const position =
        (value / 100) * (inputWidth - thumbWidth) + thumbWidth / 2;
      valueElement.style.left = `${position}px`;
      rangeElement.style.background = `linear-gradient(to right, var(--color-slider-track) 0%, var(--color-slider-track) ${value}%, var(--button-bg) ${value}%, var(--button-bg) 100%)`;
    }
  }, [value]);

  const customOptions = useContext(ExcalidrawPropsCustomOptionsContext);

  return (
    <label className="control-label">
      {t("labels.opacity")}
      {customOptions?.pickerRenders?.rangeRender ? (
        customOptions?.pickerRenders?.rangeRender({
          value,
          onChange: (value: number) => {
            updateData(value);
          },
          step: 10,
          min: 0,
          max: 100,
        })
      ) : (
        <div className="range-wrapper">
          <input
            style={{
              ["--color-slider-track" as string]: hasCommonBlur
                ? undefined
                : "var(--button-bg)",
            }}
            ref={rangeRef}
            type="range"
            min="0"
            max="100"
            step="10"
            onChange={(event) => {
              updateData(+event.target.value);
            }}
            value={value}
            className="range-input"
            data-testid={testId}
          />
          <div className="value-bubble" ref={valueRef}>
            {value !== 0 ? value : null}
          </div>
          <div className="zero-label">0</div>
        </div>
      )}
    </label>
  );
};
