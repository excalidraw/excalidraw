import { THEME, applyDarkModeFilter, isTestEnv } from "@excalidraw/common";

import {
  ensureMathTextProviderLoaded,
  getMathTextProvider,
  isMathTextElement,
  prerenderMathTextImages,
  setMathTextProvider,
} from "@excalidraw/element";

import type {
  MathTextProvider,
  MathTextRenderResult,
} from "@excalidraw/element";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { AppState } from "../types";

/**
 * MathJax (v3, TeX input → SVG output) implementation of the
 * `MathTextProvider` used to typeset `$…$` / `$$…$$` text elements.
 *
 * MathJax is loaded lazily (dynamic imports, split into its own chunk) the
 * first time a math text element needs to be measured or rendered.
 */

/**
 * Explicit (safe) list of TeX packages. Notably NOT included: `html`
 * (`\href`, `\class`, `\style`, `\cssId`), `unicode`, `require`, `action`.
 */
const TEX_PACKAGES = [
  "base",
  "ams",
  "amscd",
  "boldsymbol",
  "braket",
  "cancel",
  "cases",
  "color",
  "mathtools",
  "mhchem",
  "newcommand",
  "noundefined",
  "physics",
  "textmacros",
  "upgreek",
];

/**
 * em size passed to MathJax. The SVG output is em-relative (1000 viewBox
 * units === 1em) so this only matters for the rare px-based lengths.
 */
const CANONICAL_EM = 100;
// x-height of the MathJax TeX font, relative to the em size
const TEX_X_HEIGHT = 0.442;

type MathJaxRuntime = {
  convert: (source: string, display: boolean) => string;
};

let runtime: MathJaxRuntime | null = null;
let loading: Promise<void> | null = null;

const loadMathJax = async (): Promise<void> => {
  const [
    mathjaxModule,
    texModule,
    svgModule,
    liteAdaptorModule,
    htmlHandlerModule,
  ] = await Promise.all([
    import("mathjax-full/js/mathjax.js"),
    import("mathjax-full/js/input/tex.js"),
    import("mathjax-full/js/output/svg.js"),
    import("mathjax-full/js/adaptors/liteAdaptor.js"),
    import("mathjax-full/js/handlers/html.js"),
    // TeX packages register themselves when imported
    import("mathjax-full/js/input/tex/base/BaseConfiguration.js"),
    import("mathjax-full/js/input/tex/ams/AmsConfiguration.js"),
    import("mathjax-full/js/input/tex/amscd/AmsCdConfiguration.js"),
    import("mathjax-full/js/input/tex/boldsymbol/BoldsymbolConfiguration.js"),
    import("mathjax-full/js/input/tex/braket/BraketConfiguration.js"),
    import("mathjax-full/js/input/tex/cancel/CancelConfiguration.js"),
    import("mathjax-full/js/input/tex/cases/CasesConfiguration.js"),
    import("mathjax-full/js/input/tex/color/ColorConfiguration.js"),
    import("mathjax-full/js/input/tex/mathtools/MathtoolsConfiguration.js"),
    import("mathjax-full/js/input/tex/mhchem/MhchemConfiguration.js"),
    import("mathjax-full/js/input/tex/newcommand/NewcommandConfiguration.js"),
    import("mathjax-full/js/input/tex/noundefined/NoUndefinedConfiguration.js"),
    import("mathjax-full/js/input/tex/physics/PhysicsConfiguration.js"),
    import("mathjax-full/js/input/tex/textmacros/TextMacrosConfiguration.js"),
    import("mathjax-full/js/input/tex/upgreek/UpgreekConfiguration.js"),
  ]);

  // mathjax-full ships CommonJS modules — be defensive about the interop shape
  const pick = <T>(module: any, name: string): T =>
    (module?.[name] ?? module?.default?.[name]) as T;

  const mathjax = pick<typeof mathjaxModule.mathjax>(mathjaxModule, "mathjax");
  const TeX = pick<typeof texModule.TeX>(texModule, "TeX");
  const SVG = pick<typeof svgModule.SVG>(svgModule, "SVG");
  const liteAdaptor = pick<typeof liteAdaptorModule.liteAdaptor>(
    liteAdaptorModule,
    "liteAdaptor",
  );
  const RegisterHTMLHandler = pick<
    typeof htmlHandlerModule.RegisterHTMLHandler
  >(htmlHandlerModule, "RegisterHTMLHandler");

  const adaptor = liteAdaptor();
  // registers on the global mathjax object — must happen exactly once, which
  // the module-level `loading` singleton guarantees
  RegisterHTMLHandler(adaptor);

  const tex = new TeX({
    packages: TEX_PACKAGES,
    // by default MathJax renders TeX errors as red `<merror>` nodes; we want
    // to fall back to rendering the raw source as plain text instead
    formatError: (_jax: unknown, error: Error) => {
      throw error;
    },
  });
  // `fontCache: "none"` inlines every glyph path → no `<defs>`/`<use>`/ids,
  // so several equations can be inlined into the same exported SVG document
  const svg = new SVG({ fontCache: "none" });
  const document = mathjax.document("", { InputJax: tex, OutputJax: svg });

  runtime = {
    convert: (source, display) => {
      const node = document.convert(source, {
        display,
        em: CANONICAL_EM,
        ex: CANONICAL_EM * TEX_X_HEIGHT,
        containerWidth: CANONICAL_EM * 80,
      });
      // `node` is the `<mjx-container>`; its content is the `<svg>`
      return adaptor.innerHTML(node);
    },
  };
};

const render = (
  source: string,
  display: boolean,
): MathTextRenderResult | null => {
  if (!runtime) {
    return null;
  }
  const svg = runtime.convert(source, display);
  const viewBox = /\bviewBox="([^"]+)"/.exec(svg);
  if (!viewBox) {
    throw new Error("MathJax: missing viewBox in SVG output");
  }
  const [, , viewBoxWidth, viewBoxHeight] = viewBox[1]
    .trim()
    .split(/\s+/)
    .map(Number);
  if (!(viewBoxWidth > 0 && viewBoxHeight > 0)) {
    throw new Error("MathJax: invalid viewBox in SVG output");
  }
  return { svg, viewBoxWidth, viewBoxHeight };
};

export const mathJaxMathTextProvider: MathTextProvider = {
  isLoaded: () => runtime !== null,
  load: () => {
    if (!loading) {
      loading = loadMathJax().catch((error) => {
        loading = null;
        throw error;
      });
    }
    return loading;
  },
  render,
};

/**
 * Registers the MathJax provider unless another provider is already
 * installed (e.g. a mock in tests). No-op in the test environment.
 */
export const registerMathJaxProvider = () => {
  if (isTestEnv()) {
    return;
  }
  if (!getMathTextProvider()) {
    setMathTextProvider(mathJaxMathTextProvider);
  }
};

/**
 * To be awaited before a synchronous render of `elements` (export): loads
 * MathJax if any of the elements is math, and optionally makes sure the
 * rasterized equation images are ready (canvas export).
 */
export const prerenderMathText = async (
  elements: readonly ExcalidrawElement[],
  opts: { theme: AppState["theme"]; images: boolean },
): Promise<void> => {
  if (!elements.some((element) => isMathTextElement(element))) {
    return;
  }
  registerMathJaxProvider();
  await ensureMathTextProviderLoaded();
  if (opts.images) {
    await prerenderMathTextImages(elements, (element) =>
      applyDarkModeFilter(element.strokeColor, opts.theme === THEME.DARK),
    );
  }
};
