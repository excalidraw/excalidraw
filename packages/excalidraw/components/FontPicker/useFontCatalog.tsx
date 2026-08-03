import { useMemo, type JSX } from "react";

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

import type { FontProviders } from "../../types";
import type { ExcalidrawFontFace } from "../../fonts/ExcalidrawFontFace";

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

const getFontFamilyIcon = (
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

const getFontFamilyLabel = (
  fontFamily: FontFamily,
  fontFaces: ExcalidrawFontFace[],
) => {
  if (isCustomFontFamily(fontFamily)) {
    return parseProviderFontFamily(fontFamily)?.familyName ?? fontFamily;
  }

  return (
    Object.entries(FONT_FAMILY).find(([, id]) => id === fontFamily)?.[0] ??
    fontFaces[0]?.family ??
    "Unknown"
  );
};

interface FontCatalogOptions {
  fonts: Fonts;
  fontProviders?: FontProviders;
  registeredFonts: Fonts["registered"];
  failedResolutions: ReadonlyMap<string, unknown>;
  selectedFontFamily: FontFamily | null;
  newSceneFamilies: ReadonlySet<FontFamily>;
  resolvingFamily: CustomFontFamily | null;
  searchTerm: string;
  showDeprecatedFonts: boolean;
}

export const useFontCatalog = ({
  fonts,
  fontProviders,
  registeredFonts,
  failedResolutions,
  selectedFontFamily,
  newSceneFamilies,
  resolvingFamily,
  searchTerm,
  showDeprecatedFonts,
}: FontCatalogOptions) => {
  const sceneFamilies = useMemo(
    () =>
      new Set([
        ...fonts.getSceneFamilies(),
        ...newSceneFamilies,
        // the current default family may be in no element yet (i.e. searched
        // & selected with nothing on canvas, then the picker reopened -
        // `newSceneFamilies` dies with the popup) - it must still be listed
        ...(selectedFontFamily != null ? [selectedFontFamily] : []),
      ]),
    // refresh after selection without recalculating on hover. `registeredFonts`
    // additionally refreshes the groups when a scene-only custom family arrives
    // while the picker is open (i.e. collab, paste), registering on load
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedFontFamily, newSceneFamilies, registeredFonts],
  );

  const allFonts = useMemo(() => {
    const descriptors = new Map<FontFamily, FontDescriptor>();

    const getCustomFontStatus = (family: CustomFontFamily) => {
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
    };

    for (const [providerId, provider] of Object.entries(fontProviders ?? {})) {
      for (const familyName of provider.availableFonts) {
        const familyId = createProviderFontFamily(providerId, familyName);
        descriptors.set(familyId, {
          value: familyId,
          icon: provider.icon,
          text: familyName,
          status: getCustomFontStatus(familyId),
        });
      }
    }

    for (const familyId of [
      ...sceneFamilies,
      ...(resolvingFamily ? [resolvingFamily] : []),
    ]) {
      if (!isCustomFontFamily(familyId) || descriptors.has(familyId)) {
        continue;
      }
      descriptors.set(familyId, {
        value: familyId,
        icon: getFontFamilyIcon(familyId, fontProviders),
        text: getFontFamilyLabel(familyId, []),
        status: getCustomFontStatus(familyId),
      });
    }

    for (const [familyId, { metadata, fontFaces }] of registeredFonts) {
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
        text: getFontFamilyLabel(familyId, fontFaces),
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
    failedResolutions,
    resolvingFamily,
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
  const filteredFonts = useMemo(
    () => arrayToList(filteredFontDescriptors),
    [filteredFontDescriptors],
  );
  const selectableFonts = useMemo(
    () =>
      arrayToList(
        filteredFontDescriptors.filter((font) => font.status !== "unsupported"),
      ),
    [filteredFontDescriptors],
  );
  const sceneFilteredFonts = useMemo(
    () => filteredFonts.filter((font) => sceneFamilies.has(font.value)),
    [filteredFonts, sceneFamilies],
  );
  const availableFilteredFonts = useMemo(
    () => filteredFonts.filter((font) => !sceneFamilies.has(font.value)),
    [filteredFonts, sceneFamilies],
  );

  return {
    filteredFontDescriptors,
    filteredFonts,
    selectableFonts,
    sceneFilteredFonts,
    availableFilteredFonts,
  };
};
