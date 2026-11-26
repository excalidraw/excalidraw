import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useReducer,
  useState,
  type JSX,
} from "react";

import {
  arrayToList,
  createProviderFontFamily,
  FONT_FAMILY,
  getFontFamilyString,
  isCustomFontFamily,
  parseProviderFontFamily,
} from "@excalidraw/common";

import type { CustomFontFamily, FontFamily } from "@excalidraw/common";

import type { ValueOf } from "@excalidraw/common/utility-types";

import { t } from "../../i18n";
import { DropDownMenuItemBadgeType } from "../dropdownMenu/DropdownMenuItem";
import {
  FontFamilyCodeIcon,
  FontFamilyHeadingIcon,
  FontFamilyNormalIcon,
  FreedrawIcon,
} from "../icons";

import {
  getProvidedFontKind,
  getProvidedFontPreviewText,
  loadFontKind,
  loadFontPreviewText,
} from "./fontProviderInfo";

import type { Fonts } from "../../fonts";

import type { FontKind, FontProviders, ProvidedFont } from "../../types";
import type { RegisteredFont } from "../../fonts";

import type { ProviderSearchResult } from "./useFontSearch";
import type { MoreFont } from "./useMoreFonts";

/**
 * Our own fonts lead the available ones, in this order - what a host's
 * providers offer comes after them.
 */
const LEADING_FONT_FAMILIES: readonly FontFamily[] = [
  FONT_FAMILY.Excalifont,
  FONT_FAMILY.Nunito,
  FONT_FAMILY["Comic Shanns"],
  FONT_FAMILY["Lilita One"],
];

/** shared by all providers, the rest is left to narrowing down the search */
const SEARCH_MATCHES_LIMIT = 10;
const SEARCH_SUGGESTIONS_LIMIT = 5;

/**
 * Up to `total` items, slots dealt round-robin so every list gets an equal
 * share - one running short passes its slots on to the rest. Each list keeps
 * its own order and stays contiguous.
 */
const takeFairShare = <T,>(lists: readonly (readonly T[])[], total: number) => {
  const slots = lists.map(() => 0);
  for (let remaining = total, dealt = true; remaining > 0 && dealt; ) {
    dealt = false;
    for (let i = 0; i < lists.length && remaining > 0; i++) {
      if (slots[i] < lists[i].length) {
        slots[i]++;
        remaining--;
        dealt = true;
      }
    }
  }
  return lists.flatMap((list, i) => list.slice(0, slots[i]));
};

export interface FontDescriptor {
  value: FontFamily;
  icon: JSX.Element;
  text: string;
  status?: "failed" | "loading" | "unsupported";
  deprecated?: true;
  badge?: {
    type: ValueOf<typeof DropDownMenuItemBadgeType>;
    placeholder: string;
  };
}

// one element per family and text: a row re-renders when its icon changes
const glyphIcons = new Map<string, JSX.Element>();

/** the family's preview text, written in the family - see `getPreviewText` */
const getGlyphIcon = (fontFamily: CustomFontFamily, text: string) => {
  const key = `${fontFamily}\n${text}`;
  let icon = glyphIcons.get(key);
  if (!icon) {
    icon = (
      <span
        className="FontPicker__glyph-icon"
        style={{ fontFamily: getFontFamilyString({ fontFamily }) }}
      >
        {text}
      </span>
    );
    glyphIcons.set(key, icon);
  }
  return icon;
};

/** the icons our own fonts have, for a provider's family of the same kind */
const FONT_KIND_ICONS: Record<FontKind, JSX.Element> = {
  "hand-drawn": FreedrawIcon,
  normal: FontFamilyNormalIcon,
  code: FontFamilyCodeIcon,
  heading: FontFamilyHeadingIcon,
};

/**
 * A custom family goes by what its provider says about it: a sample of its
 * script, else the icon of its kind, else the provider's own icon.
 */
export const getFontFamilyIcon = (
  fontFamily: FontFamily,
  icons?: Record<string, { icon?: JSX.Element }>,
): JSX.Element => {
  if (isCustomFontFamily(fontFamily)) {
    const previewText = getProvidedFontPreviewText(fontFamily);
    if (previewText) {
      return getGlyphIcon(fontFamily, previewText);
    }
    const kind = getProvidedFontKind(fontFamily);
    if (kind) {
      return FONT_KIND_ICONS[kind];
    }
    const parsed = parseProviderFontFamily(fontFamily);
    const icon = parsed ? icons?.[parsed.providerId]?.icon : undefined;
    if (icon) {
      return icon;
    }
  }

  switch (fontFamily) {
    case FONT_FAMILY.Excalifont:
    case FONT_FAMILY.Virgil:
      return FreedrawIcon;
    case FONT_FAMILY.Nunito:
    case FONT_FAMILY.Helvetica:
      return FontFamilyNormalIcon;
    case FONT_FAMILY["Lilita One"]:
      return FontFamilyHeadingIcon;
    case FONT_FAMILY["Comic Shanns"]:
    case FONT_FAMILY.Cascadia:
      return FontFamilyCodeIcon;
    default:
      return FontFamilyNormalIcon;
  }
};

/** `{ id, label }` for both forms a provider may give - see `ProvidedFont` */
export const toProvidedFont = (font: ProvidedFont) =>
  typeof font === "string" ? { id: font, label: font } : font;

/** whether a provider's (host-supplied) entry is usable at all */
const isProvidedFont = (font: unknown): font is ProvidedFont =>
  (typeof font === "string" && !!font) ||
  (typeof font === "object" &&
    font !== null &&
    typeof (font as { id?: unknown }).id === "string" &&
    !!(font as { id: string }).id &&
    typeof (font as { label?: unknown }).label === "string");

/** the provider's entries as `{ id, label }`, dropping malformed ones */
export const getProvidedFonts = (fonts: readonly unknown[]) =>
  fonts.filter(isProvidedFont).map(toProvidedFont);

/**
 * The name to show for a family. A custom one goes by the label its resolver
 * gave (see `FontDefinition.label`), else by the family part of its id.
 */
export const getFontFamilyLabel = (
  fontFamily: FontFamily,
  registeredFont: RegisteredFont | undefined,
) => {
  if (isCustomFontFamily(fontFamily)) {
    return (
      registeredFont?.label ??
      parseProviderFontFamily(fontFamily)?.familyName ??
      fontFamily
    );
  }

  return (
    Object.entries(FONT_FAMILY).find(([, id]) => id === fontFamily)?.[0] ??
    registeredFont?.fontFaces[0]?.family ??
    "Unknown"
  );
};

interface FontCatalogOptions {
  fonts: Fonts;
  fontProviders?: FontProviders;
  registeredFonts: Fonts["registered"];
  failedResolutions: ReadonlyMap<string, unknown>;
  selectedFontFamily: FontFamily | null;
  hoveredFontFamily: FontFamily | null;
  /** the user's favorites - see `ExcalidrawProps.fontFavorites` */
  favoriteFamilies: ReadonlySet<FontFamily>;
  /** fonts loaded on demand, in the order they arrived - see `useMoreFonts` */
  moreFonts: readonly MoreFont[];
  resolvingFamily: CustomFontFamily | null;
  searchTerm: string;
  searchResults: readonly ProviderSearchResult[];
  showDeprecatedFonts: boolean;
}

export const useFontCatalog = ({
  fonts,
  fontProviders,
  registeredFonts,
  failedResolutions,
  selectedFontFamily,
  hoveredFontFamily,
  favoriteFamilies,
  moreFonts,
  resolvingFamily,
  searchTerm,
  searchResults,
  showDeprecatedFonts,
}: FontCatalogOptions) => {
  // a hover preview rewrites the selection's family, so the scene groups follow
  // the registry only while there is none (and catch up once it ends)
  const [sceneRegisteredFonts, setSceneRegisteredFonts] =
    useState(registeredFonts);
  if (hoveredFontFamily == null && sceneRegisteredFonts !== registeredFonts) {
    setSceneRegisteredFonts(registeredFonts);
  }

  // the families of the elements on canvas - the current one (what the next
  // text gets) isn't the scene's until an element uses it
  const sceneFamilies = useMemo(
    () => new Set(fonts.getSceneFamilies()),
    // refresh after selection without recalculating on hover. `registeredFonts`
    // additionally refreshes the groups when a scene-only custom family arrives
    // while the picker is open (i.e. collab, paste), registering on load
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedFontFamily, sceneRegisteredFonts],
  );

  const getCustomFontStatus = useCallback(
    (family: CustomFontFamily) => {
      if (resolvingFamily === family) {
        return "loading" as const;
      }
      const parsed = parseProviderFontFamily(family);
      // own-property check: "toString:Foo" must not match an inherited
      // `Object.prototype` member as a provider
      if (
        !parsed ||
        !fontProviders ||
        !Object.hasOwn(fontProviders, parsed.providerId)
      ) {
        return "unsupported" as const;
      }
      return failedResolutions.has(family) ? ("failed" as const) : undefined;
    },
    [fontProviders, failedResolutions, resolvingFamily],
  );

  const resultFamilies = useMemo(
    () =>
      new Set(
        searchResults.flatMap(({ providerId, fonts }) =>
          getProvidedFonts(fonts).map(({ id }) =>
            createProviderFontFamily(providerId, id),
          ),
        ),
      ),
    [searchResults],
  );

  // what a provider says about a family arrives after the row it changes the
  // icon of
  const [providerInfoVersion, onProviderInfoChange] = useReducer(
    (version: number) => version + 1,
    0,
  );
  const getIcon = useMemo(() => {
    // a new function per version: the lists below rebuild with the new icons
    void providerInfoVersion;
    return (fontFamily: FontFamily) =>
      getFontFamilyIcon(fontFamily, fontProviders);
  }, [fontProviders, providerInfoVersion]);

  const { allFonts, moreOnlyFamilies } = useMemo(() => {
    const descriptors = new Map<FontFamily, FontDescriptor>();
    // loaded on demand, and listed for no other reason
    const moreOnlyFamilies = new Set<FontFamily>();

    for (const [providerId, provider] of Object.entries(fontProviders ?? {})) {
      for (const { id, label } of getProvidedFonts(provider.availableFonts)) {
        const familyId = createProviderFontFamily(providerId, id);
        descriptors.set(familyId, {
          value: familyId,
          icon: getIcon(familyId),
          text: label,
          status: getCustomFontStatus(familyId),
        });
      }
    }

    for (const familyId of [
      ...sceneFamilies,
      // listed whether or not their provider (still) offers them
      ...favoriteFamilies,
      // the current family may be in no element yet (i.e. found by search
      // and picked with nothing on canvas) - it must still be listed. One
      // loaded on demand is, and keeps its place there
      ...(selectedFontFamily != null &&
      !moreFonts.some((font) => font.value === selectedFontFamily)
        ? [selectedFontFamily]
        : []),
      // a search result resolves in place rather than jumping into the list
      ...(resolvingFamily && !resultFamilies.has(resolvingFamily)
        ? [resolvingFamily]
        : []),
    ]) {
      if (!isCustomFontFamily(familyId) || descriptors.has(familyId)) {
        continue;
      }
      descriptors.set(familyId, {
        value: familyId,
        icon: getIcon(familyId),
        text: getFontFamilyLabel(familyId, registeredFonts.get(familyId)),
        status: getCustomFontStatus(familyId),
      });
    }

    for (const { value, text } of moreFonts) {
      if (!descriptors.has(value)) {
        moreOnlyFamilies.add(value);
        descriptors.set(value, {
          value,
          icon: getIcon(value),
          text,
          status: getCustomFontStatus(value),
        });
      }
    }

    for (const [familyId, registeredFont] of registeredFonts) {
      const { metadata } = registeredFont;
      if (metadata.private || metadata.fallback) {
        continue;
      }
      // registration alone does not earn a custom family a place in the list -
      // it gets one from `availableFonts` or from being used in the scene.
      // Listing whatever is registered would instead grow the list with every
      // previewed or searched family, and permanently so - the registry is
      // page-global and never evicts.
      if (isCustomFontFamily(familyId) && !descriptors.has(familyId)) {
        continue;
      }

      const fontDescriptor: FontDescriptor = {
        value: familyId,
        icon: getIcon(familyId),
        // an offered custom font keeps the label its provider offered it by
        text:
          descriptors.get(familyId)?.text ??
          getFontFamilyLabel(familyId, registeredFont),
      };

      if (metadata.deprecated) {
        fontDescriptor.deprecated = metadata.deprecated;
        fontDescriptor.badge = {
          type: DropDownMenuItemBadgeType.RED,
          placeholder: t("fontList.badge.old"),
        };
      }

      descriptors.set(familyId, fontDescriptor);
    }

    return {
      allFonts: Array.from(descriptors.values()).sort((a, b) =>
        a.text.toLowerCase() > b.text.toLowerCase() ? 1 : -1,
      ),
      moreOnlyFamilies,
    };
  }, [
    moreFonts,
    registeredFonts,
    fontProviders,
    getCustomFontStatus,
    resolvingFamily,
    resultFamilies,
    sceneFamilies,
    favoriteFamilies,
    selectedFontFamily,
    getIcon,
  ]);

  // a font is listed once: with the scene's, else among the favorites, else
  // among the available ones
  const sceneFonts = useMemo(
    () => allFonts.filter((font) => sceneFamilies.has(font.value)),
    [allFonts, sceneFamilies],
  );
  const favoriteFonts = useMemo(
    () =>
      allFonts.filter(
        (font) =>
          favoriteFamilies.has(font.value) && !sceneFamilies.has(font.value),
      ),
    [allFonts, favoriteFamilies, sceneFamilies],
  );
  // Ours lead (the current ones, then the deprecated ones), a host's follow
  // by name, and what got loaded on demand comes last in the order it
  // arrived - so that loading more never moves a font listed before.
  const availableFonts = useMemo(() => {
    const available = allFonts.filter(
      (font) =>
        !sceneFamilies.has(font.value) &&
        !favoriteFamilies.has(font.value) &&
        // the current font is listed even when deprecated
        (showDeprecatedFonts ||
          !font.deprecated ||
          font.value === selectedFontFamily),
    );
    const byValue = new Map(available.map((font) => [font.value, font]));
    const leading = LEADING_FONT_FAMILIES.flatMap(
      (fontFamily) => byValue.get(fontFamily) ?? [],
    );
    const deprecated = available.filter(
      (font) => font.deprecated && !leading.includes(font),
    );
    const more = moreFonts.flatMap(({ value }) =>
      moreOnlyFamilies.has(value) ? byValue.get(value) ?? [] : [],
    );
    const placed = new Set([...leading, ...deprecated, ...more]);

    return [
      ...leading,
      ...deprecated,
      ...available.filter((font) => !placed.has(font)),
      ...more,
    ];
  }, [
    allFonts,
    moreFonts,
    moreOnlyFamilies,
    sceneFamilies,
    favoriteFamilies,
    showDeprecatedFonts,
    selectedFontFamily,
  ]);
  const filteredFontDescriptors = useMemo(
    () =>
      [...sceneFonts, ...favoriteFonts, ...availableFonts].filter((font) =>
        font.text.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [sceneFonts, favoriteFonts, availableFonts, searchTerm],
  );
  const { searchMatches, hiddenSearchMatchCount, searchSuggestions } =
    useMemo(() => {
      const listed = new Set(filteredFontDescriptors.map((font) => font.value));
      const getDescriptors = (kind: ProviderSearchResult["kind"]) =>
        searchResults
          .filter((result) => result.kind === kind)
          .map(({ providerId, fonts }) => {
            const descriptors: FontDescriptor[] = [];
            for (const { id, label } of getProvidedFonts(fonts)) {
              const familyId = createProviderFontFamily(providerId, id);
              if (listed.has(familyId)) {
                continue;
              }
              listed.add(familyId);
              descriptors.push({
                value: familyId,
                icon: getIcon(familyId),
                text: label,
                status: getCustomFontStatus(familyId),
              });
            }
            return descriptors;
          });

      const matches = getDescriptors("match");
      const searchMatches = takeFairShare(matches, SEARCH_MATCHES_LIMIT);

      return {
        searchMatches,
        hiddenSearchMatchCount: matches.flat().length - searchMatches.length,
        searchSuggestions:
          filteredFontDescriptors.length || searchMatches.length
            ? []
            : takeFairShare(
                getDescriptors("suggestion"),
                SEARCH_SUGGESTIONS_LIMIT,
              ),
      };
    }, [filteredFontDescriptors, searchResults, getCustomFontStatus, getIcon]);

  // layout effect: a synchronous answer lands before paint, without flashing
  // another icon first
  useLayoutEffect(() => {
    let isCurrent = true;
    const getIconSource = (fontFamily: FontFamily) =>
      getProvidedFontPreviewText(fontFamily) ?? getProvidedFontKind(fontFamily);
    /** @returns whether an answer came synchronously, and changed the icon */
    const load = (fontFamily: FontFamily) => {
      const previous = getIconSource(fontFamily);
      const hasChanged = () => getIconSource(fontFamily) !== previous;
      const onSettled = () => {
        if (isCurrent && hasChanged()) {
          onProviderInfoChange();
        }
      };
      loadFontPreviewText(fontFamily, fontProviders)?.then(onSettled);
      loadFontKind(fontFamily, fontProviders)?.then(onSettled);
      return hasChanged();
    };
    // `map`, not `some`: every family gets asked
    const hasSyncAnswer = [...allFonts, ...searchMatches, ...searchSuggestions]
      .map((font) => load(font.value))
      .includes(true);
    if (hasSyncAnswer) {
      onProviderInfoChange();
    }
    return () => {
      isCurrent = false;
    };
  }, [allFonts, searchMatches, searchSuggestions, fontProviders]);

  const selectableFonts = useMemo(
    () =>
      arrayToList(
        [
          ...filteredFontDescriptors,
          ...searchMatches,
          ...searchSuggestions,
        ].filter((font) => font.status !== "unsupported"),
      ),
    [filteredFontDescriptors, searchMatches, searchSuggestions],
  );
  const sceneFilteredFonts = useMemo(
    () =>
      filteredFontDescriptors.filter((font) => sceneFamilies.has(font.value)),
    [filteredFontDescriptors, sceneFamilies],
  );
  const favoriteFilteredFonts = useMemo(
    () =>
      filteredFontDescriptors.filter(
        (font) =>
          favoriteFamilies.has(font.value) && !sceneFamilies.has(font.value),
      ),
    [filteredFontDescriptors, favoriteFamilies, sceneFamilies],
  );
  const availableFilteredFonts = useMemo(
    () =>
      filteredFontDescriptors.filter(
        (font) =>
          !sceneFamilies.has(font.value) && !favoriteFamilies.has(font.value),
      ),
    [filteredFontDescriptors, sceneFamilies, favoriteFamilies],
  );

  const listedFamilies = useMemo(
    () => new Set(allFonts.map((font) => font.value)),
    [allFonts],
  );

  return {
    listedFamilies,
    selectableFonts,
    sceneFilteredFonts,
    favoriteFilteredFonts,
    availableFilteredFonts,
    searchMatches,
    hiddenSearchMatchCount,
    searchSuggestions,
  };
};
