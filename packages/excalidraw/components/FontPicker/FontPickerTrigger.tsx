import * as Popover from "@radix-ui/react-popover";
import { useMemo } from "react";

import type { FontFamilyValues } from "@excalidraw/element/types";

import { t } from "../../i18n";
import { ButtonIcon } from "../ButtonIcon";
import { TextIcon } from "../icons";
import { useExcalidrawAppState } from "../App";

import { isDefaultFont } from "./FontPicker";

interface FontPickerTriggerProps {
  selectedFontFamily: FontFamilyValues | null;
  onToggle: () => void;
  isOpened?: boolean;
}

export const FontPickerTrigger = ({
  selectedFontFamily,
  onToggle,
  isOpened = false,
}: FontPickerTriggerProps) => {
  const appState = useExcalidrawAppState();
  const isTriggerActive = useMemo(
    () => Boolean(selectedFontFamily && !isDefaultFont(selectedFontFamily)),
    [selectedFontFamily],
  );

  return (
    <Popover.Trigger asChild>
      <div
        data-openpopup="fontFamily"
        className="properties-trigger"
        onPointerDown={(e) => {
          // Prevent default behavior that might dismiss keyboard on mobile when editing text
          if (appState.editingTextElement) {
            e.preventDefault();
          }
        }}
      >
        <ButtonIcon
          standalone
          icon={TextIcon}
          title={t("labels.showFonts")}
          className="properties-trigger"
          testId={"font-family-show-fonts"}
          active={isTriggerActive || isOpened}
          onClick={() => {}} // Let Radix handle the toggle
          style={{
            border: "none",
          }}
        />
      </div>
    </Popover.Trigger>
  );
};
