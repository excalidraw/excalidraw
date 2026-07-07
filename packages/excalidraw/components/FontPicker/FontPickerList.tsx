import React, {
  useMemo,
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEventHandler,
} from "react";

import {
  arrayToList,
  debounce,
  FONT_FAMILY,
  getFontFamilyString,
} from "@excalidraw/common";

import type { FontFamily } from "@excalidraw/common";
import type { ValueOf } from "@excalidraw/common/utility-types";

import { Fonts } from "../../fonts";
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
import {
  DropDownMenuItemBadgeType,
  DropDownMenuItemBadge,
} from "../dropdownMenu/DropdownMenuItem";
import MenuItemContent from "../dropdownMenu/DropdownMenuItemContent";
import { getDropdownMenuItemClassName } from "../dropdownMenu/common";
import {
  FontFamilyCodeIcon,
  FontFamilyHeadingIcon,
  FontFamilyNormalIcon,
  FreedrawIcon,
  searchIcon,
} from "../icons";

import { fontPickerKeyHandler } from "./keyboardNavHandlers";

import type { JSX } from "react";
import type { ExcalidrawFontFace } from "../../fonts/ExcalidrawFontFace";

export interface FontDescriptor {
  value: FontFamily;
  icon: JSX.Element;
  text: string;
  deprecated?: true;
  badge?: {
    type: ValueOf<typeof DropDownMenuItemBadgeType>;
    placeholder: string;
  };
}

interface FontPickerListProps {
  selectedFontFamily: FontFamily | null;
  hoveredFontFamily: FontFamily | null;
  onSelect: (value: FontFamily) => void;
  onHover: (value: FontFamily) => void;
  onLeave: () => void;
  onOpen: () => void;
  onClose: () => void;
}

const getFontFamilyIcon = (fontFamily: FontFamily): JSX.Element => {
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
) =>
  // prefer our config as the browser resolved names may be wrapped in quotes and such
  Object.entries(FONT_FAMILY).find(([, id]) => id === fontFamily)?.[0] ??
  fontFaces[0]?.fontFace?.family ??
  "Unknown";

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

    const [rawSearchTerm, setRawSearchTerm] = useState("");
    const searchTerm = useMemo(
      () => rawSearchTerm.toLowerCase(),
      [rawSearchTerm],
    );
    const inputRef = useRef<HTMLInputElement>(null);
    const allFonts = useMemo(
      () => {
        // Built-in fonts from the registry
        const builtInFonts: FontDescriptor[] = Array.from(
          Fonts.registered.entries(),
        )
          .filter(
            ([familyId, { metadata }]) =>
              typeof familyId === "number" &&
              !metadata.private &&
              !metadata.fallback,
          )
          .map(([familyId, { metadata, fontFaces }]) => {
            const fontDescriptor = {
              value: familyId,
              icon: getFontFamilyIcon(familyId),
              text: getFontFamilyLabel(familyId, fontFaces),
            };

            if (metadata.deprecated) {
              Object.assign(fontDescriptor, {
                deprecated: metadata.deprecated,
                badge: {
                  type: DropDownMenuItemBadgeType.RED,
                  placeholder: t("fontList.badge.old"),
                },
              });
            }

            return fontDescriptor as FontDescriptor;
          });

        // Custom fonts from all configured font providers
        const providerFonts: FontDescriptor[] = fontProviders
          ? Object.entries(fontProviders).flatMap(([providerId, provider]) =>
              provider.availableFonts.map((f) => ({
                value: Fonts.createProviderFontFamily(providerId, f.value),
                icon: provider.icon,
                text: f.text,
              })),
            )
          : [];

        // Merge and deduplicate (provider fonts that are already registered get skipped)
        const builtInValues = new Set(builtInFonts.map((f) => f.value));
        const mergedFonts = [
          ...builtInFonts,
          ...providerFonts.filter((f) => !builtInValues.has(f.value)),
        ];

        return mergedFonts.sort((a, b) =>
          a.text.toLowerCase() > b.text.toLowerCase() ? 1 : -1,
        );
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [fontProviders],
    );

    const sceneFamilies = useMemo(
      () => new Set(fonts.getSceneFamilies()),
      // cache per selected font family, so hover re-render won't mess it up
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [selectedFontFamily],
    );

    const sceneFonts = useMemo(() => {
      const knownValues = new Set(allFonts.map((f) => f.value));
      // Always show all fonts in the scene, even those that were deprecated
      const known = allFonts.filter((font) => sceneFamilies.has(font.value));
      // Create synthetic descriptors for scene fonts not in allFonts
      // (e.g., custom fonts pasted from another scene, or removed from provider)
      const unknown: FontDescriptor[] = Array.from(sceneFamilies)
        .filter((family) => !knownValues.has(family))
        .map((family) => {
          let icon = FontFamilyNormalIcon;
          let text = typeof family === "string" ? family : String(family);

          if (typeof family === "string") {
            const parsed = Fonts.parseProviderFontFamily(family);
            if (parsed) {
              icon = fontProviders?.[parsed.providerId]?.icon ?? icon;
              text = parsed.familyName;
            }
          }

          return {
            value: family,
            icon,
            text,
          };
        });
      return [...known, ...unknown];
    }, [allFonts, sceneFamilies, fontProviders]);

    const availableFonts = useMemo(
      () =>
        allFonts.filter(
          (font) =>
            !sceneFamilies.has(font.value) &&
            (showDeprecatedFonts || !font.deprecated), // skip deprecated fonts
        ),
      [allFonts, sceneFamilies, showDeprecatedFonts],
    );

    const [isResolvingCustomFont, setIsResolvingCustomFont] = useState(false);

    // Show "Use X" item when the search term doesn't exactly match any font
    // and at least one provider exists
    const showUseCustomFont = useMemo(() => {
      if (!rawSearchTerm.trim() || !fontProviders) {
        return false;
      }
      const allCombined = [...sceneFonts, ...availableFonts];
      return !allCombined.some(
        (font) => font.text?.toLowerCase() === searchTerm,
      );
    }, [rawSearchTerm, searchTerm, fontProviders, sceneFonts, availableFonts]);

    const filteredFonts = useMemo(
      () =>
        arrayToList(
          [...sceneFonts, ...availableFonts].filter((font) =>
            font.text?.toLowerCase().includes(searchTerm),
          ),
        ),
      [sceneFonts, availableFonts, searchTerm],
    );

    const hoveredFont = useMemo(() => {
      let font;

      if (hoveredFontFamily) {
        font = filteredFonts.find((font) => font.value === hoveredFontFamily);
      } else if (selectedFontFamily) {
        font = filteredFonts.find((font) => font.value === selectedFontFamily);
      }

      if (!font && searchTerm) {
        if (filteredFonts[0]?.value) {
          // hover first element on search
          onHover(filteredFonts[0].value);
        } else {
          // re-render cache on no results
          onLeave();
        }
      }

      return font;
    }, [
      hoveredFontFamily,
      selectedFontFamily,
      searchTerm,
      filteredFonts,
      onHover,
      onLeave,
    ]);

    // Create a wrapped onSelect function that preserves caret position
    const wrappedOnSelect = useCallback(
      (fontFamily: FontFamily) => {
        // Save caret position before font selection if editing text
        let savedSelection: { start: number; end: number } | null = null;
        if (app.state.editingTextElement) {
          const textEditor = document.querySelector(
            ".excalidraw-wysiwyg",
          ) as HTMLTextAreaElement;
          if (textEditor) {
            savedSelection = {
              start: textEditor.selectionStart,
              end: textEditor.selectionEnd,
            };
          }
        }

        onSelect(fontFamily);

        // Restore caret position after font selection if editing text
        if (app.state.editingTextElement && savedSelection) {
          setTimeout(() => {
            const textEditor = document.querySelector(
              ".excalidraw-wysiwyg",
            ) as HTMLTextAreaElement;
            if (textEditor && savedSelection) {
              textEditor.focus();
              textEditor.selectionStart = savedSelection.start;
              textEditor.selectionEnd = savedSelection.end;
            }
          }, 0);
        }
      },
      [onSelect, app.state.editingTextElement],
    );

    const handleUseCustomFont = useCallback(async () => {
      if (!fontProviders || !rawSearchTerm.trim() || isResolvingCustomFont) {
        return;
      }

      setIsResolvingCustomFont(true);

      try {
        // Try each provider until one resolves successfully
        for (const [providerId, provider] of Object.entries(fontProviders)) {
          try {
            const familyName = rawSearchTerm.trim();
            const definition = await provider.resolve(familyName);
            const prefixedFamily = Fonts.createProviderFontFamily(
              providerId,
              familyName,
            );

            // Register the font
            Fonts.registerCustomFont(
              prefixedFamily,
              { metrics: definition.metrics },
              ...definition.fontFaces,
            );

            // Add font faces to document.fonts for rendering
            const registered = Fonts.registered.get(prefixedFamily);
            if (registered) {
              for (const { fontFace } of registered.fontFaces) {
                if (!document.fonts.has(fontFace)) {
                  document.fonts.add(fontFace);
                }
              }
            }

            // Select the font
            wrappedOnSelect(prefixedFamily);

            // Notify the provider (fire-and-forget)
            provider.onNewFontUsed?.(familyName);

            return; // success — stop trying other providers
          } catch {
            // This provider couldn't resolve it; try the next one
            continue;
          }
        }

        // All providers failed
        console.warn(
          `No font provider could resolve "${rawSearchTerm.trim()}"`,
        );
      } finally {
        setIsResolvingCustomFont(false);
      }
    }, [fontProviders, rawSearchTerm, isResolvingCustomFont, wrappedOnSelect]);

    const onKeyDown = useCallback<KeyboardEventHandler<HTMLDivElement>>(
      (event) => {
        const handled = fontPickerKeyHandler({
          event,
          inputRef,
          hoveredFont,
          filteredFonts,
          onSelect: wrappedOnSelect,
          onHover,
          onClose,
          onUseCustomFont: showUseCustomFont ? handleUseCustomFont : undefined,
        });

        if (handled) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      [
        hoveredFont,
        filteredFonts,
        wrappedOnSelect,
        onHover,
        onClose,
        showUseCustomFont,
        handleUseCustomFont,
      ],
    );

    useEffect(() => {
      onOpen();

      return () => {
        onClose();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Resolve and register custom fonts from providers when the picker opens,
    // so that font names render in their actual typeface in the picker list
    useEffect(() => {
      if (!fontProviders || Object.keys(fontProviders).length === 0) {
        return;
      }

      const customFamilies = Object.entries(fontProviders).flatMap(
        ([providerId, provider]) =>
          provider.availableFonts
            .map((f) => Fonts.createProviderFontFamily(providerId, f.value))
            .filter(
              (v): v is string =>
                typeof v === "string" && !Fonts.registered.has(v),
            ),
      );

      if (customFamilies.length === 0) {
        return;
      }

      // Resolve and register custom fonts, then add FontFace objects to document.fonts
      Promise.all(
        customFamilies.map(async (family) => {
          try {
            const parsed = Fonts.parseProviderFontFamily(family);
            if (!parsed) {
              return;
            }

            const provider = fontProviders[parsed.providerId];
            if (!provider) {
              return;
            }

            const definition = await provider.resolve(parsed.familyName);
            Fonts.registerCustomFont(
              family,
              { metrics: definition.metrics },
              ...definition.fontFaces,
            );
          } catch (e) {
            console.error(
              `Failed to resolve custom font "${family}" via font provider`,
              e,
            );
          }
        }),
      ).then(() => {
        // Add all registered font faces to document.fonts for CSS-driven lazy loading
        for (const { fontFaces, metadata } of Fonts.registered.values()) {
          if (metadata.local) {
            continue;
          }
          for (const { fontFace } of fontFaces) {
            if (!document.fonts.has(fontFace)) {
              document.fonts.add(fontFace);
            }
          }
        }
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fontProviders]);

    const sceneFilteredFonts = useMemo(
      () => filteredFonts.filter((font) => sceneFamilies.has(font.value)),
      [filteredFonts, sceneFamilies],
    );

    const availableFilteredFonts = useMemo(
      () => filteredFonts.filter((font) => !sceneFamilies.has(font.value)),
      [filteredFonts, sceneFamilies],
    );

    const FontPickerListItem = ({
      font,
      order,
    }: {
      font: FontDescriptor;
      order: number;
    }) => {
      const ref = useRef<HTMLButtonElement>(null);
      const isHovered = font.value === hoveredFont?.value;
      const isSelected = font.value === selectedFontFamily;

      useEffect(() => {
        if (!isHovered) {
          return;
        }
        if (order === 0) {
          // scroll into the first item differently, so it's visible what is above (i.e. group title)
          ref.current?.scrollIntoView?.({ block: "end" });
        } else {
          ref.current?.scrollIntoView?.({ block: "nearest" });
        }
      }, [isHovered, order]);

      return (
        <button
          ref={ref}
          type="button"
          value={font.value}
          className={getDropdownMenuItemClassName("", isSelected, isHovered)}
          title={font.text}
          // allow to tab between search and selected font
          tabIndex={isSelected ? 0 : -1}
          onClick={(e) => {
            const rawValue = e.currentTarget.value;
            const numValue = Number(rawValue);
            wrappedOnSelect(Number.isNaN(numValue) ? rawValue : numValue);
          }}
          onMouseMove={() => {
            if (hoveredFont?.value !== font.value) {
              onHover(font.value);
            }
          }}
        >
          <MenuItemContent
            icon={font.icon}
            badge={
              font.badge && (
                <DropDownMenuItemBadge type={font.badge.type}>
                  {font.badge.placeholder}
                </DropDownMenuItemBadge>
              )
            }
            textStyle={{
              fontFamily: getFontFamilyString({ fontFamily: font.value }),
            }}
          >
            {font.text}
          </MenuItemContent>
        </button>
      );
    };

    const groups = [];

    if (sceneFilteredFonts.length) {
      groups.push(
        <DropdownMenuGroup title={t("fontList.sceneFonts")} key="group_1">
          {sceneFilteredFonts.map((font, index) => (
            <FontPickerListItem key={font.value} font={font} order={index} />
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
            />
          ))}
        </DropdownMenuGroup>,
      );
    }

    if (showUseCustomFont) {
      const firstProviderIcon = fontProviders
        ? Object.values(fontProviders)[0]?.icon
        : undefined;

      groups.push(
        <DropdownMenuGroup key="group_custom">
          <button
            type="button"
            className={getDropdownMenuItemClassName("", false, false)}
            title={rawSearchTerm.trim()}
            tabIndex={-1}
            disabled={isResolvingCustomFont}
            onClick={handleUseCustomFont}
          >
            <MenuItemContent icon={firstProviderIcon ?? searchIcon}>
              {isResolvingCustomFont
                ? `${rawSearchTerm.trim()}...`
                : rawSearchTerm.trim()}
            </MenuItemContent>
          </button>
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
        onPointerLeave={onLeave}
        onKeyDown={onKeyDown}
        preventAutoFocusOnTouch={!!app.state.editingTextElement}
      >
        {stylesPanelMode === "full" && (
          <QuickSearch
            ref={inputRef}
            placeholder={t("quickSearch.placeholder")}
            onChange={debounce(setRawSearchTerm, 20)}
          />
        )}
        <ScrollableList
          className="dropdown-menu fonts manual-hover"
          placeholder={t("fontList.empty")}
        >
          {groups.length ? groups : null}
        </ScrollableList>
      </PropertiesPopover>
    );
  },
  (prev, next) =>
    prev.selectedFontFamily === next.selectedFontFamily &&
    prev.hoveredFontFamily === next.hoveredFontFamily,
);
