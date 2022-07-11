# Changelog

<!--
Guidelines for changelog:
The change should be grouped under one of the following sections and must contain a PR link.
- Features: For new features.
- Fixes: For bug fixes.
- Chore: Changes for non src files example package.json.
- Refactor: For any refactoring.

Please add the latest change at the top under the correct section.
-->

## Unreleased

### Excalidraw Plugins

#### Features

- Render math notation using the MathJax library. Both standard Latex input and simplified AsciiMath input are supported. MathJax support is implemented as a `math` subtype of `ExcalidrawTextElement`.

  Also added plugin-like subtypes for `ExcalidrawElement`. These allow easily supporting custom extensions of `ExcalidrawElement`s such as for MathJax, Markdown, or inline code. [#5311](https://github.com/excalidraw/excalidraw/pull/5311).

- Provided a stub example plugin (`./empty/index.ts`).
