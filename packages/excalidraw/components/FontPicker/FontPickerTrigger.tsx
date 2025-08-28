import * as Popover from "@radix-ui/react-popover";
import { useMemo } from "react";

import type { FontFamilyValues } from "@excalidraw/element/types";

import { t } from "../../i18n";
import { ButtonIcon } from "../ButtonIcon";
import { TextIcon } from "../icons";

import { isDefaultFont } from "./FontPicker";

interface FontPickerTriggerProps {
  selectedFontFamily: FontFamilyValues | null;
  onTrigger?: (event: React.SyntheticEvent) => void;
}

export const FontPickerTrigger = ({
  selectedFontFamily,
  onTrigger,
}: FontPickerTriggerProps) => {
  const isTriggerActive = useMemo(
    () => Boolean(selectedFontFamily && !isDefaultFont(selectedFontFamily)),
    [selectedFontFamily],
  );

  return (
    <Popover.Trigger asChild>
      {/* Empty div as trigger so it's stretched 100% due to different button sizes */}
      <div data-openpopup="fontFamily">
        <ButtonIcon
          standalone
          icon={TextIcon}
          title={t("labels.showFonts")}
          className="properties-trigger"
          testId={"font-family-show-fonts"}
          active={isTriggerActive}
          onClick={(e) => {
            if (onTrigger) {
              e.preventDefault();
              onTrigger(e);
            }
          }}
          style={{
            border: "none",
          }}
        />
      </div>
    </Popover.Trigger>
  );
};
