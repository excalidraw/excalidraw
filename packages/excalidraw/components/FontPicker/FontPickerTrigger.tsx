import * as Popover from "@radix-ui/react-popover";

import type { FontFamilyValues } from "@excalidraw/element/types";

import { t } from "../../i18n";
import { ButtonIcon } from "../ButtonIcon";
import { TextIcon } from "../icons";

import { useExcalidrawSetAppState } from "../App";

interface FontPickerTriggerProps {
  selectedFontFamily: FontFamilyValues | null;
  isOpened?: boolean;
}

export const FontPickerTrigger = ({
  selectedFontFamily,
  isOpened = false,
}: FontPickerTriggerProps) => {
  const setAppState = useExcalidrawSetAppState();

  return (
    <Popover.Trigger asChild>
      <div data-openpopup="fontFamily" className="properties-trigger">
        <ButtonIcon
          standalone
          icon={TextIcon}
          title={t("labels.showFonts")}
          className="properties-trigger"
          testId={"font-family-show-fonts"}
          active={isOpened}
          onClick={() => {
            setAppState((appState) => ({
              openPopup:
                appState.openPopup === "fontFamily" ? null : appState.openPopup,
            }));
          }}
          style={{
            border: "none",
          }}
        />
      </div>
    </Popover.Trigger>
  );
};
