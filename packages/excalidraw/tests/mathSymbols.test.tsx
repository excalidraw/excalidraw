import { Excalidraw } from "../index";
import { filterMathSymbols } from "../components/MathSymbolsDialog/mathSymbols";

import { API } from "./helpers/api";
import { fireEvent, queryByTestId, render, waitFor } from "./test-utils";

const { h } = window;

const getDialog = () => document.querySelector(".MathSymbolsDialog")!;

const getExpressionInput = () =>
  getDialog().querySelector<HTMLInputElement>(
    ".MathSymbolsDialog__expression input",
  )!;

const clickSymbol = (symbol: string) =>
  fireEvent.click(
    queryByTestId(getDialog() as HTMLElement, `math-symbol-${symbol}`)!,
  );

describe("filterMathSymbols", () => {
  it("matches by keyword, case-insensitively", () => {
    const symbols = filterMathSymbols("EPSILON").flatMap((category) =>
      category.symbols.map(({ symbol }) => symbol),
    );
    expect(symbols).toEqual(["ε"]);
  });

  it("matches greek letters of both cases", () => {
    const symbols = filterMathSymbols("sigma").flatMap((category) =>
      category.symbols.map(({ symbol }) => symbol),
    );
    expect(symbols).toEqual(["σ", "Σ", "∑"]);
  });

  it("matches the symbol itself", () => {
    const symbols = filterMathSymbols("Σ").flatMap((category) =>
      category.symbols.map(({ symbol }) => symbol),
    );
    expect(symbols).toEqual(["Σ"]);
  });

  it("drops categories left empty", () => {
    expect(filterMathSymbols("zzz")).toEqual([]);
  });
});

describe("<MathSymbolsDialog/>", () => {
  beforeEach(async () => {
    await render(
      <Excalidraw
        initialData={{ appState: { openDialog: { name: "mathSymbols" } } }}
      />,
    );
  });

  it("composes symbols with typed text and inserts it as a text element", async () => {
    const input = getExpressionInput();

    clickSymbol("∀");
    clickSymbol("ε");
    fireEvent.change(input, { target: { value: `${input.value} > 0` } });
    expect(input.value).toBe("∀ε > 0");

    // goes in at the caret
    input.setSelectionRange(1, 1);
    clickSymbol("∞");
    expect(input.value).toBe("∀∞ε > 0");

    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(h.state.openDialog).toBe(null));
    expect(h.elements).toHaveLength(1);
    const [element] = h.elements;
    expect(element.type).toBe("text");
    expect(API.getSelectedElements()).toEqual([element]);
    expect(element).toMatchObject({
      text: "∀∞ε > 0",
      fontSize: h.state.currentItemFontSize,
      fontFamily: h.state.currentItemFontFamily,
      strokeColor: h.state.currentItemStrokeColor,
    });
  });

  it("filters symbols by search", () => {
    const search =
      getDialog().querySelector<HTMLInputElement>("input[type=search]")!;
    fireEvent.change(search, { target: { value: "lambda" } });

    const symbols = [
      ...getDialog().querySelectorAll(".MathSymbolsDialog__symbol"),
    ].map((button) => button.textContent);
    expect(symbols).toEqual(["λ", "Λ"]);
  });

  it("doesn't insert an empty expression", () => {
    fireEvent.keyDown(getExpressionInput(), { key: "Enter" });
    expect(h.elements).toHaveLength(0);
    expect(h.state.openDialog).toEqual({ name: "mathSymbols" });
  });
});
