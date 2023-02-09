import React from "react";
// import { Popover } from "../Popover";
import { isTransparent, Palette } from "../../utils";

import "./ColorPicker.scss";
import colors from "../../colors";
import { ExcalidrawElement } from "../../element/types";
import { AppState } from "../../types";

import oc from "open-color";
import { TopPicks } from "./TopPicks";
import { activeColorPickerSectionAtom, isCustomColor, Picker } from "./Picker";
import ActiveColor from "./ActiveColor";

import * as Popover from "@radix-ui/react-popover";
import { customOrPaletteHandler } from "./keyboardNavHandlers";
import { useAtom } from "jotai";

export const ocPalette: Palette = {};
for (const [key, value] of Object.entries({
  transparent: "transparent",
  ...oc,
})) {
  if (key === "grape") {
    continue;
  }
  if (Array.isArray(value)) {
    // @ts-ignore
    ocPalette[key] = value.filter((_, i) => i % 2 === 0);
  } else {
    ocPalette[key] = value;
  }
}
// console.log(ocPalette);

export const strokeTopPicks = [
  ocPalette.black as string,
  ocPalette.red[3],
  ocPalette.green[3],
  ocPalette.blue[3],
  ocPalette.orange[3],
];
export const bgTopPicks = [
  ocPalette.gray[1],
  ocPalette.red[1],
  ocPalette.green[1],
  ocPalette.blue[1],
  ocPalette.orange[1],
];

const MAX_CUSTOM_COLORS = 5;
export const MAX_DEFAULT_COLORS = 15;

// export const getCustomColors = (
//   elements: readonly ExcalidrawElement[],
//   type: "elementBackground" | "elementStroke",
// ) => {
//   const customColors: string[] = [];
//   const updatedElements = elements
//     .filter((element) => !element.isDeleted)
//     .sort((ele1, ele2) => ele2.updated - ele1.updated);

//   let index = 0;
//   const elementColorTypeMap = {
//     elementBackground: "backgroundColor",
//     elementStroke: "strokeColor",
//   };
//   const colorType = elementColorTypeMap[type] as
//     | "backgroundColor"
//     | "strokeColor";
//   while (
//     index < updatedElements.length &&
//     customColors.length < MAX_CUSTOM_COLORS
//   ) {
//     const element = updatedElements[index];

//     if (
//       customColors.length < MAX_CUSTOM_COLORS &&
//       isCustomColor(element[colorType], type) &&
//       !customColors.includes(element[colorType])
//     ) {
//       customColors.push(element[colorType]);
//     }
//     index++;
//   }
//   return customColors;
// };

// export const isCustomColor = (
//   color: string,
//   type: "elementBackground" | "elementStroke",
// ) => {
//   return !colors[type].includes(color);
// };

const isValidColor = (color: string) => {
  const style = new Option().style;
  style.color = color;
  return !!style.color;
};

export const getColor = (color: string): string | null => {
  if (isTransparent(color)) {
    return color;
  }

  // testing for `#` first fixes a bug on Electron (more specfically, an
  // Obsidian popout window), where a hex color without `#` is (incorrectly)
  // considered valid
  return isValidColor(`#${color}`)
    ? `#${color}`
    : isValidColor(color)
    ? color
    : null;
};

// This is a narrow reimplementation of the awesome react-color Twitter component
// https://github.com/casesandberg/react-color/blob/master/src/components/twitter/Twitter.js

// Unfortunately, we can't detect keyboard layout in the browser. So this will
// only work well for QWERTY but not AZERTY or others...
export const keyBindings = [
  ["1", "2", "3", "4", "5"],
  ["q", "w", "e", "r", "t"],
  ["a", "s", "d", "f", "g"],
  ["z", "x", "c", "v", "b"],
].flat();

export interface ColorPickerProps {
  type: "canvasBackground" | "elementBackground" | "elementStroke";
  color: string | null;
  onChange: (color: string) => void;
  label: string;
  isActive: boolean;
  setActive: (active: boolean) => void;
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  palette?: Palette;
}

export const ColorPicker = ({
  type,
  color,
  onChange,
  label,
  isActive,
  setActive,
  elements,
  appState,
  palette = ocPalette,
}: ColorPickerProps) => {
  const pickerButton = React.useRef<HTMLButtonElement>(null);
  const coords = pickerButton.current?.getBoundingClientRect();

  const [activeColorPickerSection, setActiveColorPickerSection] = useAtom(
    activeColorPickerSectionAtom,
  );

  return (
    <div>
      <div role="dialog" aria-modal="true" className="color-picker-container">
        <TopPicks activeColor={color} onChange={onChange} type={type} />
        <div
          style={{
            width: 1,
            height: 20,
            backgroundColor: "var(--default-border-color)",
            margin: "0 auto",
          }}
        />
        <Popover.Root>
          <ActiveColor
            color={color}
            isActive={isActive}
            label={label}
            setActive={setActive}
            pickerButton={pickerButton}
          />

          <Popover.Portal
            container={document.querySelector(".excalidraw") as HTMLDivElement}
          >
            <Popover.Content
              onCloseAutoFocus={() => {
                const b = isCustomColor({ color, palette });
                console.log(b);

                setActiveColorPickerSection(null);
              }}
              data-prevent-outside-click
              side="right"
              align="start"
              alignOffset={-16}
              sideOffset={42}
              style={{
                zIndex: 9999,
                backgroundColor: "var(--popup-bg-color)",
                maxWidth: "184px",
                padding: "12px 16px",
                borderRadius: "8px",
                boxShadow:
                  "0px 7px 14px rgba(0, 0, 0, 0.05), 0px 0px 3.12708px rgba(0, 0, 0, 0.0798), 0px 0px 0.931014px rgba(0, 0, 0, 0.1702)",
              }}
            >
              <Picker
                palette={palette}
                colors={colors[type]}
                color={color || null}
                onChange={(changedColor) => {
                  onChange(changedColor);
                }}
                onClose={() => {
                  setActive(false);
                  pickerButton.current?.focus();
                }}
                label={label}
                showInput
                type={type}
                elements={elements}
              />
              <Popover.Arrow
                width={20}
                height={10}
                style={{
                  fill: "var(--popup-bg-color)",
                  filter: "drop-shadow(rgba(0, 0, 0, 0.05) 0px 3px 2px)",
                  // filter:
                  //   "drop-shadow(0px 7px 14px rgba(0, 0, 0, 0.05), 0px 0px 3.12708px rgba(0, 0, 0, 0.0798), 0px 0px 0.931014px rgba(0, 0, 0, 0.1702))",
                }}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
      {/* <React.Suspense fallback="">
        {isActive ? (
          <div
            className="color-picker-popover-container"
            style={{
              position: "fixed",
              top: coords?.top,
              left: coords?.right,
              zIndex: 1,
            }}
          >
            <Popover
              onCloseRequest={(event) =>
                event.target !== pickerButton.current && setActive(false)
              }
            >
              <Picker
                colors={colors[type]}
                color={color || null}
                onChange={(changedColor) => {
                  onChange(changedColor);
                }}
                onClose={() => {
                  setActive(false);
                  pickerButton.current?.focus();
                }}
                label={label}
                showInput
                type={type}
                elements={elements}
              />
            </Popover>
          </div>
        ) : null}
      </React.Suspense> */}
    </div>
  );
};
