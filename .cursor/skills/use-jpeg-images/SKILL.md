---
name: use-jpeg-images
description: Prefer JPEG for raster images when creating, exporting, saving, or generating image assets. Use when adding image files, choosing export formats, setting mimeType, writing image tests/fixtures, or when the user mentions image format, screenshots, or assets.
---

# Use JPEG for Images

Please use jpeg for image formats.

## Default format

- **Extension**: `.jpeg` (`.jpg` is acceptable when matching existing files)
- **MIME type**: `image/jpeg`
- In this repo: `MIME_TYPES.jpg` from `@excalidraw/common` (`"image/jpeg"`)

## When to apply

| Task | Use JPEG |
|------|----------|
| New image assets in `examples/` or `excalidraw-app/` | Yes |
| Export / download defaults (when format is configurable) | Yes |
| `mimeType` on embedded or pasted images | `image/jpeg` |
| Agent-generated images (`GenerateImage`) | Request `.jpeg` filename |
| Test fixtures (new) | Prefer `.jpeg` unless PNG is required |

## Exceptions

Use PNG only when JPEG is unsuitable:

- Transparency is required (alpha channel)
- Lossless fidelity is required (pixel-perfect UI tests, embedded metadata in PNG)
- Existing tests or APIs are PNG-specific (e.g. embedded Excalidraw PNG export with scene metadata)

Do not convert existing PNG assets or change export paths that depend on PNG unless the user asks.

## Examples

```typescript
// ✅ Preferred for new raster assets
mimeType: MIME_TYPES.jpg

// ✅ Preferred file naming
const avatarPath = "images/avatar.jpeg";

// ❌ Avoid for new photos/screenshots without transparency
mimeType: "image/png"
new File([data], "photo.png", { type: "image/png" })
```

When both JPEG and PNG are valid, choose JPEG.
