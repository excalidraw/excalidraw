import React, { useEffect, useImperativeHandle, useState } from "react";

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
  color: string | null;
  onChange: (color: string) => void;
  type: ColorPickerType;
  elements: readonly ExcalidrawElement[];
  palette: ColorPaletteCustom;
  updateData: (formData?: any) => void;
  children?: React.ReactNode;
  showTitle?: boolean;
  onEyeDropperToggle: (force?: boolean) => void;
  onEscape: (event: React.KeyboardEvent | KeyboardEvent) => void;
  showHotKey?: boolean;
}

export const Picker = React.forwardRef(
  (
    {
      color,
      onChange,
      type,
      elements,
      palette,
      updateData,
      children,
      showTitle,
      onEyeDropperToggle,
      onEscape,
      showHotKey = true,
    }: PickerProps,
    ref,
  ) => {
    const title = showTitle
      ? type === "elementStroke"
        ? t("labels.stroke")
        : type === "elementBackground"
        ? t("labels.background")
        : null
      : null;

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
        const isCustom = !!color && isCustomColor({ color, palette });
        const isCustomButNotInList = isCustom && !customColors.includes(color);

        setActiveColorPickerSection(
          isCustomButNotInList
            ? null
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

    useImperativeHandle(ref, () => pickerRef.current!);

    useEffect(() => {
      pickerRef?.current?.focus();
    }, []);

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
          {title && <div className="color-picker__title">{title}</div>}

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
              palette={palette}
              onChange={onChange}
              activeShade={activeShade}
              showHotKey={showHotKey}
            />
          </div>

          <div>
            <PickerHeading>{t("colorPicker.shades")}</PickerHeading>
            <ShadeList
              color={color}
              onChange={onChange}
              palette={palette}
              showHotKey={showHotKey}
            />
          </div>
          {children}
        </div>
      </div>
    );
  },
);
