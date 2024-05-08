import { isInteractive, isTransparent, isWritableElement } from "../../utils";
import type { ExcalidrawElement } from "../../element/types";
import type { AppState } from "../../types";
import { TopPicks } from "./TopPicks";
import { Picker } from "./Picker";
import * as Popover from "@radix-ui/react-popover";
import { useAtom } from "jotai";
import type { ColorPickerType } from "./colorPickerUtils";
import { activeColorPickerSectionAtom } from "./colorPickerUtils";
import { useDevice, useExcalidrawContainer } from "../App";
import type { ColorTuple, ColorPaletteCustom } from "../../colors";
import { COLOR_PALETTE } from "../../colors";
import PickerHeading from "./PickerHeading";
import { t } from "../../i18n";
import clsx from "clsx";
import { jotaiScope } from "../../jotai";
import { ColorInput } from "./ColorInput";
import { useRef } from "react";
import { activeEyeDropperAtom } from "../EyeDropper";

import "./ColorPicker.scss";

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

interface ColorPickerProps {
  type: ColorPickerType;
  color: string;
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
  | "elements"
  | "palette"
  | "updateData"
>) => {
  const [, setActiveColorPickerSection] = useAtom(activeColorPickerSectionAtom);

  const [eyeDropperState, setEyeDropperState] = useAtom(
    activeEyeDropperAtom,
    jotaiScope,
  );

  const { container } = useExcalidrawContainer();
  const device = useDevice();

  const colorInputJSX = (
    <div>
      <PickerHeading>{t("colorPicker.hexCode")}</PickerHeading>
      <ColorInput
        color={color}
        label={label}
        onChange={(color) => {
          onChange(color);
        }}
        colorPickerType={type}
      />
    </div>
  );
  const popoverRef = useRef<HTMLDivElement>(null);

  const focusPickerContent = () => {
    popoverRef.current
      ?.querySelector<HTMLDivElement>(".color-picker-content")
      ?.focus();
  };

  return (
    <Popover.Portal container={container}>
      <Popover.Content
        ref={popoverRef}
        className="focus-visible-none"
        data-prevent-outside-click
        onFocusOutside={(event) => {
          focusPickerContent();
          event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (eyeDropperState) {
            // prevent from closing if we click outside the popover
            // while eyedropping (e.g. click when clicking the sidebar;
            // the eye-dropper-backdrop is prevented downstream)
            event.preventDefault();
          }
        }}
        onCloseAutoFocus={(e) => {
          e.stopPropagation();
          // prevents focusing the trigger
          e.preventDefault();

          // return focus to excalidraw container unless
          // user focuses an interactive element, such as a button, or
          // enters the text editor by clicking on canvas with the text tool
          if (container && !isInteractive(document.activeElement)) {
            container.focus();
          }

          updateData({ openPopup: null });
          setActiveColorPickerSection(null);
        }}
        side={
          device.editor.isMobile && !device.viewport.isLandscape
            ? "bottom"
            : "right"
        }
        align={
          device.editor.isMobile && !device.viewport.isLandscape
            ? "center"
            : "start"
        }
        alignOffset={-16}
        sideOffset={20}
        style={{
          zIndex: "var(--zIndex-layerUI)",
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
            color={color}
            onChange={(changedColor) => {
              onChange(changedColor);
            }}
            onEyeDropperToggle={(force) => {
              setEyeDropperState((state) => {
                if (force) {
                  state = state || {
                    keepOpenOnAlt: true,
                    onSelect: onChange,
                    colorPickerType: type,
                  };
                  state.keepOpenOnAlt = true;
                  return state;
                }

                return force === false || state
                  ? null
                  : {
                      keepOpenOnAlt: false,
                      onSelect: onChange,
                      colorPickerType: type,
                    };
              });
            }}
            onEscape={(event) => {
              if (eyeDropperState) {
                setEyeDropperState(null);
              } else if (isWritableElement(event.target)) {
                focusPickerContent();
              } else {
                updateData({ openPopup: null });
              }
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
  color: string;
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
