import { EDITOR_LS_KEYS } from "@excalidraw/common";
import { MATH_SYMBOLS, type MathSymbol } from "../../data/mathSymbols";
import { EditorLocalStorage } from "../../data/EditorLocalStorage";

export const getExactMathSymbol = (query: string): MathSymbol | undefined => {
  const qLower = query.toLowerCase();
  return (
    MATH_SYMBOLS.find((s) => s.name === query) ||
    MATH_SYMBOLS.find((s) => s.latex === `\\${query}`) ||
    MATH_SYMBOLS.find((s) => s.name.toLowerCase() === qLower) ||
    MATH_SYMBOLS.find(
      (s) => s.latex && s.latex.toLowerCase() === `\\${qLower}`,
    )
  );
};

export const findMathSymbolMatches = (query: string, maxResults = 5): MathSymbol[] => {
  if (!query) {
    return [];
  }
  const qLower = query.toLowerCase();

  const exact: MathSymbol[] = [];
  const startsWith: MathSymbol[] = [];
  const contains: MathSymbol[] = [];

  for (const s of MATH_SYMBOLS) {
    const sNameLower = s.name.toLowerCase();
    const sLatexLower = s.latex?.toLowerCase().replace(/^\\/, "");

    if (s.name === query || s.latex === `\\${query}`) {
      exact.push(s);
    } else if (sNameLower === qLower || sLatexLower === qLower) {
      exact.push(s);
    } else if (sNameLower.startsWith(qLower) || (sLatexLower && sLatexLower.startsWith(qLower))) {
      startsWith.push(s);
    } else if (
      sNameLower.includes(qLower) ||
      (sLatexLower && sLatexLower.includes(qLower)) ||
      (s.keywords && s.keywords.some((k) => k.toLowerCase().includes(qLower)))
    ) {
      contains.push(s);
    }
  }

  const combined = [...exact, ...startsWith, ...contains];
  const seen = new Set<string>();
  const unique: MathSymbol[] = [];
  for (const s of combined) {
    if (!seen.has(s.char)) {
      seen.add(s.char);
      unique.push(s);
      if (unique.length >= maxResults) {
        break;
      }
    }
  }
  return unique;
};

const updateMathTopPicks = (symbolChar: string) => {
  try {
    const saved = EditorLocalStorage.get<string[]>(
      EDITOR_LS_KEYS.MATH_TOP_PICKS as any,
    );
    const prev = Array.isArray(saved) ? saved : [];
    const updated = [symbolChar, ...prev.filter((s) => s !== symbolChar)].slice(
      0,
      3,
    );
    EditorLocalStorage.set(EDITOR_LS_KEYS.MATH_TOP_PICKS as any, updated);
  } catch (err) {
    // Ignore storage errors
  }
};

export class MathAutocomplete {
  private editable: HTMLTextAreaElement;
  private ownerDocument: Document;
  private ownerWindow: Window;
  private tooltipEl: HTMLDivElement | null = null;
  private matches: MathSymbol[] = [];
  private selectedIndex: number = 0;
  private activeQuery: string = "";
  private activeTriggerPos: number = -1;

  constructor(editable: HTMLTextAreaElement, ownerDocument: Document) {
    this.editable = editable;
    this.ownerDocument = ownerDocument;
    this.ownerWindow = (ownerDocument.defaultView || window) as Window;
  }

  public handleInput(): void {
    const text = this.editable.value;
    const caret = this.editable.selectionStart;
    const textBeforeCaret = text.slice(0, caret);

    // 1. Check for word-completion on space/enter: e.g. "/alpha " or "\lambda "
    const spaceMatch = textBeforeCaret.match(
      /(?:^|[\s([{])([/\\])([a-zA-Z0-9_]+)(\s)$/,
    );
    if (spaceMatch) {
      const trigger = spaceMatch[1];
      const query = spaceMatch[2];
      const trailingSpace = spaceMatch[3];
      const exact = getExactMathSymbol(query);
      if (exact) {
        const replaceLen = trigger.length + query.length + trailingSpace.length;
        const replaceStart = caret - replaceLen;
        const before = text.slice(0, replaceStart);
        const after = text.slice(caret);

        this.editable.value = `${before}${exact.char}${trailingSpace}${after}`;
        const newCaret = replaceStart + exact.char.length + trailingSpace.length;
        this.editable.selectionStart = newCaret;
        this.editable.selectionEnd = newCaret;

        updateMathTopPicks(exact.char);
        this.hideTooltip();
        this.editable.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }
    }

    // 2. Check for active trigger prefix: e.g. "/alp" or "\lam"
    const queryMatch = textBeforeCaret.match(
      /(?:^|[\s([{])([/\\])([a-zA-Z0-9_]{1,15})$/,
    );
    if (queryMatch) {
      const trigger = queryMatch[1];
      const query = queryMatch[2];
      const matchIndex = queryMatch.index ?? 0;
      const leadingCharLen = queryMatch[0].length - trigger.length - query.length;
      this.activeTriggerPos = matchIndex + leadingCharLen;
      this.activeQuery = query;

      const matches = findMathSymbolMatches(query);
      if (matches.length > 0) {
        this.matches = matches;
        this.selectedIndex = 0;
        this.renderTooltip();
        return;
      }
    }

    this.hideTooltip();
  }

  public handleKeyDown(event: KeyboardEvent): boolean {
    if (!this.tooltipEl || this.matches.length === 0) {
      return false;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      this.selectedIndex = (this.selectedIndex + 1) % this.matches.length;
      this.updateTooltipHighlight();
      return true;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      this.selectedIndex =
        (this.selectedIndex - 1 + this.matches.length) % this.matches.length;
      this.updateTooltipHighlight();
      return true;
    }

    if (event.key === "Tab" || event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      this.applySelectedMatch();
      return true;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.hideTooltip();
      return true;
    }

    return false;
  }

  public applySelectedMatch(symbolIndex = this.selectedIndex): void {
    const symbol = this.matches[symbolIndex];
    if (!symbol || this.activeTriggerPos < 0) {
      this.hideTooltip();
      return;
    }

    const text = this.editable.value;
    const caret = this.editable.selectionStart;
    const before = text.slice(0, this.activeTriggerPos);
    const after = text.slice(caret);

    this.editable.value = `${before}${symbol.char}${after}`;
    const newCaret = this.activeTriggerPos + symbol.char.length;
    this.editable.selectionStart = newCaret;
    this.editable.selectionEnd = newCaret;

    updateMathTopPicks(symbol.char);
    this.hideTooltip();
    this.editable.dispatchEvent(new Event("input", { bubbles: true }));
    this.editable.focus();
  }

  private renderTooltip(): void {
    if (!this.tooltipEl) {
      this.tooltipEl = this.ownerDocument.createElement("div");
      this.tooltipEl.className = "excalidraw-math-autocomplete";
      this.tooltipEl.setAttribute(
        "style",
        `
        position: absolute;
        z-index: 10000;
        background: var(--island-bg-color, #ffffff);
        color: var(--text-primary-color, #1e1e1e);
        border: 1px solid var(--color-surface-lowest, #e0e0e0);
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
        padding: 4px;
        min-width: 140px;
        max-width: 220px;
        font-family: var(--ui-font, sans-serif);
        font-size: 13px;
        user-select: none;
        pointer-events: auto;
      `,
      );
      this.editable.parentElement?.appendChild(this.tooltipEl);
    }

    this.tooltipEl.innerHTML = "";
    this.matches.forEach((m, idx) => {
      const item = this.ownerDocument.createElement("div");
      item.className = "excalidraw-math-autocomplete-item";
      const isSelected = idx === this.selectedIndex;
      item.setAttribute(
        "style",
        `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 8px;
        border-radius: 6px;
        cursor: pointer;
        background: ${isSelected ? "var(--color-brand, #6965db)" : "transparent"};
        color: ${isSelected ? "#ffffff" : "var(--text-primary-color, #1e1e1e)"};
      `,
      );

      const charSpan = this.ownerDocument.createElement("span");
      charSpan.setAttribute(
        "style",
        "font-size: 16px; font-weight: bold; width: 22px; text-align: center;",
      );
      charSpan.textContent = m.char;

      const nameSpan = this.ownerDocument.createElement("span");
      nameSpan.setAttribute(
        "style",
        "flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;",
      );
      nameSpan.textContent = m.name;

      item.appendChild(charSpan);
      item.appendChild(nameSpan);

      item.onpointerdown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.applySelectedMatch(idx);
      };

      this.tooltipEl?.appendChild(item);
    });

    this.positionTooltip();
  }

  private updateTooltipHighlight(): void {
    if (!this.tooltipEl) {
      return;
    }
    const items = this.tooltipEl.children;
    for (let i = 0; i < items.length; i++) {
      const item = items[i] as HTMLElement;
      const isSelected = i === this.selectedIndex;
      item.style.background = isSelected
        ? "var(--color-brand, #6965db)"
        : "transparent";
      item.style.color = isSelected
        ? "#ffffff"
        : "var(--text-primary-color, #1e1e1e)";
    }
  }

  private positionTooltip(): void {
    if (!this.tooltipEl) {
      return;
    }
    const rect = this.editable.getBoundingClientRect();
    const parentRect =
      this.editable.parentElement?.getBoundingClientRect() || {
        top: 0,
        left: 0,
      };

    const top = rect.bottom - parentRect.top + 6;
    const left = rect.left - parentRect.left;

    this.tooltipEl.style.top = `${top}px`;
    this.tooltipEl.style.left = `${left}px`;
  }

  public hideTooltip(): void {
    if (this.tooltipEl) {
      this.tooltipEl.remove();
      this.tooltipEl = null;
    }
    this.matches = [];
    this.selectedIndex = 0;
    this.activeTriggerPos = -1;
    this.activeQuery = "";
  }

  public destroy(): void {
    this.hideTooltip();
  }
}
