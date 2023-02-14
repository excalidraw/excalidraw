import React, { useEffect, useState } from "react";
import { t } from "../../i18n";

import { ExcalidrawElement } from "../../element/types";
import { ShadeList } from "./ShadeList";

import { ColorInput } from "./ColorInput";
import PickerColorList from "./PickerColorList";
import { useAtom } from "jotai";
import { CustomColorList } from "./CustomColorList";
import { colorPickerKeyNavHandler } from "./keyboardNavHandlers";
import PickerHeading from "./PickerHeading";
import {
  DEFAULT_SHADE_INDEXES,
  Palette,
  activeColorPickerSectionAtom,
  getColorNameAndShadeFromHex,
  getMostUsedCustomColors,
  isCustomColor,
} from "./colorPickerUtils";

interface PickerProps {
  colors: string[];
  color: string | null;
  onChange: (color: string) => void;
  label: string;
  showInput: boolean;
  type: "canvasBackground" | "elementBackground" | "elementStroke";
  elements: readonly ExcalidrawElement[];
  palette: Palette;
  updateData: (formData?: any) => void;
}

export const Picker = ({
  color,
  onChange,
  label,
  showInput = true,
  type,
  elements,
  palette,
  updateData,
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

  useEffect(() => {
    if (!activeColorPickerSection) {
      setActiveColorPickerSection(
        isCustomColor({ color, palette }) ? "custom" : "shades",
      );
    }
  }, [activeColorPickerSection, color, palette, setActiveColorPickerSection]);

  const colorObj = getColorNameAndShadeFromHex({
    hex: color || "transparent",
    palette,
  });

  const initialShade =
    colorObj && colorObj.shade >= 0
      ? colorObj.shade
      : DEFAULT_SHADE_INDEXES[type];

  const [activeShade, setActiveShade] = useState(initialShade);

  useEffect(() => {
    if (colorObj && colorObj.shade >= 0) {
      setActiveShade(colorObj.shade);
    }
  }, [colorObj]);

  return (
    <div role="dialog" aria-modal="true" aria-label={t("labels.colorPicker")}>
      <div
        onKeyDown={(e) => {
          e.preventDefault();
          e.stopPropagation();

          colorPickerKeyNavHandler({
            e,
            activeColorPickerSection,
            palette,
            hex: color,
            onChange,
            customColors,
            setActiveColorPickerSection,
            updateData,
            activeShade,
          });
        }}
        className="color-picker-content"
        // to allow focusing by clicking but not by tabbing
        tabIndex={-1}
      >
        {!!customColors.length && (
          <div>
            {/* TODO color picker redesign */}
            {/* add i18n label instead of hardcoded text */}
            <PickerHeading>Most used custom colors</PickerHeading>
            <CustomColorList
              colors={customColors}
              color={color}
              label="Most used custom colors"
              onChange={onChange}
            />
          </div>
        )}

        <div>
          {/* TODO color picker redesign */}
          {/* add i18n label instead of hardcoded text */}
          <PickerHeading>Colors</PickerHeading>
          <PickerColorList
            color={color}
            label={label}
            palette={palette}
            onChange={onChange}
            activeShade={activeShade}
          />
        </div>

        <div>
          {/* TODO color picker redesign */}
          {/* add i18n label instead of hardcoded text */}
          <PickerHeading>Shades</PickerHeading>
          <ShadeList hex={color} onChange={onChange} palette={palette} />
        </div>

        {showInput && (
          <div>
            {/* TODO color picker redesign */}
            {/* add i18n label instead of hardcoded text */}
            <PickerHeading>Hex code</PickerHeading>
            <ColorInput
              color={color}
              label={label}
              onChange={(color) => {
                onChange(color);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
