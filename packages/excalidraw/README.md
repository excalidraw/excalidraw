# Excalidraw

**Excalidraw** is exported as a React component that you can embed directly in your app.

## Installation

Install the package together with its React peer dependencies.

```bash
npm install react react-dom @excalidraw/excalidraw
# or
yarn add react react-dom @excalidraw/excalidraw
```

> **Note**: If you want to try unreleased changes, use `@excalidraw/excalidraw@next`.

## Quick start

The minimum working setup has two easy-to-miss requirements:

1. Import the package CSS:

```ts
import "@excalidraw/excalidraw/index.css";
```

2. Render Excalidraw inside a container with a non-zero height.

```tsx
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

export default function App() {
  return (
    <div style={{ height: "100vh" }}>
      <Excalidraw />
    </div>
  );
}
```

Excalidraw fills `100%` of the width and height of its parent. If the parent has no height, the canvas will not be visible.

## Next.js / SSR frameworks

Excalidraw should be rendered on the client. In SSR frameworks such as Next.js, use a client component and load it dynamically with SSR disabled.

```tsx
// app/components/ExcalidrawClient.tsx
"use client";

import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

export default function ExcalidrawClient() {
  return (
    <div style={{ height: "100vh" }}>
      <Excalidraw />
    </div>
  );
}
```

```tsx
// app/page.tsx
import dynamic from "next/dynamic";

const ExcalidrawClient = dynamic(
  () => import("./components/ExcalidrawClient"),
  { ssr: false },
);

export default function Page() {
  return <ExcalidrawClient />;
}
```

See the local examples for complete setups:

- [examples/with-nextjs](https://github.com/excalidraw/excalidraw/tree/master/examples/with-nextjs)
- [examples/with-script-in-browser](https://github.com/excalidraw/excalidraw/tree/master/examples/with-script-in-browser)

## LLM / agent tips

If an LLM or coding agent is setting up Excalidraw, these shortcuts usually save more time than re-prompting:

- Start with a plain `<Excalidraw />` in a `100vh` container. Add refs, `initialData`, persistence, or custom UI only after the base embed works.
- If the canvas is blank, check the CSS import and parent height first. Those are the two most common integration failures.
- In Next.js or other SSR frameworks, assume client-only rendering first. Use `"use client"` and `dynamic(..., { ssr: false })` before debugging hydration or `window is not defined` errors.
- If imports or entrypoints are unclear, inspect `node_modules/@excalidraw/excalidraw/package.json`. The installed package exports are the source of truth.
- Do not set `window.EXCALIDRAW_ASSET_PATH` unless you are intentionally self-hosting fonts/assets.
- When docs and generated code drift, copy the nearest working example from this repo, especially `examples/with-nextjs` or `examples/with-script-in-browser`.

## Migrating to `@excalidraw/excalidraw@0.18.x`

Version `0.18.x` removes the old `types/`-prefixed deep import paths. If you were importing types from `@excalidraw/excalidraw/types/...`, switch to the new type-only subpaths below.

| Old path | New path |
| --- | --- |
| `@excalidraw/excalidraw/types/data/transform.js` | `@excalidraw/excalidraw/element/transform` |
| `@excalidraw/excalidraw/types/data/types.js` | `@excalidraw/excalidraw/data/types` |
| `@excalidraw/excalidraw/types/element/types.js` | `@excalidraw/excalidraw/element/types` |
| `@excalidraw/excalidraw/types/utility-types.js` | `@excalidraw/excalidraw/common/utility-types` |
| `@excalidraw/excalidraw/types/types.js` | `@excalidraw/excalidraw/types` |

Drop the `.js` extension. The new package `exports` map resolves these paths without it.

These deep subpaths are for `import type` only. Runtime imports should come from the package root, plus `@excalidraw/excalidraw/index.css` for styles.

For example:

```ts
import { exportToSvg } from "@excalidraw/excalidraw";
```

## Breaking Changes

### Iframe validation (v0.19+)

Starting from this version, all `<iframe>` elements on the canvas are **blocked by default** unless the host explicitly opts in via the `validateIframe` prop. This is a secure-by-default change to prevent phishing attacks where a malicious collaborator could embed arbitrary iframes.

**What changed:**

- If `validateIframe` is not set (or set to `undefined`), all iframe elements are blocked and will not render.
- If `validateIframe` is `true`, all iframes are allowed.
- If `validateIframe` is a function, it receives the iframe element and returns `true` (allow) or `false` (block).

**Why this matters:**

The built-in AI text-to-diagram (TTD) feature generates iframe elements as output. Without `validateIframe: true` from the host, TTD-generated iframes will be silently blocked. If you use TTD, add `validateIframe={true}` to your `<Excalidraw>` component.

**Migration:**

```tsx
// Before (iframes silently blocked)
<Excalidraw />

// After — explicitly allow iframes
<Excalidraw validateIframe={true} />
```

If you want finer control, pass a validation function:

```tsx
<Excalidraw
  validateIframe={(element) => {
    // Only allow iframes whose HTML content references trusted origins
    const html = element.customData?.generationData?.html || "";
    return html.includes("trusted-domain.com");
  }}
/>
```

A console warning will appear if iframes are present but `validateIframe` is not set.

## Self-hosting fonts

By default, Excalidraw downloads the fonts it needs from the [CDN](https://esm.run/@excalidraw/excalidraw/dist/prod).

For self-hosting, copy the contents of `node_modules/@excalidraw/excalidraw/dist/prod/fonts` into the path where your app serves static assets, for example `public/`. Then set `window.EXCALIDRAW_ASSET_PATH` to that same path:

```html
<script>
  window.EXCALIDRAW_ASSET_PATH = "/";
</script>
```

## Demo

Try the [CodeSandbox example](https://codesandbox.io/p/sandbox/github/excalidraw/excalidraw/tree/master/examples/with-script-in-browser).

## Integration

Read the [integration docs](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/integration).

## API

Read the [API docs](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api).

## Contributing

Read the [contributing docs](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/contributing).
