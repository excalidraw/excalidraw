import { Popover } from "radix-ui";
import clsx from "clsx";
import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";

import { EDITOR_LS_KEYS, MOBILE_ACTION_BUTTON_BG } from "@excalidraw/common";

import {
  DEFAULT_MATH_TOP_PICKS,
  MATH_SYMBOLS,
  type MathSymbolCategory,
} from "../../data/mathSymbols";
import { EditorLocalStorage } from "../../data/EditorLocalStorage";
import { t } from "../../i18n";
import { useTextEditorFocus } from "../../hooks/useTextEditorFocus";
import { ButtonSeparator } from "../ButtonSeparator";
import { IconButton } from "../IconButton";
import { PropertiesPopover } from "../PropertiesPopover";
import { QuickSearch } from "../QuickSearch";
import { mathSymbolIcon } from "../icons";

import { insertMathSymbol } from "./insertMathSymbol";

import "./MathSymbolPicker.scss";

import type { AppClassProperties, AppState, UIAppState } from "../../types";

interface MathSymbolPickerProps {
  app: AppClassProperties;
  appState: UIAppState;
  setAppState: React.Component<any, AppState>["setState"];
  container?: HTMLDivElement | null;
  compactMode?: boolean;
}

type CategoryFilter = "all" | MathSymbolCategory;

const CATEGORIES: readonly { id: CategoryFilter; labelKey: string }[] = [
  { id: "all", labelKey: "labels.mathCategory_all" },
  { id: "greek", labelKey: "labels.mathCategory_greek" },
  { id: "operators", labelKey: "labels.mathCategory_operators" },
  { id: "relations", labelKey: "labels.mathCategory_relations" },
  { id: "sets_logic", labelKey: "labels.mathCategory_sets_logic" },
  { id: "sub_super", labelKey: "labels.mathCategory_sub_super" },
  { id: "arrows_misc", labelKey: "labels.mathCategory_arrows_misc" },
];

export const MathSymbolPicker = React.memo(
  ({
    app,
    appState,
    setAppState,
    container = null,
    compactMode = false,
  }: MathSymbolPickerProps) => {
    const [topPicks, setTopPicks] = useState<string[]>(() => {
      const saved = EditorLocalStorage.get<string[]>(
        EDITOR_LS_KEYS.MATH_TOP_PICKS as any,
      );
      if (Array.isArray(saved) && saved.length > 0) {
        return saved.slice(0, 3);
      }
      return DEFAULT_MATH_TOP_PICKS;
    });

    const [selectedCategory, setSelectedCategory] =
      useState<CategoryFilter>("all");
    const [searchTerm, setSearchTerm] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);

    const { saveCaretPosition, restoreCaretPosition } = useTextEditorFocus(
      container?.ownerDocument ?? app.ownerDocument,
    );

    const isOpen = appState.openPopup === "mathSymbols";

    useEffect(() => {
      if (isOpen) {
        // Focus search on popup open
        const timer = app.ownerWindow.setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
        return () => app.ownerWindow.clearTimeout(timer);
      }
      // Reset search filter on close
      setSearchTerm("");
      setSelectedCategory("all");
    }, [isOpen, app.ownerWindow]);

    const handleSelectSymbol = useCallback(
      (symbol: string) => {
        insertMathSymbol(symbol, app);
        setTopPicks((prev) => {
          const updated = [symbol, ...prev.filter((s) => s !== symbol)].slice(
            0,
            3,
          );
          EditorLocalStorage.set(
            EDITOR_LS_KEYS.MATH_TOP_PICKS as any,
            updated,
          );
          return updated;
        });
      },
      [app],
    );

    const filteredSymbols = useMemo(() => {
      let list = MATH_SYMBOLS;
      if (selectedCategory !== "all") {
        list = list.filter((s) => s.category === selectedCategory);
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        list = list.filter(
          (s) =>
            s.char.includes(term) ||
            s.name.toLowerCase().includes(term) ||
            (s.latex && s.latex.toLowerCase().includes(term)) ||
            (s.keywords &&
              s.keywords.some((k) => k.toLowerCase().includes(term))),
        );
      }
      return list;
    }, [selectedCategory, searchTerm]);

    const compactStyle = compactMode
      ? {
          ...MOBILE_ACTION_BUTTON_BG,
          width: "2rem",
          height: "2rem",
        }
      : {};

    return (
      <div
        role="region"
        aria-label={t("labels.mathSymbols")}
        className={clsx("MathSymbolPicker__container", {
          "MathSymbolPicker__container--compact": compactMode,
        })}
      >
        {!compactMode && (
          <div className="buttonList MathSymbolPicker__top-picks">
            {topPicks.map((symbol) => (
              <button
                key={symbol}
                type="button"
                className="buttonList__button MathSymbolPicker__button"
                title={symbol}
                aria-label={symbol}
                onPointerDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => handleSelectSymbol(symbol)}
                data-testid={`math-symbol-top-pick-${symbol}`}
              >
                {symbol}
              </button>
            ))}
          </div>
        )}

        {!compactMode && <ButtonSeparator />}

        <Popover.Root
          open={isOpen}
          onOpenChange={(open) => {
            if (open) {
              if (appState.editingTextElement) {
                saveCaretPosition();
              }
              setAppState({ openPopup: "mathSymbols" });
            } else {
              setAppState({ openPopup: null });
              if (appState.editingTextElement) {
                restoreCaretPosition();
              }
            }
          }}
        >
          <Popover.Trigger asChild>
            <div data-openpopup="mathSymbols" className="properties-trigger">
              <IconButton
                type="toggle"
                icon={mathSymbolIcon}
                title={t("labels.moreSymbols")}
                aria-label={t("labels.moreSymbols")}
                className="standalone properties-trigger"
                data-testid="math-symbols-trigger"
                checked={isOpen}
                onPointerDown={(e) => {
                  e.preventDefault();
                }}
                onSelect={() => {
                  setAppState((state) => {
                    const willOpen = state.openPopup !== "mathSymbols";
                    if (willOpen && state.editingTextElement) {
                      saveCaretPosition();
                    }
                    return {
                      openPopup: willOpen ? "mathSymbols" : null,
                    };
                  });
                }}
                style={{
                  border: "none",
                  ...compactStyle,
                }}
              />
            </div>
          </Popover.Trigger>

          {isOpen && (
            <PropertiesPopover
              container={container}
              onClose={() => {
                setAppState({ openPopup: null });
                if (appState.editingTextElement) {
                  restoreCaretPosition();
                }
              }}
              preventAutoFocusOnTouch={!!appState.editingTextElement}
            >
              <div
                className="MathSymbolPicker__popover"
                onPointerDown={(e) => {
                  // Keep focus from being stolen away from search input or textarea
                  e.stopPropagation();
                }}
              >
                <QuickSearch
                  ref={searchInputRef}
                  placeholder={t("labels.searchMathSymbols")}
                  onChange={setSearchTerm}
                />

                <div className="MathSymbolPicker__categories">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={clsx("MathSymbolPicker__category-tab", {
                        active: selectedCategory === cat.id,
                      })}
                      onClick={() => setSelectedCategory(cat.id)}
                    >
                      {t(cat.labelKey as any)}
                    </button>
                  ))}
                </div>

                <div className="MathSymbolPicker__grid">
                  {filteredSymbols.map((symbol) => (
                    <button
                      key={symbol.char + symbol.name}
                      type="button"
                      className="MathSymbolPicker__grid-item"
                      title={`${symbol.char} (${symbol.name}${
                        symbol.latex ? `, ${symbol.latex}` : ""
                      })`}
                      aria-label={symbol.name}
                      onPointerDown={(e) => {
                        e.preventDefault();
                      }}
                      onClick={() => handleSelectSymbol(symbol.char)}
                      data-testid={`math-symbol-item-${symbol.char}`}
                    >
                      {symbol.char}
                    </button>
                  ))}
                  {filteredSymbols.length === 0 && (
                    <div className="MathSymbolPicker__empty">
                      No matching symbols found
                    </div>
                  )}
                </div>
              </div>
            </PropertiesPopover>
          )}
        </Popover.Root>
      </div>
    );
  },
);
