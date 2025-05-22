# @excalidraw/math - 2D Vector Graphics Math Library

The package contains a collection of (mostly) independent functions providing the mathematical basis for Excalidraw's rendering, hit detection, bounds checking and anything using math underneath.

The philosophy of the library is to be self-contained and therefore there is no dependency on any other package. It only contains pure functions. It also prefers analytical solutions vs numberical wherever possible. Since this library is used in a high performance context, we might chose to use a numerical approximation, even if an analytical solution is available to preserve performance.

## Install

```bash
npm install @excalidraw/math
```

If you prefer Yarn over npm, use this command to install the Excalidraw utils package:

```bash
yarn add @excalidraw/math
```

With PNPM, similarly install the package with this command:

```bash
pnpm add @excalidraw/math
```
