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
import { TopPicksTip } from "../TopPicksDnD/TopPicksTip";
import DropdownMenuGroup from "../dropdownMenu/DropdownMenuGroup";
import MenuItemContent from "../dropdownMenu/DropdownMenuItemContent";
import { getDropdownMenuItemClassName } from "../dropdownMenu/common";
import { PlusIcon } from "../icons";

import { useFontPickerDnD } from "./fontTopPicksDnD";
import { fontPickerKeyHandler } from "./keyboardNavHandlers";
import {
  FontPickerListItem,
  FontPickerRetryIcon,
  getFontStatusClassName,
} from "./FontPickerListItem";
import { useFontCatalog, type FontDescriptor } from "./useFontCatalog";
import {
  useFontResolution,
  type FontSelectionOptions,
} from "./useFontResolution";
import { useFontSearch } from "./useFontSearch";
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
  /** present only while the top picks are customized */
  onResetTopPicks?: () => void;
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
    onResetTopPicks,
  }: FontPickerListProps) => {
    const { container } = useExcalidrawContainer();
    const app = useApp();
    const fonts = app.fonts.instance;
    const { showDeprecatedFonts, fontProviders } = useAppProps();
    const stylesPanelMode = useStylesPanelMode();
    const hasFontProviders = useMemo(
      () => !!Object.keys(fontProviders ?? {}).length,
      [fontProviders],
    );
    // present only when the top picks are customizable
    const dnd = useFontPickerDnD();

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
      selectSearchedFontFamily,
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
      results: searchResults,
      resolvableProviders,
      isSearching,
    } = useFontSearch({ fonts, fontProviders, searchTerm });
    const {
      filteredFontDescriptors,
      selectableFonts,
      sceneFilteredFonts,
      availableFilteredFonts,
      searchMatches,
      hiddenSearchMatchCount,
      searchSuggestions,
      searchFamilies,
    } = useFontCatalog({
      fonts,
      fontProviders,
      registeredFonts,
      failedResolutions,
      selectedFontFamily,
      newSceneFamilies,
      resolvingFamily,
      searchTerm,
      searchResults,
      showDeprecatedFonts: !!showDeprecatedFonts,
    });

    // with nothing listed, only providers that couldn't search may still
    // carry the typed name
    const canResolveTypedName =
      !!searchTerm.trim() &&
      !!resolvableProviders.length &&
      !filteredFontDescriptors.length &&
      !searchMatches.length;
    const resolveTypedFontFamily = useCallback(() => {
      if (canResolveTypedName) {
        resolveFontFamily(resolvableProviders);
      }
    }, [canResolveTypedName, resolveFontFamily, resolvableProviders]);

    const onSelectFont = useCallback(
      (fontFamily: FontFamily) =>
        isCustomFontFamily(fontFamily) && searchFamilies.has(fontFamily)
          ? selectSearchedFontFamily(fontFamily)
          : selectFontFamily(fontFamily),
      [searchFamilies, selectFontFamily, selectSearchedFontFamily],
    );

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
      // a typo correction is picked deliberately, never by a bare Enter
      if (firstFont && !searchSuggestions.length) {
        hoverFontFamily(firstFont.value);
      } else if (hoveredFontFamily || localHoveredFontFamily) {
        leaveFontFamily();
      }
    }, [
      hoveredFont,
      hoveredFontFamily,
      localHoveredFontFamily,
      searchTerm,
      searchSuggestions,
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
          onSelect: onSelectFont,
          onHover: hoverFontFamily,
          onClose,
          onResolve: resolveTypedFontFamily,
        });

        if (handled) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      [
        hoveredFont,
        selectableFonts,
        onSelectFont,
        hoverFontFamily,
        onClose,
        resolveTypedFontFamily,
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

    const groups: React.ReactNode[] = [];
    let order = 0;
    const pushGroup = (
      title: string,
      key: string,
      groupFonts: readonly FontDescriptor[],
      footer?: React.ReactNode,
    ) => {
      if (!groupFonts.length) {
        return;
      }
      groups.push(
        <DropdownMenuGroup title={title} key={key}>
          {groupFonts.map((font) => (
            <FontPickerListItem
              key={font.value}
              font={font}
              order={order++}
              isHovered={font.value === hoveredFont?.value}
              isSelected={font.value === selectedFontFamily}
              onSelect={onSelectFont}
              onHover={hoverFontFamily}
              setItemRef={setFontItemRef}
            />
          ))}
          {footer}
        </DropdownMenuGroup>,
      );
    };

    pushGroup(t("fontList.sceneFonts"), "group_1", sceneFilteredFonts);
    pushGroup(t("fontList.availableFonts"), "group_2", availableFilteredFonts);
    pushGroup(
      t("fontList.searchResults"),
      "group_search",
      searchMatches,
      hiddenSearchMatchCount > 0 && (
        <div className="FontPicker__more-results">
          {t("fontList.moreResults", { count: hiddenSearchMatchCount })}
        </div>
      ),
    );
    pushGroup(t("fontList.didYouMean"), "group_suggestions", searchSuggestions);

    if (canResolveTypedName) {
      groups.push(
        <button
          key="resolve"
          type="button"
          className={`${getDropdownMenuItemClassName(
            "",
            false,
            // Enter's target while no suggestion is hovered
            !hoveredFont,
          )}${getFontStatusClassName(
            failedSearchTerm === searchTerm
              ? isResolving
                ? "loading"
                : "failed"
              : undefined,
          )}`}
          disabled={isResolving}
          aria-busy={isResolving}
          onClick={resolveTypedFontFamily}
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
                : hoveredFont
                ? undefined
                : KEYS.ENTER
            }
          >
            {searchTerm.trim()}
          </MenuItemContent>
        </button>,
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
          placeholder={t(isSearching ? "fontList.searching" : "fontList.empty")}
        >
          {groups}
        </ScrollableList>
        {dnd && (
          <TopPicksTip
            className="FontPicker__tip"
            tip={t("fontList.topPicksTip")}
            onReset={onResetTopPicks}
            resetTitle={t("fontList.resetTopPicks")}
          />
        )}
      </PropertiesPopover>
    );
  },
  (prev, next) =>
    prev.selectedFontFamily === next.selectedFontFamily &&
    prev.hoveredFontFamily === next.hoveredFontFamily &&
    !!prev.onResetTopPicks === !!next.onResetTopPicks,
);
