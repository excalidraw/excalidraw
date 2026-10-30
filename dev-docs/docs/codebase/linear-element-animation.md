# Line and arrow animations

Right-click an unlocked line or arrow and choose **Animate**. Select a type, then a speed and direction, and click **Apply**. Multiple selected lines and arrows can be configured together. **None** removes the effect. Applying settings creates one undoable edit; leaving the submenu without applying discards the draft.

- **Traveling dot** moves dots along the entire path, then repeats.
- **Traveling gap** cuts moving openings from the actual line or arrow. Objects behind the line show through the opening.
- The **Count** slider selects an integer from `1` to `20` for dots or gaps. `1` gives a single dot/gap; larger values create evenly spaced items. Count does not change the travel speed.
- **Moving dashes** move from the first point to the last point, or in reverse.
- The **Speed** slider ranges from `0` (paused) to `1` (fastest), in steps of `0.01`. A single dot or gap takes five seconds to travel the path at `0.5`, or 2.5 seconds at `1`.
- **Size** has a slider and numeric input from `1` to `100` scene units. It sets the dot diameter, dash/pulse thickness, or gap diameter. Very small gaps use at least twice the stroke width as their radius so the opening cuts through the whole stroke.
- **Pulse** adds intermittent emphasis along the shaft. Direction is disabled because this effect has no traveling motion.

## Scene JSON

Line and arrow elements accept an optional `animation` property:

```json
{
  "animation": {
    "type": "dot",
    "count": 4,
    "speed": 0.5,
    "size": 20,
    "direction": "forward"
  }
}
```

Supported types are `dot`, `gap`, `dashes`, and `pulse`. `count` is an integer from `1` to `20` (used by dots and gaps). Missing count defaults to `1`; previous plural `dots`/`gaps` values migrate to `dot`/`gap` with count `8`. Speed is a finite number from `0` to `1`, and size is a finite number from `1` to `100`. Directions are `forward` and `reverse`. Original animations without a `size` property migrate their preset speed (`0.5`, `1`, or `2`) to the normalized scale (`0.25`, `0.5`, or `1`) and receive size `8`. Missing or `null` animation means static. Restoration treats malformed or unsupported settings as static while retaining the element's geometry. Existing files require no migration or format-version bump. The property travels with the element through scene JSON, copying, and undo/redo.

## Rendering

Dot, dash, and pulse motion uses a pointer-transparent SVG overlay between the static and interactive canvases. It follows the existing rendered shaft (including curved and elbow arrows), excluding arrowheads and the second RoughJS stroke. CSS drives motion, so animation frames do not mutate elements, history, or collaboration state. Only visible animated elements produce paths. The overlay follows pan, zoom, rotation, opacity, theme, and frame clipping.

Traveling gaps use an editor-only canvas clock, capped at 30 paints per second, and clip only their own cached element bitmap. This preserves paint order, objects behind the line, frame clipping, and bound labels. No redraw loop runs for other effects or paused gaps. Existing PNG and SVG export behavior remains static. Reduced-motion preferences suppress the overlay. Hidden documents pause motion. Each editor owns its visibility listener and removes it on unmount.

Dot, dash, and pulse effects are decorative and render above the static canvas. They do not participate in its per-element occlusion or bound-label cutouts; drawings with overlapping shapes or arrow labels should be reviewed with this in mind.
