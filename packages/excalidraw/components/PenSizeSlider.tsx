import { clamp } from "@excalidraw/math";
import {
  getAuthoringScale,
  getFreedrawStrokeDiameter,
} from "@excalidraw/element";

import type { StrokeVariability } from "@excalidraw/element/types";

import { t } from "../i18n";
import { useAppStateValue } from "../hooks/useAppStateValue";

import {
  PEN_SIZE_SLIDER_MAX,
  penSizeFromSlider,
  sliderFromPenSize,
} from "./penSize";

import "./Range.scss";
import "./PenSizeSlider.scss";

const PREVIEW_BOX = 24;

export const PenSizeSlider = ({
  value,
  variability,
  color,
  hasCommonValue,
  onChange,
}: {
  value: number;
  variability: StrokeVariability;
  color: string;
  hasCommonValue: boolean;
  onChange: (value: number) => void;
}) => {
  const position = sliderFromPenSize(value);
  const authoringToScreen = useAppStateValue(
    (state) => getAuthoringScale(state) * state.zoom.value,
  );
  const diameter = clamp(
    getFreedrawStrokeDiameter(value, variability) * authoringToScreen,
    2,
    PREVIEW_BOX,
  );
  const label = String(Number(value.toPrecision(2)));

  return (
    <label className="control-label pen-size-slider">
      {t("labels.penSize")}
      <div
        className="pen-size-slider__row"
        style={{
          ["--range-progress" as string]: position / PEN_SIZE_SLIDER_MAX,
        }}
      >
        <input
          style={{
            ["--color-slider-track" as string]: hasCommonValue
              ? undefined
              : "var(--button-bg)",
          }}
          type="range"
          min={0}
          max={PEN_SIZE_SLIDER_MAX}
          step={1}
          value={position}
          aria-valuetext={label}
          onChange={(event) => onChange(penSizeFromSlider(+event.target.value))}
          className="range-input"
          data-testid="pen-size-slider"
        />
        <div className="pen-size-slider__preview" aria-hidden="true">
          <span
            data-testid="pen-size-preview"
            style={{ width: diameter, height: diameter, background: color }}
          />
        </div>
        <span className="pen-size-slider__value">
          {hasCommonValue ? label : null}
        </span>
      </div>
    </label>
  );
};
