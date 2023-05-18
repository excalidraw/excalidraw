import { isTransparent } from "../../utils";
import { ExcalidrawElement } from "../../element/types";
import { AppState } from "../../types";
import { TopPicks } from "./TopPicks";
import { Picker } from "./Picker";
import * as Popover from "@radix-ui/react-popover";
import { useAtom } from "jotai";
import {
  activeColorPickerSectionAtom,
  ColorPickerType,
} from "./colorPickerUtils";
import { useDevice, useExcalidrawContainer } from "../App";
import { ColorTuple, COLOR_PALETTE, ColorPaletteCustom } from "../../colors";
import PickerHeading from "./PickerHeading";
import { ColorInput } from "./ColorInput";
import { t } from "../../i18n";
import clsx from "clsx";

import "./ColorPicker.scss";
import React from "react";

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
  type: ColorPickerType;
  color: string | null;
  onChange: (color: string) => void;
  label: string;
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  palette?: ColorPaletteCustom | null;
  topPicks?: ColorTuple;
  updateData: (formData?: any) => void;
}

const ColorPickerPopupContent = ({
  type,
  color,
  onChange,
  label,
  elements,
  palette = COLOR_PALETTE,
  updateData,
}: Pick<
  ColorPickerProps,
  | "type"
  | "color"
  | "onChange"
  | "label"
  | "label"
  | "elements"
  | "palette"
  | "updateData"
>) => {
  const [, setActiveColorPickerSection] = useAtom(activeColorPickerSectionAtom);

  const { container } = useExcalidrawContainer();
  const { isMobile, isLandscape } = useDevice();

  const colorInputJSX = (
    <div>
      <PickerHeading>{t("colorPicker.hexCode")}</PickerHeading>
      <ColorInput
        color={color}
        label={label}
        onChange={(color) => {
          onChange(color);
        }}
      />
    </div>
  );

  return (
    <Popover.Portal container={container}>
      <Popover.Content
        className="focus-visible-none"
        data-prevent-outside-click
        onCloseAutoFocus={(e) => {
          // return focus to excalidraw container
          if (container) {
            container.focus();
          }

          e.preventDefault();
          e.stopPropagation();

          setActiveColorPickerSection(null);
        }}
        side={isMobile && !isLandscape ? "bottom" : "right"}
        align={isMobile && !isLandscape ? "center" : "start"}
        alignOffset={-16}
        sideOffset={20}
        style={{
          zIndex: 9999,
          backgroundColor: "var(--popup-bg-color)",
          maxWidth: "208px",
          maxHeight: window.innerHeight,
          padding: "12px",
          borderRadius: "8px",
          boxSizing: "border-box",
          overflowY: "auto",
          boxShadow:
            "0px 7px 14px rgba(0, 0, 0, 0.05), 0px 0px 3.12708px rgba(0, 0, 0, 0.0798), 0px 0px 0.931014px rgba(0, 0, 0, 0.1702)",
        }}
      >
        {palette ? (
          <Picker
            palette={palette}
            color={color || null}
            onChange={(changedColor) => {
              onChange(changedColor);
            }}
            label={label}
            type={type}
            elements={elements}
            updateData={updateData}
          >
            {colorInputJSX}
          </Picker>
        ) : (
          colorInputJSX
        )}
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
  );
};

const ColorPickerTrigger = ({
  label,
  color,
  type,
}: {
  color: string | null;
  label: string;
  type: ColorPickerType;
}) => {
  return (
    <Popover.Trigger
      type="button"
      className={clsx("color-picker__button active-color", {
        "is-transparent": color === "transparent" || !color,
      })}
      aria-label={label}
      style={color ? { "--swatch-color": color } : undefined}
      title={
        type === "elementStroke"
          ? t("labels.showStroke")
          : t("labels.showBackground")
      }
    >
      <div className="color-picker__button-outline" />
    </Popover.Trigger>
  );
};

export const ColorPicker = ({
  type,
  color,
  onChange,
  label,
  elements,
  palette = COLOR_PALETTE,
  topPicks,
  updateData,
  appState,
}: ColorPickerProps) => {
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
            height: "100%",
            backgroundColor: "var(--default-border-color)",
            margin: "0 auto",
          }}
        />
        <Popover.Root
          open={appState.openPopup === type}
          onOpenChange={(open) => {
            updateData({ openPopup: open ? type : null });
          }}
        >
          {/* serves as an active color indicator as well */}
          <ColorPickerTrigger color={color} label={label} type={type} />
          {/* popup content */}
          {appState.openPopup === type && (
            <ColorPickerPopupContent
              type={type}
              color={color}
              onChange={onChange}
              label={label}
              elements={elements}
              palette={palette}
              updateData={updateData}
            />
          )}
        </Popover.Root>
      </div>
    </div>
  );
};
