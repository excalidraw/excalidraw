import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useSyncExternalStore,
  type KeyboardEventHandler,
} from "react";

import { isCustomFontFamily, KEYS } from "@excalidraw/common";

import type { FontFamily } from "@excalidraw/common";

import { t } from "../../i18n";
import {
  useApp,
  useAppProps,
  useExcalidrawContainer,
  useStylesPanelMode,
} from "../App";
import { PropertiesPopover } from "../PropertiesPopover";
import { QuickSearch } from "../QuickSearch";
import { ScrollableList } from "../ScrollableList";
import DropdownMenuGroup from "../dropdownMenu/DropdownMenuGroup";
import MenuItemContent from "../dropdownMenu/DropdownMenuItemContent";
import { getDropdownMenuItemClassName } from "../dropdownMenu/common";
import { PlusIcon } from "../icons";

import { fontPickerKeyHandler } from "./keyboardNavHandlers";
import {
  FontPickerListItem,
  FontPickerRetryIcon,
  getFontStatusClassName,
} from "./FontPickerListItem";
import { useFontCatalog } from "./useFontCatalog";
import {
  useFontResolution,
  type FontSelectionOptions,
} from "./useFontResolution";
import { useVisibleFontRegistration } from "./useVisibleFontRegistration";

export type { FontSelectionOptions } from "./useFontResolution";
export type { FontDescriptor } from "./useFontCatalog";

interface FontPickerListProps {
  selectedFontFamily: FontFamily | null;
  hoveredFontFamily: FontFamily | null;
  onSelect: (value: FontFamily, options?: FontSelectionOptions) => void;
  onHover: (value: FontFamily) => void;
  onLeave: () => void;
  onOpen: () => void;
  onClose: () => void;
}

export const FontPickerList = React.memo(
  ({
    selectedFontFamily,
    hoveredFontFamily,
    onSelect,
    onHover,
    onLeave,
    onOpen,
    onClose,
  }: FontPickerListProps) => {
    const { container } = useExcalidrawContainer();
    const app = useApp();
    const { fonts } = app;
    const { showDeprecatedFonts, fontProviders } = useAppProps();
    const stylesPanelMode = useStylesPanelMode();
    const hasFontProviders = useMemo(
      () => !!Object.keys(fontProviders ?? {}).length,
      [fontProviders],
    );

    const [localHoveredFontFamily, setLocalHoveredFontFamily] =
      useState<FontFamily | null>(null);
    // useSyncExternalStore rather than subscribe-in-effect: an emit landing
    // between this render's snapshot and the effect's subscription would
    // otherwise be lost until the *next* emit. Both getters return
    // identity-stable maps that only change on an announcement (the lone
    // unannounced reassignment - the registry's lazy built-in init - runs on
    // first access, before any subscriber exists), as the contract requires
    const failedResolutions = useSyncExternalStore(
      useCallback(
        (onStoreChange: () => void) =>
          fonts.onFailedResolutionsChangeEmitter.on(onStoreChange),
        [fonts],
      ),
      () => fonts.failedResolutions,
    );
    const registeredFonts = useSyncExternalStore(
      useCallback(
        (onStoreChange: () => void) =>
          fonts.onRegisteredFontsChangeEmitter.on(onStoreChange),
        [fonts],
      ),
      () => fonts.registered,
    );
    const {
      inputRef,
      searchTerm,
      failedSearchTerm,
      isResolving,
      resolvingFamily,
      newSceneFamilies,
      selectFontFamily,
      resolveFontFamily,
      onSearchChange,
      cancelResolution,
    } = useFontResolution({
      fonts,
      fontProviders,
      registeredFonts,
      failedResolutions,
      isEditingText: !!app.state.editingTextElement,
      onSelect,
    });
    const {
      filteredFonts,
      selectableFonts,
      sceneFilteredFonts,
      availableFilteredFonts,
    } = useFontCatalog({
      fonts,
      fontProviders,
      registeredFonts,
      failedResolutions,
      selectedFontFamily,
      newSceneFamilies,
      resolvingFamily,
      searchTerm,
      showDeprecatedFonts: !!showDeprecatedFonts,
    });

    const hoverFontFamily = useCallback(
      (fontFamily: FontFamily) => {
        if (
          isCustomFontFamily(fontFamily) &&
          !registeredFonts.has(fontFamily)
        ) {
          // an unregistered family has no metrics yet, so its hover stays
          // picker-local until it registers (see the effect below) - but
          // clear the previous row's canvas preview, or the canvas would keep
          // showing it under this row's highlight
          setLocalHoveredFontFamily(fontFamily);
          onLeave();
          return;
        }

        setLocalHoveredFontFamily(null);
        onHover(fontFamily);
      },
      [onHover, onLeave, registeredFonts],
    );

    const leaveFontFamily = useCallback(() => {
      setLocalHoveredFontFamily(null);
      onLeave();
    }, [onLeave]);

    useEffect(() => {
      if (
        localHoveredFontFamily !== null &&
        isCustomFontFamily(localHoveredFontFamily) &&
        registeredFonts.has(localHoveredFontFamily)
      ) {
        setLocalHoveredFontFamily(null);
        onHover(localHoveredFontFamily);
      }
    }, [localHoveredFontFamily, onHover, registeredFonts]);

    const { setScrollContainerRef, setFontItemRef } =
      useVisibleFontRegistration({
        fonts,
        registeredFonts,
        failedResolutions,
        enabled: hasFontProviders,
      });

    const hoveredFont = useMemo(() => {
      const activeHoveredFontFamily =
        localHoveredFontFamily ?? hoveredFontFamily;
      if (activeHoveredFontFamily) {
        return selectableFonts.find(
          (font) => font.value === activeHoveredFontFamily,
        );
      }

      if (selectedFontFamily) {
        return selectableFonts.find(
          (font) => font.value === selectedFontFamily,
        );
      }

      return undefined;
    }, [
      hoveredFontFamily,
      localHoveredFontFamily,
      selectedFontFamily,
      selectableFonts,
    ]);

    useEffect(() => {
      if (hoveredFont || !searchTerm) {
        return;
      }

      const firstFont = selectableFonts[0];
      if (firstFont) {
        hoverFontFamily(firstFont.value);
      } else if (!firstFont && (hoveredFontFamily || localHoveredFontFamily)) {
        leaveFontFamily();
      }
    }, [
      hoveredFont,
      hoveredFontFamily,
      localHoveredFontFamily,
      searchTerm,
      selectableFonts,
      hoverFontFamily,
      leaveFontFamily,
    ]);

    const onKeyDown = useCallback<KeyboardEventHandler<HTMLDivElement>>(
      (event) => {
        const handled = fontPickerKeyHandler({
          event,
          inputRef,
          hoveredFont,
          filteredFonts: selectableFonts,
          onSelect: selectFontFamily,
          onHover: hoverFontFamily,
          onClose,
          onResolve: resolveFontFamily,
        });

        if (handled) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      [
        hoveredFont,
        selectableFonts,
        selectFontFamily,
        hoverFontFamily,
        onClose,
        resolveFontFamily,
        inputRef,
      ],
    );

    useEffect(() => {
      onOpen();

      return () => {
        cancelResolution();
        onClose();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const groups = [];

    if (sceneFilteredFonts.length) {
      groups.push(
        <DropdownMenuGroup title={t("fontList.sceneFonts")} key="group_1">
          {sceneFilteredFonts.map((font, index) => (
            <FontPickerListItem
              key={font.value}
              font={font}
              order={index}
              isHovered={font.value === hoveredFont?.value}
              isSelected={font.value === selectedFontFamily}
              onSelect={selectFontFamily}
              onHover={hoverFontFamily}
              setItemRef={setFontItemRef}
            />
          ))}
        </DropdownMenuGroup>,
      );
    }

    if (availableFilteredFonts.length) {
      groups.push(
        <DropdownMenuGroup title={t("fontList.availableFonts")} key="group_2">
          {availableFilteredFonts.map((font, index) => (
            <FontPickerListItem
              key={font.value}
              font={font}
              order={index + sceneFilteredFonts.length}
              isHovered={font.value === hoveredFont?.value}
              isSelected={font.value === selectedFontFamily}
              onSelect={selectFontFamily}
              onHover={hoverFontFamily}
              setItemRef={setFontItemRef}
            />
          ))}
        </DropdownMenuGroup>,
      );
    }

    return (
      <PropertiesPopover
        className="properties-content"
        container={container}
        style={{ width: "15rem" }}
        onClose={() => {
          onClose();

          // Refocus text editor when font picker closes if we were editing text
          if (app.state.editingTextElement) {
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
        onPointerLeave={leaveFontFamily}
        onKeyDown={onKeyDown}
        preventAutoFocusOnTouch={!!app.state.editingTextElement}
      >
        {stylesPanelMode === "full" && (
          <QuickSearch
            ref={inputRef}
            placeholder={t("quickSearch.placeholder")}
            onChange={(term) => {
              setLocalHoveredFontFamily(null);
              onSearchChange(term);
            }}
          />
        )}
        <ScrollableList
          ref={setScrollContainerRef}
          className="dropdown-menu fonts manual-hover"
          placeholder={t("fontList.empty")}
        >
          {groups.length ? (
            groups
          ) : hasFontProviders && !filteredFonts.length && searchTerm ? (
            <button
              type="button"
              className={`${getDropdownMenuItemClassName(
                "",
                false,
                true,
              )}${getFontStatusClassName(
                failedSearchTerm === searchTerm
                  ? isResolving
                    ? "loading"
                    : "failed"
                  : undefined,
              )}`}
              disabled={isResolving}
              aria-busy={isResolving}
              onClick={resolveFontFamily}
            >
              <MenuItemContent
                icon={PlusIcon}
                badge={
                  failedSearchTerm === searchTerm
                    ? FontPickerRetryIcon(isResolving)
                    : null
                }
                shortcut={
                  failedSearchTerm === searchTerm
                    ? undefined
                    : isResolving
                    ? "..."
                    : KEYS.ENTER
                }
              >
                {searchTerm.trim()}
              </MenuItemContent>
            </button>
          ) : null}
        </ScrollableList>
      </PropertiesPopover>
    );
  },
  (prev, next) =>
    prev.selectedFontFamily === next.selectedFontFamily &&
    prev.hoveredFontFamily === next.hoveredFontFamily,
);
