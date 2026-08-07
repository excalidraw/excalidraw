import { Popover } from "radix-ui";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

import { FONT_SIZES } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { t } from "../../i18n";
import { useExcalidrawContainer } from "../App";
import { ButtonSeparator } from "../ButtonSeparator";
import { PropertiesPopover } from "../PropertiesPopover";
import {
  FontSizeSmallIcon,
  FontSizeMediumIcon,
  FontSizeLargeIcon,
  FontSizeExtraLargeIcon,
} from "../icons";

import "./FontSizePicker.scss";

import type { AppState } from "../../types";

const PX_PER_PT = 96 / 72; // ~1.333

const pxToPt = (px: number) => Math.round(px / PX_PER_PT);
const ptToPx = (pt: number) => Math.round(pt * PX_PER_PT);

const INLINE_PRESETS = [
  {
    value: FONT_SIZES.sm,
    icon: FontSizeSmallIcon,
    label: "S",
    title: "Small",
    testId: "fontSize-small",
  },
  {
    value: FONT_SIZES.md,
    icon: FontSizeMediumIcon,
    label: "M",
    title: "Medium",
    testId: "fontSize-medium",
  },
  {
    value: FONT_SIZES.lg,
    icon: FontSizeLargeIcon,
    label: "L",
    title: "Large",
    testId: "fontSize-large",
  },
  {
    value: FONT_SIZES.xl,
    icon: FontSizeExtraLargeIcon,
    label: "XL",
    title: "Very large",
    testId: "fontSize-veryLarge",
  },
];

const ALL_PRESET_ENTRIES: { label: string; value: number }[] = [
  { label: "2XS", value: FONT_SIZES["2xs"] },
  { label: "XS", value: FONT_SIZES.xs },
  { label: "S", value: FONT_SIZES.sm },
  { label: "M", value: FONT_SIZES.md },
  { label: "L", value: FONT_SIZES.lg },
  { label: "XL", value: FONT_SIZES.xl },
  { label: "2XL", value: FONT_SIZES["2xl"] },
  { label: "3XL", value: FONT_SIZES["3xl"] },
  { label: "4XL", value: FONT_SIZES["4xl"] },
  { label: "5XL", value: FONT_SIZES["5xl"] },
  { label: "8XL", value: FONT_SIZES["8xl"] },
  { label: "10XL", value: FONT_SIZES["10xl"] },
];

const DROPDOWN_SIZES_PX = [...Object.values(FONT_SIZES), 160, 180, 200, 240];

// --- Sub-components ---

const FontSizeTopPicks = ({
  activeValue,
  onChange,
}: {
  activeValue: number | null;
  onChange: (value: number) => void;
}) => {
  return (
    <div className="font-size-picker__top-picks">
      {INLINE_PRESETS.map((preset) => (
        <button
          key={preset.value}
          type="button"
          className={clsx("font-size-picker__top-pick", {
            active: activeValue === preset.value,
          })}
          title={preset.title}
          onClick={() => onChange(preset.value)}
          data-testid={preset.testId}
        >
          {preset.icon}
        </button>
      ))}
    </div>
  );
};

const FontSizeTrigger = ({
  currentValue,
  unit,
  isOpen,
  onToggle,
}: {
  currentValue: number | null;
  unit: "px" | "pt";
  isOpen: boolean;
  onToggle: () => void;
}) => {
  let displayValue: string;
  if (currentValue === null) {
    displayValue = "\u2014";
  } else {
    const numeric =
      unit === "pt" ? pxToPt(currentValue) : Math.round(currentValue);
    displayValue = numeric.toString();
  }

  return (
    <Popover.Trigger
      type="button"
      className={clsx("font-size-picker__trigger", {
        active: isOpen,
      })}
      aria-label={t("labels.currentSize")}
      title={t("labels.currentSize")}
      data-openpopup="fontSize"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
    >
      {displayValue}
    </Popover.Trigger>
  );
};

const FontSizePopoverContent = ({
  currentValue,
  unit,
  onUnitChange,
  onChange,
  updateData,
  getOpenPopup,
  appState,
}: {
  currentValue: number | null;
  unit: "px" | "pt";
  onUnitChange: (unit: "px" | "pt") => void;
  onChange: (value: number) => void;
  updateData: (formData?: any) => void;
  getOpenPopup: () => AppState["openPopup"];
  appState: AppState;
}) => {
  const { container } = useExcalidrawContainer();

  const toDisplay = (px: number) => (unit === "pt" ? pxToPt(px) : px);

  const handlePresetClick = (valuePx: number) => {
    onChange(valuePx);
  };

  const handleDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const raw = Number(e.target.value);
    const px = unit === "pt" ? ptToPx(raw) : raw;
    onChange(px);
  };

  return (
    <PropertiesPopover
      container={container}
      style={{ maxWidth: "14rem" }}
      preventAutoFocusOnTouch={!!appState.editingTextElement}
      onClose={() => {
        if (getOpenPopup() === "fontSize") {
          updateData({ openPopup: null });
        }
      }}
    >
      <div className="font-size-picker__popover-content">
        {/* Presets grid */}
        <div>
          <div className="font-size-picker__section-label">
            {t("labels.fontSizePresets")}
          </div>
          <div className="font-size-picker__preset-grid">
            {ALL_PRESET_ENTRIES.map((entry) => (
              <button
                key={entry.value}
                type="button"
                className={clsx("font-size-picker__preset-button", {
                  active: currentValue === entry.value,
                })}
                title={`${entry.label} (${entry.value}px)`}
                onClick={() => handlePresetClick(entry.value)}
                data-testid={`fontSize-preset-${entry.label}`}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom size dropdown + unit selector */}
        <div>
          <div className="font-size-picker__section-label">
            {t("labels.fontSizeCustom")}
          </div>
          <div className="font-size-picker__custom-row">
            <select
              className="font-size-picker__select"
              value={
                currentValue !== null ? toDisplay(currentValue).toString() : ""
              }
              onChange={handleDropdownChange}
              data-testid="fontSize-dropdown"
            >
              {DROPDOWN_SIZES_PX.map((sizePx) => {
                const displayVal = toDisplay(sizePx);
                return (
                  <option key={sizePx} value={displayVal}>
                    {displayVal}
                  </option>
                );
              })}
            </select>
            <div className="font-size-picker__unit-selector">
              <button
                type="button"
                className={clsx("font-size-picker__unit-button", {
                  active: unit === "px",
                })}
                onClick={() => onUnitChange("px")}
              >
                px
              </button>
              <button
                type="button"
                className={clsx("font-size-picker__unit-button", {
                  active: unit === "pt",
                })}
                onClick={() => onUnitChange("pt")}
              >
                pt
              </button>
            </div>
          </div>
        </div>
      </div>
    </PropertiesPopover>
  );
};

// --- Main Component ---

interface FontSizePickerProps {
  fontSize: number | null;
  onChange: (value: number) => void;
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  updateData: (formData?: any) => void;
}

export const FontSizePicker = ({
  fontSize,
  onChange,
  appState,
  updateData,
}: FontSizePickerProps) => {
  const openRef = useRef(appState.openPopup);
  useEffect(() => {
    openRef.current = appState.openPopup;
  }, [appState.openPopup]);

  const [unit, setUnit] = useState<"px" | "pt">("px");
  const isOpen = appState.openPopup === "fontSize";

  const handleToggle = () => {
    if (isOpen) {
      updateData({ openPopup: null });
    } else {
      updateData({ openPopup: "fontSize" });
    }
  };

  return (
    <div>
      <div className="font-size-picker-container">
        <FontSizeTopPicks activeValue={fontSize} onChange={onChange} />
        <ButtonSeparator />
        <Popover.Root
          open={isOpen}
          onOpenChange={(open) => {
            if (open) {
              updateData({ openPopup: "fontSize" });
            }
          }}
        >
          <FontSizeTrigger
            currentValue={fontSize}
            unit={unit}
            isOpen={isOpen}
            onToggle={handleToggle}
          />
          {isOpen && (
            <FontSizePopoverContent
              currentValue={fontSize}
              unit={unit}
              onUnitChange={setUnit}
              onChange={onChange}
              updateData={updateData}
              getOpenPopup={() => openRef.current}
              appState={appState}
            />
          )}
        </Popover.Root>
      </div>
    </div>
  );
};
