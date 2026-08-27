import { FONT_FAMILY } from "@excalidraw/common";

import {
  ensureMathTextProviderLoaded,
  getMathTextSource,
  getRenderableMathText,
  measureTextContent,
  setMathTextEditingElementId,
  setMathTextProvider,
  type MathTextProvider,
} from "../mathText";

const createFakeProvider = (
  opts: { loaded?: boolean; throwOn?: string } = {},
): MathTextProvider & { loadCalls: number } => {
  let loaded = opts.loaded ?? true;
  const provider = {
    loadCalls: 0,
    isLoaded: () => loaded,
    load: async () => {
      provider.loadCalls++;
      // async, like a dynamic import would be
      await Promise.resolve();
      loaded = true;
    },
    render: (source: string, display: boolean) => {
      if (!loaded) {
        return null;
      }
      if (opts.throwOn && source === opts.throwOn) {
        throw new Error("TeX error");
      }
      // 1000 viewBox units === 1em → width = source.length/2 em, height 1em
      const viewBoxWidth = source.length * 500;
      const viewBoxHeight = display ? 1500 : 1000;
      return {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -700 ${viewBoxWidth} ${viewBoxHeight}"><g fill="currentColor"><path d="M0 0h1v1h-1z"/></g></svg>`,
        viewBoxWidth,
        viewBoxHeight,
      };
    },
  };
  return provider;
};

const textProps = {
  fontSize: 20,
  fontFamily: FONT_FAMILY.Excalifont,
  lineHeight: 1.25 as any,
};

describe("mathText", () => {
  afterEach(() => {
    setMathTextProvider(null);
    setMathTextEditingElementId(null);
  });

  describe("getMathTextSource", () => {
    it("detects inline math", () => {
      expect(getMathTextSource("$x^2$")).toEqual({
        source: "x^2",
        display: false,
      });
      expect(getMathTextSource("  $\\frac{a}{b}$\n")).toEqual({
        source: "\\frac{a}{b}",
        display: false,
      });
      expect(getMathTextSource("$x$")).toEqual({ source: "x", display: false });
    });

    it("detects display math (incl. multi-line)", () => {
      expect(getMathTextSource("$$\\frac{a}{b}$$")).toEqual({
        source: "\\frac{a}{b}",
        display: true,
      });
      expect(getMathTextSource("$$\n  a \\\\\n  b\n$$")).toEqual({
        source: "a \\\\\n  b",
        display: true,
      });
    });

    it("ignores non-math text", () => {
      expect(getMathTextSource("")).toBe(null);
      expect(getMathTextSource("hello")).toBe(null);
      expect(getMathTextSource("$")).toBe(null);
      expect(getMathTextSource("$$")).toBe(null);
      expect(getMathTextSource("$$$$")).toBe(null);
      expect(getMathTextSource("$ $")).toBe(null);
      expect(getMathTextSource("$$  $$")).toBe(null);
      expect(getMathTextSource("$5")).toBe(null);
      expect(getMathTextSource("$5 and $6")).toBe(null);
      expect(getMathTextSource("$ 5 $")).toBe(null);
      expect(getMathTextSource("a $x$ b")).toBe(null);
      expect(getMathTextSource("\\$5")).toBe(null);
      // inline math can't span lines
      expect(getMathTextSource("$a\nb$")).toBe(null);
    });
  });

  describe("measureTextContent", () => {
    it("measures as plain text when no provider is registered", () => {
      const math = measureTextContent("$x^2$", textProps);
      const plain = measureTextContent("$x^2$", textProps);
      expect(math.isMath).toBe(false);
      expect(math).toEqual(plain);
    });

    it("measures math with the provider (1000 viewBox units = 1em)", () => {
      setMathTextProvider(createFakeProvider());
      const metrics = measureTextContent("$x^2$", textProps);
      expect(metrics).toEqual({
        // "x^2" → 3 chars × 500 / 1000 × 20px
        width: 30,
        height: 20,
        isMath: true,
      });
      expect(measureTextContent("$$x^2$$", textProps)).toEqual({
        width: 30,
        height: 30,
        isMath: true,
      });
      // plain text is unaffected
      expect(measureTextContent("x^2", textProps).isMath).toBe(false);
    });

    it("falls back to plain text while the provider is loading", async () => {
      const provider = createFakeProvider({ loaded: false });
      setMathTextProvider(provider);

      const metrics = measureTextContent("$x^2$", textProps);
      expect(metrics.isMath).toBe(false);
      // measuring kicked off the (single) load
      expect(provider.loadCalls).toBe(1);
      measureTextContent("$x^2$", textProps);
      expect(provider.loadCalls).toBe(1);

      await ensureMathTextProviderLoaded();
      expect(measureTextContent("$x^2$", textProps).isMath).toBe(true);
    });

    it("falls back to plain text on TeX errors", () => {
      setMathTextProvider(createFakeProvider({ throwOn: "\\frac{" }));
      expect(measureTextContent("$\\frac{$", textProps).isMath).toBe(false);
      expect(getRenderableMathText("$\\frac{$")).toBe(null);
      expect(measureTextContent("$x$", textProps).isMath).toBe(true);
    });

    it("measures the element being edited as plain text", () => {
      setMathTextProvider(createFakeProvider());
      setMathTextEditingElementId("el1");

      expect(
        measureTextContent("$x^2$", { id: "el1", ...textProps }).isMath,
      ).toBe(false);
      expect(
        measureTextContent("$x^2$", { id: "el2", ...textProps }).isMath,
      ).toBe(true);

      setMathTextEditingElementId(null);
      expect(
        measureTextContent("$x^2$", { id: "el1", ...textProps }).isMath,
      ).toBe(true);
    });
  });
});
