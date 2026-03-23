import { Popover } from "radix-ui";
import clsx from "clsx";
import { useRef, useEffect, type ReactNode } from "react";

import {
  COLOR_OUTLINE_CONTRAST_THRESHOLD,
  COLOR_PALETTE,
  isColorDark,
  isWritableElement,
} from "@excalidraw/common";

import type { ColorTuple, ColorPaletteCustom } from "@excalidraw/common";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { useAtom } from "../../editor-jotai";
import { t } from "../../i18n";
import { useExcalidrawContainer, useStylesPanelMode } from "../App";
import { activeEyeDropperAtom } from "../EyeDropper";
import { PropertiesPopover } from "../PropertiesPopover";
import { slashIcon, strokeIcon } from "../icons";
import {
  saveCaretPosition,
  restoreCaretPosition,
  temporarilyDisableTextEditorBlur,
} from "../../hooks/useTextEditorFocus";

import { ColorInput } from "./ColorInput";
import { Picker } from "./Picker";
import PickerHeading from "./PickerHeading";
import { activeColorPickerSectionAtom } from "./colorPickerUtils";

import "./ColorPicker.scss";

import type { ColorPickerType } from "./colorPickerUtils";

import type { AppState } from "../../types";

interface ColorPickerProps {
  type: ColorPickerType;
  /**
   * null indicates no color should be displayed as active
   * (e.g. when multiple shapes selected with different colors)
   */
  color: string | null;
  onChange: (color: string) => void;
  label: string;
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  palette?: ColorPaletteCustom | null;
  topPicks?: ColorTuple;
  updateData: (formData?: any) => void;
  belowTrigger?: ReactNode;
  variant?: "default" | "triggerOnly";
}

const ColorPickerPopupContent = ({
  type,
  color,
  onChange,
  label,
  elements,
  palette = COLOR_PALETTE,
  updateData,
  getOpenPopup,
  appState,
}: Pick<
  ColorPickerProps,
  | "type"
  | "color"
  | "onChange"
  | "label"
  | "elements"
  | "palette"
  | "updateData"
  | "appState"
> & {
  getOpenPopup: () => AppState["openPopup"];
}) => {
  const { container } = useExcalidrawContainer();
  const stylesPanelMode = useStylesPanelMode();
  const isCompactMode = stylesPanelMode !== "full";
  const isMobileMode = stylesPanelMode === "mobile";
  const [, setActiveColorPickerSection] = useAtom(activeColorPickerSectionAtom);

  const [eyeDropperState, setEyeDropperState] = useAtom(activeEyeDropperAtom);

  const colorInputJSX = (
    <div>
      <PickerHeading>{t("colorPicker.hexCode")}</PickerHeading>
      <ColorInput
        color={color || ""}
        label={label}
        onChange={(color) => {
          onChange(color);
        }}
        colorPickerType={type}
        placeholder={t("colorPicker.color")}
      />
    </div>
  );

  const colorPickerContentRef = useRef<HTMLDivElement>(null);

  const focusPickerContent = () => {
    colorPickerContentRef.current?.focus();
  };

  return (
    <PropertiesPopover
      container={container}
      style={{ maxWidth: "13rem" }}
      // Improve focus handling for text editing scenarios
      preventAutoFocusOnTouch={!!appState.editingTextElement}
      onFocusOutside={(event) => {
        // refocus due to eye dropper
        if (!isWritableElement(event.target)) {
          focusPickerContent();
        }
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
      onClose={() => {
        // only clear if we're still the active popup (avoid racing with switch)
        if (getOpenPopup() === type) {
          updateData({ openPopup: null });
        }
        setActiveColorPickerSection(null);

        // Refocus text editor when popover closes if we were editing text
        if (appState.editingTextElement) {
          setTimeout(() => {
            const textEditor = document.querySelector(
              ".excalidraw-wysiwyg",
            ) as HTMLTextAreaElement;
            if (textEditor) {
              textEditor.focus();
            }
          }, 0);
        }
      }}
    >
      {palette ? (
        <Picker
          ref={colorPickerContentRef}
          palette={palette}
          color={color}
          onChange={(changedColor) => {
            // Save caret position before color change if editing text
            const savedSelection = appState.editingTextElement
              ? saveCaretPosition()
              : null;

            onChange(changedColor);

            // Restore caret position after color change if editing text
            if (appState.editingTextElement && savedSelection) {
              restoreCaretPosition(savedSelection);
            }
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
            } else {
              // close explicitly on Escape
              updateData({ openPopup: null });
            }
          }}
          type={type}
          elements={elements}
          updateData={updateData}
          showTitle={isCompactMode}
          showHotKey={!isMobileMode}
        >
          {colorInputJSX}
        </Picker>
      ) : (
        colorInputJSX
      )}
    </PropertiesPopover>
  );
};

const ColorPickerTrigger = ({
  label,
  color,
  type,
  mode = "background",
  onOpen,
  onToggle,
  editingTextElement,
  onQuickApply,
}: {
  color: string | null;
  label: string;
  type: ColorPickerType;
  mode?: "background" | "stroke";
  onOpen: () => void;
  onToggle: () => void;
  editingTextElement?: boolean;
  onQuickApply?: (color: string) => void;
}) => {
  const stylesPanelMode = useStylesPanelMode();
  const isCompactMode = stylesPanelMode !== "full";
  const isMobileMode = stylesPanelMode === "mobile";
  const lastPointerButtonRef = useRef<number | null>(null);

  const isQuickApplyType =
    type === "elementStroke" ||
    type === "textSelectionBackground" ||
    type === "textSelectionUnderline" ||
    type === "textSelectionColor" ||
    type === "textSelectionTag";

  const openPicker = (e: React.SyntheticEvent) => {
    // use pointerdown so we run before outside-close logic
    e.preventDefault();
    e.stopPropagation();

    // If editing text, temporarily disable the wysiwyg blur event
    if (editingTextElement) {
      temporarilyDisableTextEditorBlur();
    }

    onToggle();
  };

  const forceOpenPicker = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (editingTextElement) {
      temporarilyDisableTextEditorBlur();
    }

    onOpen();
  };

  let triggerTitle = t("labels.showBackground");
  if (type === "elementStroke") {
    triggerTitle = t("labels.showStroke");
  }
  if (
    type === "textSelectionBackground" ||
    type === "textSelectionUnderline" ||
    type === "textSelectionColor" ||
    type === "textSelectionTag"
  ) {
    triggerTitle = label;
  }

  return (
    <Popover.Trigger
      type="button"
      className={clsx("color-picker__button active-color properties-trigger", {
        "is-transparent": !color || color === "transparent",
        "has-outline":
          !color || !isColorDark(color, COLOR_OUTLINE_CONTRAST_THRESHOLD),
        "compact-sizing": isCompactMode,
        "mobile-border": isMobileMode,
      })}
      aria-label={label}
      style={color ? { "--swatch-color": color } : undefined}
      title={triggerTitle}
      data-openpopup={type}
      onPointerDown={(event) => {
        lastPointerButtonRef.current = event.button;
        if (event.button === 2) {
          return;
        }
        if (event.button === 0 && isQuickApplyType) {
          event.preventDefault();
          event.stopPropagation();
          if (color) {
            onQuickApply?.(color);
          } else {
            forceOpenPicker(event);
          }
        }
      }}
      onContextMenu={(event) => {
        if (isQuickApplyType) {
          lastPointerButtonRef.current = 2;
          forceOpenPicker(event);
        }
      }}
      onClick={(event) => {
        if (isQuickApplyType) {
          if (lastPointerButtonRef.current === 0) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          openPicker(event);
          return;
        }
        openPicker(event);
      }}
    >
      <div className="color-picker__button-outline">{!color && slashIcon}</div>
      {isCompactMode && color && mode === "stroke" && (
        <div className="color-picker__button-background">
          <span
            style={{
              color:
                color && isColorDark(color, COLOR_OUTLINE_CONTRAST_THRESHOLD)
                  ? "#fff"
                  : "#111",
            }}
          >
            {strokeIcon}
          </span>
        </div>
      )}
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
  updateData,
  appState,
  belowTrigger,
  variant = "default",
}: ColorPickerProps) => {
  const openRef = useRef(appState.openPopup);
  useEffect(() => {
    openRef.current = appState.openPopup;
  }, [appState.openPopup]);
  const isQuickApplyType =
    type === "elementStroke" ||
    type === "textSelectionBackground" ||
    type === "textSelectionUnderline" ||
    type === "textSelectionColor" ||
    type === "textSelectionTag";

  if (variant === "triggerOnly") {
    return (
      <Popover.Root
        open={appState.openPopup === type}
        onOpenChange={(open) => {
          if (open) {
            updateData({ openPopup: type });
          }
        }}
      >
        <ColorPickerTrigger
          color={color}
          label={label}
          type={type}
          mode={type === "elementStroke" ? "stroke" : "background"}
          editingTextElement={!!appState.editingTextElement}
          onOpen={() => updateData({ openPopup: type })}
          onQuickApply={isQuickApplyType ? onChange : undefined}
          onToggle={() => {
            if (appState.openPopup === type) {
              updateData({ openPopup: null });
            } else if (appState.openPopup) {
              updateData({ openPopup: type });
            } else {
              updateData({ openPopup: type });
            }
          }}
        />
        {appState.openPopup === type && (
          <ColorPickerPopupContent
            type={type}
            color={color}
            onChange={onChange}
            label={label}
            elements={elements}
            palette={palette}
            updateData={updateData}
            getOpenPopup={() => openRef.current}
            appState={appState}
          />
        )}
      </Popover.Root>
    );
  }

  return (
    <div>
      <div
        role="dialog"
        aria-modal="true"
        className={clsx(
          "color-picker-container",
          "color-picker-container--no-top-picks",
        )}
      >
        <Popover.Root
          open={appState.openPopup === type}
          onOpenChange={(open) => {
            if (open) {
              updateData({ openPopup: type });
            }
          }}
        >
          {/* serves as an active color indicator as well */}
          <ColorPickerTrigger
            color={color}
            label={label}
            type={type}
            mode={type === "elementStroke" ? "stroke" : "background"}
            editingTextElement={!!appState.editingTextElement}
            onOpen={() => updateData({ openPopup: type })}
            onQuickApply={isQuickApplyType ? onChange : undefined}
            onToggle={() => {
              // atomic switch: if another popup is open, close it first, then open this one next tick
              if (appState.openPopup === type) {
                // toggle off on same trigger
                updateData({ openPopup: null });
              } else if (appState.openPopup) {
                updateData({ openPopup: type });
              } else {
                // open this one
                updateData({ openPopup: type });
              }
            }}
          />
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
              getOpenPopup={() => openRef.current}
              appState={appState}
            />
          )}
        </Popover.Root>
        {belowTrigger ? (
          <div className="color-picker__below-trigger">{belowTrigger}</div>
        ) : null}
      </div>
    </div>
  );
};
