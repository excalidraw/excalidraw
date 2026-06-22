# Terraform canvas runtime performance

This document tracks dev-only runtime experiments for large Terraform canvases. It is separate from [terraform-import-performance-log.md](./terraform-import-performance-log.md), which remains dedicated to import and layout wall-clock performance.

## Reference workload

| Field | Value |
| --- | --- |
| Preset | `staging-extended-localstack-v2` |
| View | Pipeline, Full, Compound, Packed, Pull-left, All resources |
| Demo URL | `/demo?preset=staging-extended-localstack-v2&view=pipeline&pipelineVariant=compound&packedPullLeft=1&ancillary=1` |
| Normal Zoom LOD | Disabled through the main menu |
| Stress zoom | Approximately `0.10` |
| Original observed scene | Approximately `8,139` elements, including `5,553` AWS icon primitives |
| Browser / machine / commit | Recorded by each benchmark result |
| Workloads | Deterministic pan, zoom, hover sweep, and combined interaction |

## Goal

Phase 1 passes when the `all` profile reduces combined-workload p95 frame interval by at least **50%** against the same-run, same-machine `baseline` profile without correctness regressions.

## Experiments

All settings default to off, are available only from the development `Terraform canvas performance` menu, and persist under `tfdraw-terraform-canvas-runtime-performance`.

| Setting | Effect |
| --- | --- |
| Hide AWS icon primitives below threshold | Filters only `terraformAwsIconGlyph` elements after viewport culling and normal LOD |
| Suppress relationship hover below threshold | Ignores hover focus while preserving selection focus |
| Debounce relationship hover | Applies graph-address hover transitions after a trailing `100ms` delay |
| Suppress Terraform frame clipping below threshold | Skips nested clip work for Terraform elements during non-export canvas rendering; hit-testing is unchanged |
| Skip binding repair during focus updates | Keeps visibility reconciliation but skips geometry repair only in runtime focus passes |
| Shared threshold | `20%`, `30%` default, or `40%` |

Settings are runtime-only. They do not enter `AppState`, scene serialization, history, collaboration payloads, public Excalidraw exports, or image/SVG export rendering.

## Hypotheses

1. AWS icon primitives dominate low-zoom draw count.
2. Raw primitive hover movement triggers avoidable full-scene focus work even when the graph address is unchanged.
3. Runtime focus binding repair is redundant when geometry has not changed.
4. Deep pipeline frame clipping adds measurable low-zoom canvas cost.

## Reproduction

Start the development app, then run:

```bash
yarn benchmark:terraform-canvas --url http://localhost:3000 --runs 5
```

Raw JSON defaults to `/tmp/terraform-canvas-runtime-results.json`; use `--out <path>` to override it. The benchmark is manual and non-gating.

## Results

| Profile | Combined p95 | Improvement vs baseline | Status |
| --- | --: | --: | --- |
| baseline | `49.98ms` | — | Reference |
| icons | `50.00ms` | `-0.0%` | No measurable p95 gain |
| hover | `36.72ms` | `26.5%` | Material gain |
| clipping | `49.96ms` | `0.0%` | No measurable p95 gain |
| skip-repair | `56.70ms` | `-13.4%` | Regressed |
| all | `36.72ms` | `26.5%` | Improved, target missed |

The five-run same-machine benchmark did **not** meet the 50% acceptance target.

## Correctness

Automated coverage verifies settings defaults/versioning/persistence failure, low-zoom icon filtering, renderer revision invalidation, generic-element preservation, hover suppression with selection fallback, clipping guards including export behavior, and existing relationship-focus/hover-loop behavior.

## Known limitations

- The experiments reduce work but do not add spatial hit-test indexing or dirty-region rendering.
- Hover focus still performs whole-scene relationship reconciliation when the effective graph address changes.
- Skipping binding repair assumes runtime focus changes visibility and styling only; geometry-changing paths continue to repair bindings.
- Frame clipping suppression does not change hit-testing.
- The benchmark uses browser automation and is intentionally manual rather than CI-gating.

## Experiment log

Append new entries; do not rewrite prior results.

### 2026-06-12: Phase 1 implementation

- Added default-off runtime settings and development menu.
- Added icon filtering, graph-address hover suppression/debounce, focus-only binding-repair skip, Terraform-only non-export clipping suppression, and renderer revision invalidation.

### 2026-06-12: Phase 1 five-run benchmark

| Field | Value |
| --- | --- |
| Browser | Chromium `134.0.6998.35`, headless Playwright |
| Commit | `215c88807f7c9d594160f16afdcee4c4000e7768` plus this working-tree implementation |
| Scene | `8,160` elements: `577` frames, `932` rectangles, `166` arrows, `5,553` AWS icon primitives, `932` text elements |
| Visible at reference viewport | `113` elements |
| Runs | One warm-up plus five measured runs per workload/profile |
| Raw result | `/tmp/terraform-canvas-runtime-results.json` |

- `all` reduced combined p95 from `49.98ms` to `36.72ms` (`26.5%`), below the 50% target.
- Hover suppression/debounce reduced combined `replaceAllElements` from `4` to `1` in every measured run and produced the same p95 as `all`.
- Icon suppression and clipping suppression did not materially change combined p95 at the measured viewport.
- Skip-repair regressed combined p95 to `56.70ms` in this run.
- Phase 1 acceptance: **failed performance target**. Experiments remain default-off. Stop for review before deeper architecture changes.

### 2026-06-22: Zoom-out legibility campaign — is LOD perf-justified? (`--suite lod`)

Context: in the RCLL pipeline view, zooming out makes the diagram illegible because
the Terraform LOD feature is **pure culling** (`terraformLod.ts` →
`Renderer.ts` `filterTerraformLodVisibleElements`). Before redesigning the low-zoom
experience, this measures whether the culling carries its weight on the render hot path.

Method: new `--suite lod` mode in `scripts/terraform/benchmark-canvas-runtime.mjs`
drives `terraformLodEnabled`/`terraformLodPreset` via `setState` (part of the
`Renderer.getRenderableElements` memo key, so this recomputes the visible set exactly
as the product feature does). The **primary metric is the deterministic per-element
canvas-regeneration count** (`elementCanvasRegenStats`, armed only in dev/test, reset
per workload, incremented in the `shouldRegenerateBecauseZoom` branch at
`renderElement.ts`). Frame-interval p95 is **directional only** — RAF coalescing,
render throttling, and WeakMap GC make wall-clock timing non-deterministic through the
benchmark. See [docs/pipeline-rcll-layout-design.md](./pipeline-rcll-layout-design.md).

| Field | Value |
| --- | --- |
| Browser | Chromium `134.0.6998.35`, headless Playwright |
| Commit | `651a171ed3b40f930716c95a8e49383e80714b9c` plus this working-tree instrumentation |
| Scene | `8,154` elements |
| Stress viewport | zoom `0.10`, scene-centered |
| Runs | One warm-up plus five measured runs per workload/profile |
| Raw result | `/tmp/terraform-lod-ab.json` |

| LOD profile | Visible @0.1 | Zoom regen (count, primary) | Zoom p95 (dir.) | Combined p95 (dir.) |
| --- | --: | --: | --: | --: |
| `lod-off` | `392` | `12` | `16.76ms` | `23.44ms` |
| `lod-balanced` | `113` | `0` | `16.74ms` | `20.12ms` |
| `lod-performance` | `113` | `0` | `16.74ms` | `16.80ms` |

Findings:

- LOD culls ~71% of in-viewport elements at `0.1` (392 → 113).
- The primary deterministic metric agrees with p95: LOD eliminates the post-settle
  zoom regeneration burst (`12 → 0`) and reduces combined p95 ~28% (`23.44 → 16.80ms`,
  performance preset). `balanced` and `performance` cull identically at this depth.
- **Legibility-with-LOD-off check** (screenshots in `docs/assets/lod-ab/`, 1440×900 @ 10%):
  neither state is legible at deep zoom — resource labels truncate to `a…` and boxes are
  a few px tall in both. `lod-off` is merely *denser* (845 vs 216 visible at this larger
  viewport); it does not become readable.

**Decision:** LOD is **modestly perf-justified — keep it on by default; do not drop the
culling.** Because the scene is illegible at deep zoom *regardless* of LOD, the fix is
**navigation/comprehension (minimap + search-to-fit), not cosmetic placeholder fills.**
This confirms the campaign's navigation-first scope: Phase 2a (navigation) is primary;
Phase 2b (placeholder + frame-name thresholds) is complementary polish for the
already-navigated-in view, demoted behind 2a.
