import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { KEYS } from "@excalidraw/common";
import { newTextElement } from "@excalidraw/element";

import { t } from "../../i18n";
import { useApp } from "../App";
import { Dialog } from "../Dialog";
import { FilledButton } from "../FilledButton";
import { TextField } from "../TextField";
import { searchIcon } from "../icons";

import { filterMathSymbols } from "./mathSymbols";

import "./MathSymbolsDialog.scss";

/**
 * A palette of math symbols (greek letters, operators, relations, …) to
 * compose an expression from — symbols go in at the caret, and can be typed
 * around — inserted on the canvas as a text element in the current text
 * styles.
 */
export const MathSymbolsDialog = ({ onClose }: { onClose: () => void }) => {
  const app = useApp();
  const [query, setQuery] = useState("");
  const [expression, setExpression] = useState("");
  const expressionInputRef = useRef<HTMLInputElement | null>(null);
  // where the caret goes once the expression, with a symbol added, renders
  const pendingCaretRef = useRef<number | null>(null);

  const categories = useMemo(() => filterMathSymbols(query), [query]);

  useLayoutEffect(() => {
    const caret = pendingCaretRef.current;
    if (caret !== null) {
      pendingCaretRef.current = null;
      expressionInputRef.current?.setSelectionRange(caret, caret);
    }
  }, [expression]);

  const addSymbol = (symbol: string) => {
    const input = expressionInputRef.current;
    const start = input?.selectionStart ?? expression.length;
    const end = input?.selectionEnd ?? expression.length;
    pendingCaretRef.current = start + symbol.length;
    setExpression(expression.slice(0, start) + symbol + expression.slice(end));
  };

  const insertExpression = () => {
    const text = expression.trim();
    if (!text) {
      return;
    }
    const { state } = app;
    const element = newTextElement({
      text,
      x: 0,
      y: 0,
      strokeColor: state.currentItemStrokeColor,
      backgroundColor: state.currentItemBackgroundColor,
      fillStyle: state.currentItemFillStyle,
      strokeStyle: state.currentItemStrokeStyle,
      roughness: state.currentItemRoughness,
      opacity: state.currentItemOpacity,
      roundness: null,
      fontSize: state.currentItemFontSize,
      fontFamily: state.currentItemFontFamily,
      textAlign: state.currentItemTextAlign,
    });
    app.addElementsFromPasteOrLibrary({
      elements: [element],
      files: null,
      position: "center",
    });
    onClose();
  };

  return (
    <Dialog
      size="small"
      className="MathSymbolsDialog"
      onCloseRequest={onClose}
      title={t("mathSymbols.title")}
    >
      <TextField
        type="search"
        icon={searchIcon}
        value={query}
        onChange={setQuery}
        placeholder={t("mathSymbols.searchPlaceholder")}
        fullWidth
      />
      <div className="MathSymbolsDialog__categories">
        {categories.length === 0 && (
          <div className="MathSymbolsDialog__empty">
            {t("mathSymbols.noResults")}
          </div>
        )}
        {categories.map((category) => (
          <section key={category.id} className="MathSymbolsDialog__category">
            <h3 className="MathSymbolsDialog__category-title">
              {t(`mathSymbols.categories.${category.id}`)}
            </h3>
            <div className="MathSymbolsDialog__grid">
              {category.symbols.map(({ symbol, keywords }) => (
                <button
                  key={symbol}
                  type="button"
                  className="MathSymbolsDialog__symbol"
                  title={`${symbol} ${keywords.split(" ")[0]}`}
                  aria-label={keywords}
                  data-testid={`math-symbol-${symbol}`}
                  // keep the caret where it is in the expression input
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => addSymbol(symbol)}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="MathSymbolsDialog__footer">
        <TextField
          ref={expressionInputRef}
          className="MathSymbolsDialog__expression"
          label={t("mathSymbols.expression")}
          value={expression}
          onChange={setExpression}
          onKeyDown={(event) => {
            if (event.key === KEYS.ENTER) {
              event.preventDefault();
              insertExpression();
            }
          }}
          placeholder={t("mathSymbols.expressionPlaceholder")}
          fullWidth
        />
        <FilledButton
          size="large"
          label={t("mathSymbols.insert")}
          onClick={insertExpression}
          disabled={!expression.trim()}
        />
      </div>
    </Dialog>
  );
};
