import { KEYS } from "@excalidraw/common";

import { Excalidraw } from "../..";
import { Keyboard } from "../../tests/helpers/ui";
import { act, render } from "../../tests/test-utils";
import { DEFAULT_MATH_TOP_PICKS, MATH_SYMBOLS } from "../../data/mathSymbols";

describe("MathSymbolPicker", () => {
  it("should render math symbols and top picks when text tool is active", async () => {
    (global as any).ResizeObserver =
      (global as any).ResizeObserver ||
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      };

    const { queryByTestId } = await render(
      <Excalidraw handleKeyboardGlobally={true} />,
    );

    // Switch to Text tool
    Keyboard.keyPress(KEYS.T);

    // Verify trigger is present in the text properties panel
    const trigger = queryByTestId("math-symbols-trigger");
    expect(trigger).not.toBeNull();

    // Verify default top picks (e.g. π, ∑, √, α, ∞) are rendered
    for (const char of DEFAULT_MATH_TOP_PICKS) {
      const topPickBtn = queryByTestId(`math-symbol-top-pick-${char}`);
      expect(topPickBtn).not.toBeNull();
    }

    // Open math symbols popover
    act(() => {
      trigger!.click();
    });
  });

  it("should contain all essential math categories and search aliases", () => {
    const categories = new Set(MATH_SYMBOLS.map((s) => s.category));
    expect(categories.has("greek")).toBe(true);
    expect(categories.has("operators")).toBe(true);
    expect(categories.has("relations")).toBe(true);
    expect(categories.has("sets_logic")).toBe(true);
    expect(categories.has("sub_super")).toBe(true);
    expect(categories.has("arrows_misc")).toBe(true);

    // Check specific symbols exist
    const alpha = MATH_SYMBOLS.find((s) => s.char === "α");
    expect(alpha).toBeDefined();
    expect(alpha?.latex).toBe("\\alpha");

    const sum = MATH_SYMBOLS.find((s) => s.char === "∑");
    expect(sum).toBeDefined();
    expect(sum?.latex).toBe("\\sum");

    const inSet = MATH_SYMBOLS.find((s) => s.char === "∈");
    expect(inSet).toBeDefined();
    expect(inSet?.latex).toBe("\\in");

    const sup2 = MATH_SYMBOLS.find((s) => s.char === "²");
    expect(sup2).toBeDefined();
  });

  it("should find matches and exact symbol for autocomplete", async () => {
    const { findMathSymbolMatches, getExactMathSymbol } = await import(
      "./mathAutocomplete"
    );

    // Exact matches
    expect(getExactMathSymbol("alpha")?.char).toBe("α");
    expect(getExactMathSymbol("lambda")?.char).toBe("λ");
    expect(getExactMathSymbol("pi")?.char).toBe("π");
    expect(getExactMathSymbol("sum")?.char).toBe("∑");
    expect(getExactMathSymbol("infty")?.char).toBe("∞");

    expect(DEFAULT_MATH_TOP_PICKS.length).toBe(3);

    // Partial matches
    const alpMatches = findMathSymbolMatches("alp");
    expect(alpMatches.length).toBeLessThanOrEqual(5);
    expect(alpMatches.some((m) => m.char === "α")).toBe(true);

    const lamMatches = findMathSymbolMatches("lam");
    expect(lamMatches.length).toBeLessThanOrEqual(5);
    expect(lamMatches.some((m) => m.char === "λ")).toBe(true);
  });
});
