declare module "mathjax-full/js/input/asciimath/mathjax2/legacy/MathJax";

declare module SREfeature {
  function custom(locale: string): Promise<string>;
  export = custom;
}
