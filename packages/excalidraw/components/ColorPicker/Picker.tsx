import React, { useEffect, useState } from "react";

import { EVENT } from "@excalidraw/common";

import {
  DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX,
  DEFAULT_ELEMENT_STROKE_COLOR_INDEX,
  KEYS,
} from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { ColorPaletteCustom } from "@excalidraw/common";

import { useAtom } from "../../editor-jotai";
import { t } from "../../i18n";

import { CustomColorList } from "./CustomColorList";
import PickerColorList from "./PickerColorList";
import PickerHeading from "./PickerHeading";
import { ShadeList } from "./ShadeList";
import {
  activeColorPickerSectionAtom,
  getColorNameAndShadeFromColor,
  getMostUsedCustomColors,
  isCustomColor,
} from "./colorPickerUtils";
import { colorPickerKeyNavHandler } from "./keyboardNavHandlers";

import type { ColorPickerType } from "./colorPickerUtils";

interface PickerProps {
  color: string;
  onChange: (color: string) => void;
  label: string;
  type: ColorPickerType;
  elements: readonly ExcalidrawElement[];
  palette: ColorPaletteCustom;
  updateData: (formData?: any) => void;
  children?: React.ReactNode;
  onEyeDropperToggle: (force?: boolean) => void;
  onEscape: (event: React.KeyboardEvent | KeyboardEvent) => void;
}

export const Picker = ({
  color,
  onChange,
  label,
  type,
  elements,
  palette,
  updateData,
  children,
  onEyeDropperToggle,
  onEscape,
}: PickerProps) => {
  const [customColors] = React.useState(() => {
    if (type === "canvasBackground") {
      return [];
    }
    return getMostUsedCustomColors(elements, type, palette);
  });

  const [activeColorPickerSection, setActiveColorPickerSection] = useAtom(
    activeColorPickerSectionAtom,
  );

  const colorObj = getColorNameAndShadeFromColor({
    color,
    palette,
  });

  useEffect(() => {
    if (!activeColorPickerSection) {
      const isCustom = isCustomColor({ color, palette });
      const isCustomButNotInList = isCustom && !customColors.includes(color);

      setActiveColorPickerSection(
        isCustomButNotInList
          ? "hex"
          : isCustom
          ? "custom"
          : colorObj?.shade != null
          ? "shades"
          : "baseColors",
      );
    }
  }, [
    activeColorPickerSection,
    color,
    palette,
    setActiveColorPickerSection,
    colorObj,
    customColors,
  ]);

  const [activeShade, setActiveShade] = useState(
    colorObj?.shade ??
      (type === "elementBackground"
        ? DEFAULT_ELEMENT_BACKGROUND_COLOR_INDEX
        : DEFAULT_ELEMENT_STROKE_COLOR_INDEX),
  );

  useEffect(() => {
    if (colorObj?.shade != null) {
      setActiveShade(colorObj.shade);
    }

    const keyup = (event: KeyboardEvent) => {
      if (event.key === KEYS.ALT) {
        onEyeDropperToggle(false);
      }
    };
    document.addEventListener(EVENT.KEYUP, keyup, { capture: true });
    return () => {
      document.removeEventListener(EVENT.KEYUP, keyup, { capture: true });
    };
  }, [colorObj, onEyeDropperToggle]);

  const pickerRef = React.useRef<HTMLDivElement>(null);

  return (
    <div role="dialog" aria-modal="true" aria-label={t("labels.colorPicker")}>
      <div
        ref={pickerRef}
        onKeyDown={(event) => {
          const handled = colorPickerKeyNavHandler({
            event,
            activeColorPickerSection,
            palette,
            color,
            onChange,
            onEyeDropperToggle,
            customColors,
            setActiveColorPickerSection,
            updateData,
            activeShade,
            onEscape,
          });

          if (handled) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        className="color-picker-content properties-content"
        // to allow focusing by clicking but not by tabbing
        tabIndex={-1}
      >
        {!!customColors.length && (
          <div>
            <PickerHeading>
              {t("colorPicker.mostUsedCustomColors")}
            </PickerHeading>
            <CustomColorList
              colors={customColors}
              color={color}
              label={t("colorPicker.mostUsedCustomColors")}
              onChange={onChange}
            />
          </div>
        )}

        <div>
          <PickerHeading>{t("colorPicker.colors")}</PickerHeading>
          <PickerColorList
            color={color}
            label={label}
            palette={palette}
            onChange={onChange}
            activeShade={activeShade}
          />
        </div>

        <div>
          <PickerHeading>{t("colorPicker.shades")}</PickerHeading>
          <ShadeList hex={color} onChange={onChange} palette={palette} />
        </div>
        {children}
      </div>
    </div>
  );
};
