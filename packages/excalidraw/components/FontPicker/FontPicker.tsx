import { Popover } from "radix-ui";
import clsx from "clsx";
import React, { useCallback, useMemo } from "react";

import { FONT_FAMILY } from "@excalidraw/common";

import type { FontFamily } from "@excalidraw/common";

import { t } from "../../i18n";
import { RadioSelection } from "../RadioSelection";
import { ButtonSeparator } from "../ButtonSeparator";
import {
  FontFamilyCodeIcon,
  FontFamilyNormalIcon,
  FreedrawIcon,
} from "../icons";

import { FontPickerList, type FontSelectionOptions } from "./FontPickerList";
import { FontPickerTrigger } from "./FontPickerTrigger";

import "./FontPicker.scss";

export const DEFAULT_FONTS = [
  {
    value: FONT_FAMILY.Excalifont,
    icon: FreedrawIcon,
    text: t("labels.handDrawn"),
    testId: "font-family-hand-drawn",
  },
  {
    value: FONT_FAMILY.Nunito,
    icon: FontFamilyNormalIcon,
    text: t("labels.normal"),
    testId: "font-family-normal",
  },
  {
    value: FONT_FAMILY["Comic Shanns"],
    icon: FontFamilyCodeIcon,
    text: t("labels.code"),
    testId: "font-family-code",
  },
];

const defaultFontFamilies = new Set(DEFAULT_FONTS.map((x) => x.value));

export const isDefaultFont = (fontFamily: FontFamily | null) => {
  if (!fontFamily) {
    return false;
  }

  return defaultFontFamilies.has(fontFamily as number);
};

interface FontPickerProps {
  isOpened: boolean;
  selectedFontFamily: FontFamily | null;
  hoveredFontFamily: FontFamily | null;
  onSelect: (fontFamily: FontFamily, options?: FontSelectionOptions) => void;
  onHover: (fontFamily: FontFamily) => void;
  onLeave: () => void;
  onPopupChange: (open: boolean) => void;
  compactMode?: boolean;
}

export const FontPicker = React.memo(
  ({
    isOpened,
    selectedFontFamily,
    hoveredFontFamily,
    onSelect,
    onHover,
    onLeave,
    onPopupChange,
    compactMode = false,
  }: FontPickerProps) => {
    const defaultFonts = useMemo(() => DEFAULT_FONTS, []);
    const onSelectCallback = useCallback(
      (value: FontFamily | false) => {
        if (value) {
          onSelect(value);
        }
      },
      [onSelect],
    );

    return (
      <div
        role="dialog"
        aria-modal="true"
        className={clsx("FontPicker__container", {
          "FontPicker__container--compact": compactMode,
        })}
      >
        {!compactMode && (
          <div className="buttonList">
            <RadioSelection<FontFamily | false>
              type="button"
              options={defaultFonts}
              value={selectedFontFamily}
              onClick={onSelectCallback}
            />
          </div>
        )}
        {!compactMode && <ButtonSeparator />}
        <Popover.Root open={isOpened} onOpenChange={onPopupChange}>
          <FontPickerTrigger
            selectedFontFamily={selectedFontFamily}
            isOpened={isOpened}
            compactMode={compactMode}
          />
          {isOpened && (
            <FontPickerList
              selectedFontFamily={selectedFontFamily}
              hoveredFontFamily={hoveredFontFamily}
              onSelect={onSelect}
              onHover={onHover}
              onLeave={onLeave}
              onOpen={() => onPopupChange(true)}
              onClose={() => onPopupChange(false)}
            />
          )}
        </Popover.Root>
      </div>
    );
  },
  // deliberately narrow: the parent re-renders on every canvas interaction,
  // and only these props change what the picker shows. The price is that the
  // callback props may be closures from an older render - they must read live
  // state through stable handles (`app`, refs, setters), never render-scoped
  // props. See `onPopupChange` in `actionChangeFontFamily`
  (prev, next) =>
    prev.isOpened === next.isOpened &&
    prev.selectedFontFamily === next.selectedFontFamily &&
    prev.hoveredFontFamily === next.hoveredFontFamily &&
    prev.compactMode === next.compactMode,
);
