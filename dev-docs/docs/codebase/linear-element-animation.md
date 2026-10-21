# Line and arrow animations

Right-click an unlocked line or arrow and choose **Animate**. Select a type, then a speed and direction, and click **Apply**. Multiple selected lines and arrows can be configured together. **None** removes the effect. Applying settings creates one undoable edit; leaving the submenu without applying discards the draft.

- **Traveling dots** and **Moving dashes** move from the first point to the last point, or in reverse. Slow, Normal, and Fast correspond to 0.5×, 1×, and 2×.
- **Pulse** adds intermittent emphasis along the shaft. Direction is disabled because this effect has no traveling motion.

## Scene JSON

Line and arrow elements accept an optional `animation` property:

```json
{
  "animation": {
    "type": "dots",
    "speed": 1,
    "direction": "forward"
  }
}
```

Supported types are `dots`, `dashes`, and `pulse`; speeds are `0.5`, `1`, and `2`; directions are `forward` and `reverse`. Missing or `null` animation means static. Restoration treats malformed or unsupported settings as static while retaining the element's geometry. Existing files require no migration or format-version bump. The property travels with the element through scene JSON, copying, and undo/redo.

## Rendering

Motion is a pointer-transparent SVG overlay between the static and interactive canvases. It follows the existing rendered shaft (including curved and elbow arrows), excluding arrowheads and the second RoughJS stroke. CSS drives motion, so animation frames do not mutate elements, history, or collaboration state. Only visible animated elements produce paths. The overlay follows pan, zoom, rotation, opacity, theme, and frame clipping.

The base canvas stays static, and existing PNG and SVG export behavior remains static. Reduced-motion preferences suppress the overlay. Hidden documents pause motion. Each editor owns its visibility listener and removes it on unmount.

The effects are decorative and render above the static canvas. They do not participate in its per-element occlusion or bound-label cutouts; drawings with overlapping shapes or arrow labels should be reviewed with this in mind.
