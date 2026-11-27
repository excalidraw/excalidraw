import clsx from "clsx";
import React, {
  useMemo,
  useRef,
  useState,
  useEffect,
  useCallback,
  type KeyboardEventHandler,
} from "react";

import { isCustomFontFamily, KEYS } from "@excalidraw/common";

import type { FontFamily } from "@excalidraw/common";

import { useStableCallback } from "../../hooks/useStableCallback";
import { useSyncExternalStore } from "../../hooks/useSyncExternalStore";
import { t } from "../../i18n";
import {
  useApp,
  useAppProps,
  useExcalidrawContainer,
  useExcalidrawSetAppState,
  useStylesPanelMode,
} from "../App";
import { PropertiesPopover } from "../PropertiesPopover";
import { QuickSearch } from "../QuickSearch";
import { ScrollableList } from "../ScrollableList";
import { TopPicksTip } from "../TopPicksDnD/TopPicksTip";
import { TopPicksDnDOutline } from "../TopPicksDnD/topPicksDnD";
import DropdownMenuGroup from "../dropdownMenu/DropdownMenuGroup";
import { DragDropIcon } from "../icons";

import { useFontPickerDnD } from "./fontTopPicksDnD";
import { fontPickerKeyHandler } from "./keyboardNavHandlers";
import { FontPickerListItem } from "./FontPickerListItem";
import { useFontCatalog, type FontDescriptor } from "./useFontCatalog";
import {
  useFontResolution,
  type FontSelectionOptions,
} from "./useFontResolution";
import { useFontSearch } from "./useFontSearch";
import { useMoreFonts } from "./useMoreFonts";
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

/** how close (px) to the end of the list the next batch of fonts loads */
const LOAD_MORE_DISTANCE = 40;

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
    const setAppState = useExcalidrawSetAppState();
    const fonts = app.fonts.instance;
    const { showDeprecatedFonts, fontProviders, fontPickerTip, pinnedFonts } =
      useAppProps();
    const stylesPanelMode = useStylesPanelMode();
    const hasFontProviders = useMemo(
      () => !!Object.keys(fontProviders ?? {}).length,
      [fontProviders],
    );
    const pinnedFamilies = useMemo(
      () =>
        new Set(
          (pinnedFonts?.fonts ?? []).filter(
            (fontFamily) =>
              typeof fontFamily === "number" || typeof fontFamily === "string",
          ),
        ),
      [pinnedFonts?.fonts],
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
      resolvingFamily,
      selectFontFamily,
      onSearchChange,
      cancelResolution,
    } = useFontResolution({
      fonts,
      registeredFonts,
      failedResolutions,
      isEditingText: !!app.state.editingTextElement,
      onSelect,
    });
    const { results: searchResults, isSearching } = useFontSearch({
      fonts,
      fontProviders,
      searchTerm,
    });
    const listedFamiliesRef = useRef<ReadonlySet<FontFamily>>(new Set());
    const {
      moreFonts,
      hasMore: hasMoreFonts,
      isAtEnd: isAtMoreFontsEnd,
      isLoading: isLoadingMoreFonts,
      isActive: isLoadingMoreOnScroll,
      loadMore: loadMoreFonts,
    } = useMoreFonts({ fonts, fontProviders, listedFamiliesRef });
    const {
      listedFamilies,
      selectableFonts,
      sceneFilteredFonts,
      pinnedFilteredFonts,
      availableFilteredFonts,
      searchMatches,
      hiddenSearchMatchCount,
      searchSuggestions,
    } = useFontCatalog({
      fonts,
      fontProviders,
      registeredFonts,
      failedResolutions,
      selectedFontFamily,
      hoveredFontFamily,
      pinnedFamilies,
      moreFonts,
      resolvingFamily,
      searchTerm,
      searchResults,
      showDeprecatedFonts: !!showDeprecatedFonts,
    });
    listedFamiliesRef.current = listedFamilies;

    // more is on offer at the end of the list, unless it's being searched
    const isSearchShown = stylesPanelMode === "full";
    const canLoadMoreFonts = hasMoreFonts && !searchTerm.trim();
    // what a provider pages through may be a part of what it has (i.e. its
    // most popular fonts) - the rest is found by searching
    const hasSearchForMore =
      isAtMoreFontsEnd &&
      isSearchShown &&
      !searchTerm.trim() &&
      Object.values(fontProviders ?? {}).some(
        (provider) => provider.loadMore && provider.search,
      );

    // Once the user has asked for more, reaching the end of the list - by
    // scrolling, or by moving the highlight there with the keyboard, which
    // scrolls - loads the next batch by itself.
    const loadMoreFontsAtListEnd = useCallback(() => {
      const scrollContainer = scrollContainerRef.current;
      if (
        scrollContainer &&
        scrollContainer.scrollTop + scrollContainer.clientHeight >=
          scrollContainer.scrollHeight - LOAD_MORE_DISTANCE
      ) {
        loadMoreFonts();
      }
    }, [loadMoreFonts]);
    const isLoadingMoreAtListEnd =
      isLoadingMoreOnScroll && canLoadMoreFonts && !isLoadingMoreFonts;
    useEffect(() => {
      const scrollContainer = scrollContainerRef.current;
      if (!isLoadingMoreAtListEnd || !scrollContainer) {
        return;
      }
      // a batch may not have been enough to push the end out of view
      loadMoreFontsAtListEnd();
      scrollContainer.addEventListener("scroll", loadMoreFontsAtListEnd, {
        passive: true,
      });
      return () =>
        scrollContainer.removeEventListener("scroll", loadMoreFontsAtListEnd);
    }, [isLoadingMoreAtListEnd, loadMoreFontsAtListEnd, moreFonts]);

    // dragging a font takes the focus along - hand it back to the search
    // once the drag is over, wherever the font got dropped (if anywhere)
    const isDragging = !!dnd?.dragState;
    const wasDraggingRef = useRef(false);
    useEffect(() => {
      if (wasDraggingRef.current && !isDragging) {
        inputRef.current?.focus();
      }
      wasDraggingRef.current = isDragging;
    }, [isDragging, inputRef]);

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

    // stable for the rows, which re-render only when what they show changes
    const selectRowFontFamily = useStableCallback((fontFamily: FontFamily) =>
      selectFontFamily(fontFamily),
    );
    const hoverRowFontFamily = useStableCallback(hoverFontFamily);

    const leaveFontFamily = useCallback(() => {
      setLocalHoveredFontFamily(null);
      onLeave();
    }, [onLeave]);

    // Once the family has registered, its hover moves on to the canvas
    // preview. The picker's own hover is dropped only when that has caught up
    // (it takes a few renders): in between, the highlight would fall back to
    // the selected font, and a key pressed right then would carry on from
    // there - back at the top of the list.
    const promotedHoverRef = useRef<FontFamily | null>(null);
    useEffect(() => {
      if (localHoveredFontFamily === null) {
        promotedHoverRef.current = null;
      } else if (hoveredFontFamily === localHoveredFontFamily) {
        setLocalHoveredFontFamily(null);
      } else if (
        isCustomFontFamily(localHoveredFontFamily) &&
        registeredFonts.has(localHoveredFontFamily) &&
        promotedHoverRef.current !== localHoveredFontFamily
      ) {
        promotedHoverRef.current = localHoveredFontFamily;
        onHover(localHoveredFontFamily);
      }
    }, [localHoveredFontFamily, hoveredFontFamily, onHover, registeredFonts]);

    const {
      setScrollContainerRef: setRegistrationScrollContainerRef,
      setFontItemRef,
    } = useVisibleFontRegistration({
      fonts,
      registeredFonts,
      failedResolutions,
      enabled: hasFontProviders,
    });
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const setScrollContainerRef = useCallback(
      (node: HTMLDivElement | null) => {
        scrollContainerRef.current = node;
        setRegistrationScrollContainerRef(node);
      },
      [setRegistrationScrollContainerRef],
    );

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

    // The highlighted row is scrolled into view on two occasions only: as the
    // picker opens (the selected font), and when the highlight moves by
    // keyboard. Never when it moves for another reason - a hover preview
    // ending (the highlight falls back to the selected font), a font getting
    // selected, the pointer - as the list would jump away from under it.
    const shouldRevealHoveredFontRef = useRef(true);
    const hoveredFontValue = hoveredFont?.value;
    const isFirstFontHovered = selectableFonts[0]?.value === hoveredFontValue;
    useEffect(() => {
      if (!shouldRevealHoveredFontRef.current) {
        return;
      }
      shouldRevealHoveredFontRef.current = false;
      if (hoveredFontValue === undefined) {
        return;
      }
      const row = Array.from(
        scrollContainerRef.current?.querySelectorAll<HTMLButtonElement>(
          "button[value]",
        ) ?? [],
      ).find((button) => button.value === String(hoveredFontValue));
      // the first row differently, so that what's above (its group's title)
      // shows as well
      row?.scrollIntoView?.({ block: isFirstFontHovered ? "end" : "nearest" });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hoveredFontValue]);

    const onKeyDown = useCallback<KeyboardEventHandler<HTMLDivElement>>(
      (event) => {
        if (event.key === KEYS.ARROW_DOWN || event.key === KEYS.ARROW_UP) {
          shouldRevealHoveredFontRef.current = true;
        }
        if (
          event.key === KEYS.ARROW_DOWN &&
          isLoadingMoreOnScroll &&
          canLoadMoreFonts &&
          hoveredFont &&
          !hoveredFont.next
        ) {
          // on the last font, with more to come: load it rather than wrap
          // around to the first one
          loadMoreFonts();
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        const handled = fontPickerKeyHandler({
          event,
          inputRef,
          hoveredFont,
          filteredFonts: selectableFonts,
          onSelect: selectFontFamily,
          onHover: hoverFontFamily,
          // Escape, wherever the focus is in the popup. `onClose` alone takes
          // a preview back and leaves the popup open - it is also what a
          // focus moving out reports, which doesn't close it
          onClose: () => {
            onClose();
            setAppState((state) => ({
              openPopup:
                state.openPopup === "fontFamily" ? null : state.openPopup,
            }));
          },
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
        setAppState,
        inputRef,
        isLoadingMoreOnScroll,
        canLoadMoreFonts,
        loadMoreFonts,
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
    const pushGroup = (
      title: string,
      key: string,
      groupFonts: readonly FontDescriptor[],
      footer?: React.ReactNode,
    ) => {
      // a footer is shown also on its own, i.e. "Browse more fonts" when the
      // scene uses every available font
      if (!groupFonts.length && !footer) {
        return;
      }
      groups.push(
        <DropdownMenuGroup title={title} key={key}>
          {groupFonts.map((font) => (
            <FontPickerListItem
              key={font.value}
              font={font}
              isHovered={font.value === hoveredFont?.value}
              isSelected={font.value === selectedFontFamily}
              onSelect={selectRowFontFamily}
              onHover={hoverRowFontFamily}
              setItemRef={setFontItemRef}
            />
          ))}
          {footer}
        </DropdownMenuGroup>,
      );
    };

    pushGroup(t("fontList.sceneFonts"), "group_1", sceneFilteredFonts);
    pushGroup(t("fontList.pinnedFonts"), "group_pinned", pinnedFilteredFonts);
    pushGroup(
      t("fontList.availableFonts"),
      "group_2",
      availableFilteredFonts,
      canLoadMoreFonts ? (
        <button
          type="button"
          className="FontPicker__load-more"
          disabled={isLoadingMoreFonts}
          // keeps the focus where it is (the search), and with it the
          // picker's keyboard handling
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => loadMoreFonts()}
          onKeyDown={(event) => {
            // the picker acts on these (Enter picks the highlighted font)
            if (event.key === KEYS.ENTER || event.key === KEYS.SPACE) {
              event.stopPropagation();
            }
          }}
        >
          {t(isLoadingMoreFonts ? "fontList.loadingMore" : "fontList.loadMore")}
        </button>
      ) : (
        hasSearchForMore && (
          <div className="FontPicker__search-for-more">
            {t("fontList.searchForMore")}
          </div>
        )
      ),
    );
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
        {isSearchShown && (
          <div className="FontPicker__search">
            <QuickSearch
              ref={inputRef}
              placeholder={t("quickSearch.placeholder")}
              onChange={(term) => {
                setLocalHoveredFontFamily(null);
                onSearchChange(term);
              }}
            />
            {/* takes the search's place for the drag - on top of it rather
                than instead of it, so that the query and the focus survive */}
            {pinnedFonts && dnd?.dragState && (
              <div
                ref={dnd.setDropZoneEl}
                className={clsx("FontPicker__pin-drop-zone", {
                  "FontPicker__pin-drop-zone--over":
                    dnd.dragState.isOverDropZone,
                  "FontPicker__pin-drop-zone--remove": pinnedFamilies.has(
                    dnd.dragState.value,
                  ),
                })}
              >
                <TopPicksDnDOutline />
                {t(
                  pinnedFamilies.has(dnd.dragState.value)
                    ? "fontList.unpinFont"
                    : "fontList.pinFont",
                )}
              </div>
            )}
          </div>
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
            tip={
              fontPickerTip === undefined ? (
                <>
                  <span className="FontPicker__tip-icon" aria-hidden="true">
                    {DragDropIcon}
                  </span>
                  {t("fontList.topPicksTip")}
                </>
              ) : (
                fontPickerTip
              )
            }
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
