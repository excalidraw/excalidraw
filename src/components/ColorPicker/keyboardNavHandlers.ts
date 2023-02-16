import {
  COLOR_PER_ROW,
  Palette,
  ActiveColorPickerSectionAtomType,
  colorPickerHotkeyBindings,
  getColorNameAndShadeFromHex,
} from "./colorPickerUtils";

const arrowHandler = (
  eventKey: string,
  currentIndex: number,
  length: number,
) => {
  const rows = Math.ceil(length / COLOR_PER_ROW);

  switch (eventKey) {
    case "ArrowLeft": {
      const prevIndex = currentIndex - 1;
      return prevIndex < 0 ? length - 1 : prevIndex;
    }
    case "ArrowRight": {
      return (currentIndex + 1) % length;
    }
    case "ArrowDown": {
      const nextIndex = currentIndex + COLOR_PER_ROW;
      return nextIndex >= length ? currentIndex % COLOR_PER_ROW : nextIndex;
    }
    case "ArrowUp": {
      const prevIndex = currentIndex - COLOR_PER_ROW;
      const newIndex =
        prevIndex < 0 ? COLOR_PER_ROW * rows + prevIndex : prevIndex;
      return newIndex >= length ? undefined : newIndex;
    }
  }
};

interface HotkeyHandlerProps {
  e: React.KeyboardEvent;
  colorObj: {
    colorName: string;
    shade: number;
  } | null;
  onChange: (color: string) => void;
  palette: Palette;
  customColors: string[];
  setActiveColorPickerSection: (
    update: React.SetStateAction<ActiveColorPickerSectionAtomType>,
  ) => void;
  activeShade: number;
}

const hotkeyHandler = ({
  e,
  colorObj,
  onChange,
  palette,
  customColors,
  setActiveColorPickerSection,
  activeShade,
}: HotkeyHandlerProps) => {
  if (colorObj && colorObj.shade >= 0) {
    // shift + numpad is extremely messed up on windows apparently
    if (
      ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"].includes(e.code) &&
      e.shiftKey
    ) {
      const newShade = Number(e.code.slice(-1)) - 1;
      onChange(palette[colorObj.colorName][newShade]);
      setActiveColorPickerSection("shades");
    }
  }

  if (["1", "2", "3", "4", "5"].includes(e.key)) {
    const c = customColors[Number(e.key) - 1];
    if (c) {
      onChange(customColors[Number(e.key) - 1]);
      setActiveColorPickerSection("custom");
    }
  }

  if (colorPickerHotkeyBindings.includes(e.key)) {
    const index = colorPickerHotkeyBindings.indexOf(e.key);
    const paletteKey = Object.keys(palette)[index];
    const paletteValue = palette[paletteKey];
    const r = Array.isArray(paletteValue)
      ? paletteValue[activeShade]
      : paletteValue;
    onChange(r);
    setActiveColorPickerSection("baseColors");
  }
};

interface ColorPickerKeyNavHandlerProps {
  e: React.KeyboardEvent;
  activeColorPickerSection: ActiveColorPickerSectionAtomType;
  palette: Palette;
  hex: string | null;
  onChange: (color: string) => void;
  customColors: string[];
  setActiveColorPickerSection: (
    update: React.SetStateAction<ActiveColorPickerSectionAtomType>,
  ) => void;
  updateData: (formData?: any) => void;
  activeShade: number;
}

export const colorPickerKeyNavHandler = ({
  e,
  activeColorPickerSection,
  palette,
  hex,
  onChange,
  customColors,
  setActiveColorPickerSection,
  updateData,
  activeShade,
}: ColorPickerKeyNavHandlerProps) => {
  if (e.key === "Escape" || !hex) {
    updateData({ openPopup: null });
    return;
  }

  const colorObj = getColorNameAndShadeFromHex({ hex, palette });

  if (e.key === "Tab") {
    const sectionsMap: Record<
      Exclude<ActiveColorPickerSectionAtomType, null>,
      boolean
    > = {
      custom: !!customColors.length,
      baseColors: true,
      shades: !!(colorObj && colorObj.shade >= 0),
      hex: true,
    };

    const sections = Object.entries(sectionsMap).reduce((acc, [key, value]) => {
      if (value) {
        acc.push(key as ActiveColorPickerSectionAtomType);
      }
      return acc;
    }, [] as ActiveColorPickerSectionAtomType[]);

    const activeSectionIndex = sections.indexOf(activeColorPickerSection);
    const nextSectionIndex = (activeSectionIndex + 1) % sections.length;
    const nextSection = sections[nextSectionIndex];

    if (nextSection) {
      setActiveColorPickerSection(nextSection);
    }

    if (nextSection === "custom") {
      onChange(customColors[0]);
    } else if (
      activeColorPickerSection === "custom" ||
      activeColorPickerSection === "hex"
    ) {
      const keys = Object.keys(palette);
      const firstColor = palette[keys[0]];

      onChange(
        Array.isArray(firstColor) ? firstColor[activeShade] : firstColor,
      );
    }

    e.preventDefault();
    e.stopPropagation();

    return;
  }

  hotkeyHandler({
    e,
    colorObj,
    onChange,
    palette,
    customColors,
    setActiveColorPickerSection,
    activeShade,
  });

  if (activeColorPickerSection === "shades") {
    if (colorObj) {
      const { shade } = colorObj;
      const newShade = arrowHandler(e.key, shade, COLOR_PER_ROW);

      if (newShade !== undefined) {
        onChange(palette[colorObj.colorName][newShade]);
      }
    }
  }

  if (activeColorPickerSection === "baseColors") {
    if (colorObj) {
      const { colorName } = colorObj;
      const colorNames = Object.keys(palette);
      const indexOfColorName = colorNames.indexOf(colorName);

      const newColorIndex = arrowHandler(
        e.key,
        indexOfColorName,
        colorNames.length,
      );

      if (newColorIndex !== undefined) {
        const newColorName = colorNames[newColorIndex];
        const newColorNameValue = palette[newColorName];

        onChange(
          Array.isArray(newColorNameValue)
            ? newColorNameValue[activeShade]
            : newColorNameValue,
        );
      }
    }
  }

  if (activeColorPickerSection === "custom") {
    const indexOfColor = customColors.indexOf(hex);

    const newColorIndex = arrowHandler(
      e.key,
      indexOfColor,
      customColors.length,
    );

    if (newColorIndex !== undefined) {
      const newColor = customColors[newColorIndex];
      onChange(newColor);
    }
  }
};
