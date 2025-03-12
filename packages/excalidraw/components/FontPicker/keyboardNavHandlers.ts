import { KEYS } from "../../keys";

import { type FontDescriptor } from "./FontPickerList";

import type { Node } from "../../utils";

interface FontPickerKeyNavHandlerProps {
  event: React.KeyboardEvent<HTMLDivElement>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  hoveredFont: Node<FontDescriptor> | undefined;
  filteredFonts: Node<FontDescriptor>[];
  onClose: () => void;
  onSelect: (value: number) => void;
  onHover: (value: number) => void;
}

export const fontPickerKeyHandler = ({
  event,
  inputRef,
  hoveredFont,
  filteredFonts,
  onClose,
  onSelect,
  onHover,
}: FontPickerKeyNavHandlerProps) => {
  if (
    !event[KEYS.CTRL_OR_CMD] &&
    event.shiftKey &&
    event.key.toLowerCase() === KEYS.F
  ) {
    // refocus input on the popup trigger shortcut
    inputRef.current?.focus();
    return true;
  }

  if (event.key === KEYS.ESCAPE) {
    onClose();
    return true;
  }

  if (event.key === KEYS.ENTER) {
    if (hoveredFont?.value) {
      onSelect(hoveredFont.value);
    }

    return true;
  }

  if (event.key === KEYS.ARROW_DOWN) {
    if (hoveredFont?.next) {
      onHover(hoveredFont.next.value);
    } else if (filteredFonts[0]?.value) {
      onHover(filteredFonts[0].value);
    }

    return true;
  }

  if (event.key === KEYS.ARROW_UP) {
    if (hoveredFont?.prev) {
      onHover(hoveredFont.prev.value);
    } else if (filteredFonts[filteredFonts.length - 1]?.value) {
      onHover(filteredFonts[filteredFonts.length - 1].value);
    }

    return true;
  }
};
