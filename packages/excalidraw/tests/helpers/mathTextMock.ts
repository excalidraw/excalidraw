import { setMathTextProvider } from "@excalidraw/element";

/**
 * Installs a deterministic, synchronous math text provider (so that `$…$`
 * text elements are laid out as math without loading MathJax):
 * width = source.length / 2 em, height = 1em (inline) / 1.5em (display).
 *
 * Reset with `setMathTextProvider(null)`.
 *
 * (kept out of `mocks.ts`, which is imported by `setupTests.ts` inside a
 * `vi.mock` factory and thus can't import `@excalidraw/element`)
 */
export const mockMathTextProvider = () => {
  setMathTextProvider({
    isLoaded: () => true,
    load: async () => {},
    render: (source: string, display: boolean) => {
      const viewBoxWidth = source.length * 500;
      const viewBoxHeight = display ? 1500 : 1000;
      return {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -700 ${viewBoxWidth} ${viewBoxHeight}"><g fill="currentColor" stroke="currentColor"><path d="M0 0h1v1h-1z"/></g></svg>`,
        viewBoxWidth,
        viewBoxHeight,
      };
    },
  });
};
