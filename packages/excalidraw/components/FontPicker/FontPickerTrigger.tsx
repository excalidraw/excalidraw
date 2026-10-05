import { Popover } from "radix-ui";

import { MOBILE_ACTION_BUTTON_BG } from "@excalidraw/common";

import type { FontFamilyValues } from "@excalidraw/element/types";

import { t } from "../../i18n";
import { IconButton } from "../IconButton";
import { TextIcon } from "../icons";

import { useExcalidrawSetAppState } from "../App";

interface FontPickerTriggerProps {
  selectedFontFamily: FontFamilyValues | null;
  isOpened?: boolean;
  compactMode?: boolean;
}

export const FontPickerTrigger = ({
  selectedFontFamily,
  isOpened = false,
  compactMode = false,
}: FontPickerTriggerProps) => {
  const setAppState = useExcalidrawSetAppState();

  const compactStyle = compactMode
    ? {
        ...MOBILE_ACTION_BUTTON_BG,
        width: "2rem",
        height: "2rem",
      }
    : {};

  return (
    <Popover.Trigger asChild>
      <div data-openpopup="fontFamily" className="properties-trigger">
        <IconButton
          type="toggle"
          icon={TextIcon}
          title={t("labels.showFonts")}
          aria-label={t("labels.showFonts")}
          className="standalone properties-trigger"
          data-testid="font-family-show-fonts"
          checked={isOpened}
          onSelect={() => {
            setAppState((appState) => ({
              openPopup:
                appState.openPopup === "fontFamily" ? null : appState.openPopup,
            }));
          }}
          style={{
            border: "none",
            ...compactStyle,
          }}
        />
      </div>
    </Popover.Trigger>
  );
};
