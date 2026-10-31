import { Popover } from "radix-ui";
import clsx from "clsx";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";

import {
  FONT_FAMILY,
  FONT_TOP_PICKS_SLOTS,
  getFontFamilyString,
  isCustomFontFamily,
  parseProviderFontFamily,
} from "@excalidraw/common";

import type { FontFamily } from "@excalidraw/common";

import { t } from "../../i18n";
import { useApp, useAppProps } from "../App";
import { ButtonSeparator } from "../ButtonSeparator";
import {
  FontFamilyCodeIcon,
  FontFamilyNormalIcon,
  FreedrawIcon,
} from "../icons";
import { TopPicksContextMenu } from "../TopPicksDnD/TopPicksContextMenu";
import {
  getTopPickReorderOffset,
  TopPicksDnDOutline,
} from "../TopPicksDnD/topPicksDnD";

import { FontPickerList, type FontSelectionOptions } from "./FontPickerList";
import { FontPickerTrigger } from "./FontPickerTrigger";
import { getFontPreviewText, loadFontPreviewText } from "./fontPreviewText";
import {
  FontPickerDnDContext,
  useFontPickerDnD,
  useFontTopPicksDnD,
} from "./fontTopPicksDnD";
import { getFontFamilyIcon, getFontFamilyLabel } from "./useFontCatalog";

import "./FontPicker.scss";

// length must equal FONT_TOP_PICKS_SLOTS (enforced by fontTopPicks.test.ts)
export const DEFAULT_FONTS = [
  {
    value: FONT_FAMILY.Excalifont,
    icon: FreedrawIcon,
    text: t("labels.handDrawn"),
    testId: "font-family-hand-drawn",
  },
  {
    value: FONT_FAMILY.Nunito,
    icon: FontFamilyNormalIcon,
    text: t("labels.normal"),
    testId: "font-family-normal",
  },
  {
    value: FONT_FAMILY["Comic Shanns"],
    icon: FontFamilyCodeIcon,
    text: t("labels.code"),
    testId: "font-family-code",
  },
];

const DEFAULT_FONT_TOP_PICKS = DEFAULT_FONTS.map((font) => font.value);

const defaultFontFamilies = new Set(DEFAULT_FONT_TOP_PICKS);

const getFontTopPicks = (
  topPicks: readonly FontFamily[],
): readonly FontFamily[] => {
  const picks = [...new Set(topPicks)].slice(0, FONT_TOP_PICKS_SLOTS);
  for (const fontFamily of DEFAULT_FONT_TOP_PICKS) {
    if (picks.length >= FONT_TOP_PICKS_SLOTS) {
      break;
    }
    if (!picks.includes(fontFamily)) {
      picks.push(fontFamily);
    }
  }
  return picks;
};

export const isDefaultFont = (fontFamily: FontFamily | null) => {
  if (!fontFamily) {
    return false;
  }

  return defaultFontFamilies.has(fontFamily as number);
};

const getTopPickFont = (fontFamily: FontFamily) =>
  DEFAULT_FONTS.find((font) => font.value === fontFamily) ?? {
    value: fontFamily,
    icon: getFontFamilyIcon(fontFamily),
    text: getFontFamilyLabel(fontFamily, []),
    testId: `font-family-${fontFamily}`,
  };

const needsGlyphSample = (
  fontFamily: FontFamily,
  picks: readonly FontFamily[],
) => {
  if (isCustomFontFamily(fontFamily)) {
    return true;
  }
  if (defaultFontFamilies.has(fontFamily as number)) {
    return false;
  }
  const icon = getFontFamilyIcon(fontFamily);
  return picks.some(
    (pick) => pick !== fontFamily && getTopPickFont(pick).icon === icon,
  );
};

const FontTopPicks = ({
  picks,
  selectedFontFamily,
  onSelect,
  onReset,
  isCustomized,
}: {
  picks: readonly FontFamily[];
  selectedFontFamily: FontFamily | null;
  onSelect: (fontFamily: FontFamily) => void;
  /** present when the strip is user-customizable */
  onReset?: () => void;
  isCustomized: boolean;
}) => {
  const dnd = useFontPickerDnD();
  const dragState = dnd?.dragState ?? null;
  const fonts = useApp().fonts.instance;
  const { fontProviders } = useAppProps();
  const selectRequestIdRef = useRef(0);
  const [, rerender] = useReducer((count: number) => count + 1, 0);

  // layout effect: a synchronous answer lands before paint, without flashing
  // the default first
  useLayoutEffect(() => {
    let isCurrent = true;
    const onSettled = () => isCurrent && rerender();
    let hasSyncAnswer = false;
    for (const fontFamily of picks) {
      const previousText = getFontPreviewText(fontFamily);
      const pending = loadFontPreviewText(fontFamily, fontProviders);
      if (pending) {
        pending.then(onSettled);
      } else if (getFontPreviewText(fontFamily) !== previousText) {
        hasSyncAnswer = true;
      }
    }
    if (hasSyncAnswer) {
      rerender();
    }
    return () => {
      isCurrent = false;
    };
  }, [picks, fontProviders]);

  // custom picks render their sample in their own typeface
  useEffect(() => {
    void fonts.registerCustomFamilies(
      picks.filter(
        (fontFamily) =>
          isCustomFontFamily(fontFamily) &&
          fonts.getResolutionStatus(fontFamily) === "initial",
      ),
    );
  }, [fonts, picks]);

  const isUnsupported = (fontFamily: FontFamily) => {
    if (!isCustomFontFamily(fontFamily)) {
      return false;
    }
    const parsed = parseProviderFontFamily(fontFamily);
    return (
      !parsed ||
      !fontProviders ||
      !Object.hasOwn(fontProviders, parsed.providerId)
    );
  };

  // last click wins, as in the list
  const selectPick = async (fontFamily: FontFamily) => {
    const requestId = ++selectRequestIdRef.current;
    if (isCustomFontFamily(fontFamily) && !fonts.registered.has(fontFamily)) {
      const result = await fonts.registerCustomFamily(fontFamily);
      if (
        result.status !== "success" ||
        selectRequestIdRef.current !== requestId
      ) {
        return;
      }
    }
    onSelect(fontFamily);
  };

  return (
    <TopPicksContextMenu
      onReset={onReset}
      isCustomized={isCustomized}
      resetLabel={t("fontList.resetTopPicks")}
    >
      <div className="buttonList FontPicker__top-picks">
        {/* the drop target (outline & hit area) — hugs the picks, unlike the
            wrapper, which spans its grid column and carries padding */}
        <div
          className={clsx("FontPicker__top-picks-slots top-picks-dnd", {
            "is-dnd-active": !!dragState,
          })}
          ref={dnd?.setStripEl}
        >
          {dragState && <TopPicksDnDOutline />}
          {picks.map((fontFamily, index) => {
            const font = getTopPickFont(fontFamily);
            const reorderOffset = getTopPickReorderOffset(dragState, index);
            return (
              <button
                key={fontFamily}
                type="button"
                title={font.text}
                data-testid={font.testId}
                className={clsx("top-picks-dnd__pick", {
                  active: fontFamily === selectedFontFamily,
                  "is-dnd-source":
                    dragState?.origin.kind === "pick" &&
                    dragState.origin.index === index,
                  "is-dnd-target":
                    dragState?.origin.kind === "source" &&
                    dragState.overIndex === index,
                  "is-dnd-duplicate": dragState?.duplicateIndex === index,
                })}
                style={
                  reorderOffset
                    ? { transform: `translateX(${reorderOffset}px)` }
                    : undefined
                }
                disabled={isUnsupported(fontFamily)}
                onClick={() => selectPick(fontFamily)}
                onPointerDown={
                  dnd
                    ? (event) => dnd.startPickDrag(event, index, fontFamily)
                    : undefined
                }
                data-top-pick-index={index}
              >
                {needsGlyphSample(fontFamily, picks) ? (
                  <span
                    className="FontPicker__top-pick-sample"
                    style={{ fontFamily: getFontFamilyString({ fontFamily }) }}
                  >
                    {getFontPreviewText(fontFamily)}
                  </span>
                ) : (
                  font.icon
                )}
              </button>
            );
          })}
        </div>
      </div>
    </TopPicksContextMenu>
  );
};

interface FontPickerProps {
  isOpened: boolean;
  selectedFontFamily: FontFamily | null;
  hoveredFontFamily: FontFamily | null;
  /** user-customized top picks (`appState.fontTopPicks`) */
  topPicks: readonly FontFamily[] | null;
  onSelect: (fontFamily: FontFamily, options?: FontSelectionOptions) => void;
  onTopPicksChange: (fontTopPicks: FontFamily[] | null) => void;
  onHover: (fontFamily: FontFamily) => void;
  onLeave: () => void;
  onPopupChange: (open: boolean) => void;
  compactMode?: boolean;
}

export const FontPicker = React.memo(
  ({
    isOpened,
    selectedFontFamily,
    hoveredFontFamily,
    topPicks,
    onSelect,
    onTopPicksChange,
    onHover,
    onLeave,
    onPopupChange,
    compactMode = false,
  }: FontPickerProps) => {
    const onSelectCallback = useCallback(
      (value: FontFamily | false) => {
        if (value) {
          onSelect(value);
        }
      },
      [onSelect],
    );

    // the strip (and thus its customization) is hidden in compact mode
    const isTopPicksCustomizable = !compactMode;
    const isCustomized = !!topPicks?.length;
    const picks = useMemo(
      () =>
        topPicks?.length ? getFontTopPicks(topPicks) : DEFAULT_FONT_TOP_PICKS,
      [topPicks],
    );

    const resetTopPicks = () => onTopPicksChange(null);

    const dnd = useFontTopPicksDnD({
      enabled: isTopPicksCustomizable,
      picks,
      onPicksChange: onTopPicksChange,
    });

    return (
      <FontPickerDnDContext.Provider
        value={isTopPicksCustomizable ? dnd : null}
      >
        <div
          role="dialog"
          aria-modal="true"
          className={clsx("FontPicker__container", {
            "FontPicker__container--compact": compactMode,
          })}
        >
          {!compactMode && (
            <FontTopPicks
              picks={picks}
              selectedFontFamily={selectedFontFamily}
              onSelect={onSelectCallback}
              isCustomized={isCustomized}
              onReset={isTopPicksCustomizable ? resetTopPicks : undefined}
            />
          )}
          {!compactMode && <ButtonSeparator />}
          <Popover.Root open={isOpened} onOpenChange={onPopupChange}>
            <FontPickerTrigger
              selectedFontFamily={selectedFontFamily}
              isOpened={isOpened}
              compactMode={compactMode}
            />
            {isOpened && (
              <FontPickerList
                selectedFontFamily={selectedFontFamily}
                hoveredFontFamily={hoveredFontFamily}
                onSelect={onSelect}
                onHover={onHover}
                onLeave={onLeave}
                onOpen={() => onPopupChange(true)}
                onClose={() => onPopupChange(false)}
                onResetTopPicks={
                  isTopPicksCustomizable && isCustomized
                    ? resetTopPicks
                    : undefined
                }
              />
            )}
          </Popover.Root>
        </div>
      </FontPickerDnDContext.Provider>
    );
  },
  // deliberately narrow: the parent re-renders on every canvas interaction,
  // and only these props change what the picker shows. The price is that the
  // callback props may be closures from an older render - they must read live
  // state through stable handles (`app`, refs, setters), never render-scoped
  // props. See `onPopupChange` in `actionChangeFontFamily`
  (prev, next) =>
    prev.isOpened === next.isOpened &&
    prev.selectedFontFamily === next.selectedFontFamily &&
    prev.hoveredFontFamily === next.hoveredFontFamily &&
    prev.topPicks === next.topPicks &&
    prev.compactMode === next.compactMode,
);
