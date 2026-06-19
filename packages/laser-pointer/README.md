# Laser Pointer

## Usage

    import { LaserPointer } from '@excalidraw/laser-pointer'

    const stroke = new LaserPointer(options)

    stroke.addPoint([100, 200, 1])
    stroke.close()

    const outline = stroke.getStrokeOutline()

## Options

| Property        | Type                                      | Default    | Description                                                   |
| --------------- | ----------------------------------------- | ---------- | ------------------------------------------------------------- |
| `size`          | `number`                                  | `2`        | Radius of the stroke.                                         |
| `streamline`    | `number`                                  | `0.42`     | Interpolate input points to reduce jitter.                    |
| `simplify`      | `number`                                  | `0.1`      | Reduce stroke size by sacrificing precision.                  |
| `simplifyPhase` | `"input" \| "output" \| "tail" `          | `"output"` | Decides when the simplification algorithm should be applied.  |
| `sizeMapping`   | `(details: SizeMappingDetails) => number` | `() => 1`  | Maps each point to a value between `0.0` and `1.0`.           |
| `keepHead`      | `boolean`                                 | `false`    | Whether size mapping should influence the head of the stroke. |
