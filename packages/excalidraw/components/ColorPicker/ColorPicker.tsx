import { Popover } from "radix-ui";
import clsx from "clsx";
import { memo, useRef, useEffect } from "react";

import {
  applyDarkModeFilter,
  COLOR_OUTLINE_CONTRAST_THRESHOLD,
  COLOR_PALETTE,
  DEFAULT_ELEMENT_BACKGROUND_PICKS,
  DEFAULT_ELEMENT_STROKE_PICKS,
  isColorDark,
  isWritableElement,
  THEME,
} from "@excalidraw/common";

import type { ColorTuple, ColorPaletteCustom } from "@excalidraw/common";

import type { ExcalidrawElement, Theme } from "@excalidraw/element/types";

import { useAtom } from "../../editor-jotai";
import { t } from "../../i18n";
import { useExcalidrawContainer, useStylesPanelMode } from "../App";
import { ButtonSeparator } from "../ButtonSeparator";
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
import { TopPicks } from "./TopPicks";
import { activeColorPickerSectionAtom } from "./colorPickerUtils";
import {
  ColorPickerDnDContext,
  useColorPickerDnD,
  useTopPicksDnD,
} from "./topPicksDnD";

import "./ColorPicker.scss";

import type { ColorPickerType } from "./colorPickerUtils";

import type { AppState, UIAppState } from "../../types";

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
  appState: UIAppState;
  palette?: ColorPaletteCustom | null;
  topPicks?: ColorTuple;
  updateData: (formData?: any) => void;
  /** palette colors to hide from the popup, keeping hotkey positions */
  excludedColors?: readonly string[];
  /** allow users to customize the top picks strip by drag & dropping colors
   * from the picker popup onto it. The value names the
   * `appState.colorTopPicks` slot the customization is stored in */
  customizableTopPicks?: keyof AppState["colorTopPicks"];
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
  excludedColors,
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
  | "excludedColors"
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
        // focus moving into the top-picks context menu — let the menu keep
        // it (stealing it back would clear the menu's focus-driven
        // `data-highlighted` styling and break its keyboard navigation)
        if (
          event.target instanceof HTMLElement &&
          event.target.closest(".color-picker__context-menu")
        ) {
          event.preventDefault();
          return;
        }
        // refocus due to eye dropper
        if (!isWritableElement(event.target)) {
          if (
            event.target instanceof HTMLElement &&
            event.target.matches(":active")
          ) {
            // the focus escaped because a button outside is being pressed
            // (e.g. a top pick) — stealing focus mid-press makes the browser
            // drop the button's activation (`:active` styling), so wait for
            // the release
            window.addEventListener("pointerup", focusPickerContent, {
              once: true,
            });
          } else {
            focusPickerContent();
          }
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
          excludedColors={excludedColors}
          color={color}
          theme={appState.theme}
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

const isColorPickerPopup = (
  popup: AppState["openPopup"],
): popup is ColorPickerType =>
  popup === "elementStroke" ||
  popup === "elementBackground" ||
  popup === "canvasBackground";

const ColorPickerTrigger = ({
  label,
  color,
  type,
  theme,
  mode = "background",
  onToggle,
  editingTextElement,
}: {
  color: string | null;
  label: string;
  type: ColorPickerType;
  theme: Theme;
  mode?: "background" | "stroke";
  onToggle: () => void;
  editingTextElement?: boolean;
}) => {
  const stylesPanelMode = useStylesPanelMode();
  const isCompactMode = stylesPanelMode !== "full";
  const isMobileMode = stylesPanelMode === "mobile";
  const dnd = useColorPickerDnD();
  const displayColor = color
    ? applyDarkModeFilter(color, theme === THEME.DARK)
    : null;
  const handleClick = (e: React.MouseEvent) => {
    // use pointerdown so we run before outside-close logic
    e.preventDefault();
    e.stopPropagation();

    // If editing text, temporarily disable the wysiwyg blur event
    if (editingTextElement) {
      temporarilyDisableTextEditorBlur();
    }

    onToggle();
  };

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
      style={displayColor ? { "--swatch-color": displayColor } : undefined}
      title={
        type === "elementStroke"
          ? t("labels.showStroke")
          : t("labels.showBackground")
      }
      data-openpopup={type}
      onClick={handleClick}
      // the active-color swatch can be dragged onto the top-picks strip to
      // pin the current (possibly custom) color
      onPointerDown={
        dnd ? (event) => dnd.startSwatchDrag(event, color) : undefined
      }
    >
      <div className="color-picker__button-outline">{!color && slashIcon}</div>
      {isCompactMode && color && mode === "stroke" && (
        <div className="color-picker__button-background">
          <span
            style={{
              color:
                displayColor &&
                isColorDark(displayColor, COLOR_OUTLINE_CONTRAST_THRESHOLD)
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

const ColorPickerComponent = ({
  type,
  color,
  onChange,
  label,
  elements,
  palette = COLOR_PALETTE,
  topPicks,
  updateData,
  appState,
  excludedColors,
  customizableTopPicks,
}: ColorPickerProps) => {
  const openRef = useRef(appState.openPopup);
  useEffect(() => {
    openRef.current = appState.openPopup;
  }, [appState.openPopup]);
  const stylesPanelMode = useStylesPanelMode();
  const isCompactMode = stylesPanelMode !== "full";

  const isTopPicksCustomizable = !!customizableTopPicks && !isCompactMode;

  // user-pinned picks trump the (host-provided or default) baseline
  const customTopPicks =
    isTopPicksCustomizable && customizableTopPicks
      ? appState.colorTopPicks?.[customizableTopPicks]
      : null;

  // fully-resolved picks currently displayed in the strip — the baseline the
  // drag & drop customization starts from
  const effectiveTopPicks = customTopPicks?.length
    ? customTopPicks
    : topPicks ??
      (type === "elementStroke"
        ? DEFAULT_ELEMENT_STROKE_PICKS
        : DEFAULT_ELEMENT_BACKGROUND_PICKS);

  const dnd = useTopPicksDnD({
    enabled: isTopPicksCustomizable,
    picks: effectiveTopPicks,
    onPicksChange: (picks) => {
      if (!customizableTopPicks) {
        return;
      }
      // NOTE the comparator comparing `appState.colorTopPicks` is what keeps
      // this captured spread fresh — see `areColorPickerPropsEqual`
      updateData({
        colorTopPicks: {
          ...appState.colorTopPicks,
          [customizableTopPicks]: picks,
        },
      });
    },
  });

  return (
    <ColorPickerDnDContext.Provider value={isTopPicksCustomizable ? dnd : null}>
      <div
        role="dialog"
        aria-modal="true"
        className={clsx("color-picker-container", {
          "color-picker-container--no-top-picks": isCompactMode,
        })}
      >
        {!isCompactMode && (
          <TopPicks
            theme={appState.theme}
            activeColor={color}
            onChange={(pickedColor) => {
              onChange(pickedColor);
              // if another color-picker popup is open, follow the user's
              // focus over to this picker (same as clicking its trigger)
              if (
                isColorPickerPopup(appState.openPopup) &&
                appState.openPopup !== type
              ) {
                // deferred: each updateData spreads the full pre-commit
                // appState, so issuing this in the same task would clobber
                // the color change committed by `onChange` above
                setTimeout(() => updateData({ openPopup: type }), 0);
              }
            }}
            type={type}
            topPicks={customTopPicks?.length ? customTopPicks : topPicks}
            isCustomized={!!customTopPicks?.length}
            onReset={
              isTopPicksCustomizable && customizableTopPicks
                ? () => {
                    updateData({
                      colorTopPicks: {
                        ...appState.colorTopPicks,
                        [customizableTopPicks]: null,
                      },
                    });
                  }
                : undefined
            }
          />
        )}
        {!isCompactMode && <ButtonSeparator />}
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
            theme={appState.theme}
            mode={type === "elementStroke" ? "stroke" : "background"}
            editingTextElement={!!appState.editingTextElement}
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
              excludedColors={excludedColors}
              updateData={updateData}
              getOpenPopup={() => openRef.current}
              appState={appState}
            />
          )}
        </Popover.Root>
      </div>
    </ColorPickerDnDContext.Provider>
  );
};

/**
 * ColorPicker renders on every styles-panel render (selection churn during
 * box-select and the like), while its actual inputs are a handful of resolved
 * primitives and reference-stable objects — cheap `===` checks, no deep
 * comparisons:
 * - `palette` / `topPicks` / `excludedColors` are module constants,
 * - `appState.colorTopPicks` identity changes exactly when its content does.
 *
 * Function props (`onChange`, `updateData`) are deliberately ignored — they
 * are recreated every render but semantically stable (they read fresh state
 * at call time). Same for `elements`, which is only sampled once when the
 * popup opens (most-used custom colors).
 */
const areColorPickerPropsEqual = (
  prev: ColorPickerProps,
  next: ColorPickerProps,
) => {
  // the open popup is interactive (hotkeys, eye dropper, most-used custom
  // colors) — never memoize it, including the open/close transitions
  if (
    prev.appState.openPopup === prev.type ||
    next.appState.openPopup === next.type
  ) {
    return false;
  }
  return (
    prev.type === next.type &&
    prev.color === next.color &&
    prev.label === next.label &&
    // popup open/close is rare, and the strip's click handler branches on
    // which popup is open (popup-switching) — keep its closure fresh
    prev.appState.openPopup === next.appState.openPopup &&
    prev.palette === next.palette &&
    prev.topPicks === next.topPicks &&
    prev.excludedColors === next.excludedColors &&
    prev.customizableTopPicks === next.customizableTopPicks &&
    prev.appState.theme === next.appState.theme &&
    prev.appState.colorTopPicks === next.appState.colorTopPicks &&
    // the trigger tweaks its click behavior while a text element is edited
    !!prev.appState.editingTextElement === !!next.appState.editingTextElement
  );
};

export const ColorPicker = memo(ColorPickerComponent, areColorPickerPropsEqual);
