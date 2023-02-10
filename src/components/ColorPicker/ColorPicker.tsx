import { isTransparent } from "../../utils";

import "./ColorPicker.scss";
import colors from "../../colors";
import { ExcalidrawElement } from "../../element/types";
import { AppState } from "../../types";

import { TopPicks } from "./TopPicks";
import { Picker } from "./Picker";
import ActiveColor from "./ActiveColor";

import * as Popover from "@radix-ui/react-popover";
import { useAtom } from "jotai";
import {
  activeColorPickerSectionAtom,
  ColorTuple,
  ocPalette,
  Palette,
} from "./colorPickerUtils";

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

export interface ColorPickerProps {
  type: "canvasBackground" | "elementBackground" | "elementStroke";
  color: string | null;
  onChange: (color: string) => void;
  label: string;
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  palette?: Palette;
  topPicks?: ColorTuple;
}

export const ColorPicker = ({
  type,
  color,
  onChange,
  label,
  elements,
  palette = ocPalette,
  topPicks,
}: ColorPickerProps) => {
  const [, setActiveColorPickerSection] = useAtom(activeColorPickerSectionAtom);

  return (
    <div>
      <div role="dialog" aria-modal="true" className="color-picker-container">
        <TopPicks
          activeColor={color}
          onChange={onChange}
          type={type}
          topPicks={topPicks}
        />
        <div
          style={{
            width: 1,
            height: 20,
            backgroundColor: "var(--default-border-color)",
            margin: "0 auto",
          }}
        />
        <Popover.Root>
          <ActiveColor color={color} label={label} />

          <Popover.Portal
            container={document.querySelector(".excalidraw") as HTMLDivElement}
          >
            <Popover.Content
              onCloseAutoFocus={() => {
                setActiveColorPickerSection(null);
              }}
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
                }}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </div>
  );
};
