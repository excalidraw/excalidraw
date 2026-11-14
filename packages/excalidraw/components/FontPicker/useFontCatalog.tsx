import { useCallback, useMemo, useState, type JSX } from "react";

import {
  arrayToList,
  createProviderFontFamily,
  FONT_FAMILY,
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

import type { Fonts } from "../../fonts";

import type { FontProviders, ProvidedFont } from "../../types";
import type { RegisteredFont } from "../../fonts";

import type { ProviderSearchResult } from "./useFontSearch";

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

export const getFontFamilyIcon = (
  fontFamily: FontFamily,
  icons?: Record<string, { icon: JSX.Element }>,
): JSX.Element => {
  if (isCustomFontFamily(fontFamily)) {
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

  const sceneFamilies = useMemo(
    () =>
      new Set([
        ...fonts.getSceneFamilies(),
        // the current default family may be in no element yet (i.e. searched
        // & selected with nothing on canvas) - it must still be listed
        ...(selectedFontFamily != null ? [selectedFontFamily] : []),
      ]),
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

  const allFonts = useMemo(() => {
    const descriptors = new Map<FontFamily, FontDescriptor>();

    for (const [providerId, provider] of Object.entries(fontProviders ?? {})) {
      for (const { id, label } of getProvidedFonts(provider.availableFonts)) {
        const familyId = createProviderFontFamily(providerId, id);
        descriptors.set(familyId, {
          value: familyId,
          icon: provider.icon,
          text: label,
          status: getCustomFontStatus(familyId),
        });
      }
    }

    for (const familyId of [
      ...sceneFamilies,
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
        icon: getFontFamilyIcon(familyId, fontProviders),
        text: getFontFamilyLabel(familyId, registeredFonts.get(familyId)),
        status: getCustomFontStatus(familyId),
      });
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
        icon: getFontFamilyIcon(familyId, fontProviders),
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

    return Array.from(descriptors.values()).sort((a, b) =>
      a.text.toLowerCase() > b.text.toLowerCase() ? 1 : -1,
    );
  }, [
    registeredFonts,
    fontProviders,
    getCustomFontStatus,
    resolvingFamily,
    resultFamilies,
    sceneFamilies,
  ]);

  const sceneFonts = useMemo(
    () => allFonts.filter((font) => sceneFamilies.has(font.value)),
    [allFonts, sceneFamilies],
  );
  const availableFonts = useMemo(
    () =>
      allFonts.filter(
        (font) =>
          !sceneFamilies.has(font.value) &&
          (showDeprecatedFonts || !font.deprecated),
      ),
    [allFonts, sceneFamilies, showDeprecatedFonts],
  );
  const filteredFontDescriptors = useMemo(
    () =>
      [...sceneFonts, ...availableFonts].filter((font) =>
        font.text.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [sceneFonts, availableFonts, searchTerm],
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
                icon: getFontFamilyIcon(familyId, fontProviders),
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
    }, [
      filteredFontDescriptors,
      searchResults,
      fontProviders,
      getCustomFontStatus,
    ]);

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
  const availableFilteredFonts = useMemo(
    () =>
      filteredFontDescriptors.filter((font) => !sceneFamilies.has(font.value)),
    [filteredFontDescriptors, sceneFamilies],
  );

  return {
    selectableFonts,
    sceneFilteredFonts,
    availableFilteredFonts,
    searchMatches,
    hiddenSearchMatchCount,
    searchSuggestions,
  };
};
