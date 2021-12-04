import { FONT_FAMILY } from "../constants";
import { FontFamilyValues } from "../element/types";

const FontsList = ({
  onChange,
  currentFontFamily,
}: {
  onChange: (val: FontFamilyValues) => void;
  currentFontFamily: FontFamilyValues;
}) => {
  return (
    <select
      className="dropdown-select"
      onChange={(event) => {
        onChange(Number(event.target.value));
      }}
      value={currentFontFamily}
    >
      <option key="virgil" value={FONT_FAMILY.Virgil}>
        Hand-Drawn
      </option>
      <option key="helvetica" value={FONT_FAMILY.Helvetica}>
        Normal
      </option>
      <option key="cascadia" value={FONT_FAMILY.Cascadia}>
        code
      </option>
      <option key="redacted-regular" value={FONT_FAMILY.REDACTED_REGULAR}>
        Redacted Regular
      </option>
      <option
        key="redacted-script-regular"
        value={FONT_FAMILY.REDACTED_SCRIPT_REGULAR}
      >
        Redacted Script
      </option>
      <option
        key="redacted-script-bold"
        value={FONT_FAMILY.REDACTED_SCRIPT_BOLD}
      >
        Redacted Script BOLD
      </option>
      <option key="Scribble" value={FONT_FAMILY.SCRIBBLE}>
        Scribble
      </option>
      <option key="Blokk" value={FONT_FAMILY.BLOKK}>
        Blokk
      </option>
    </select>
  );
};

export default FontsList;
