// When building MathJax 4.0-beta from source within the Excalidraw tree, some
// import paths don't properly translate from `ts/` to `mjs/`. This makes the
// Excalidraw build process parse MathJax TypeScript files. The resulting error
// messages do not occur if MathJax was built from source outside the
// Excalidraw tree. The following regexp eliminates those error messages.
require("replace-in-file").sync({
  files: "node_modules/mathjax-full/mjs/**/*",
  from: /mathjax-full\/ts/g,
  to: "mathjax-full/mjs",
});
