# Pipeline layout RAG query pack

Use these queries when researching Terraform pipeline layout in `packages/excalidraw/components/terraformPipelineLayout*.ts`.

Prefer:

```bash
yarn graph-rag:query "<query below>" --category <slug> --pdf-only --json
yarn graph-rag:catalog --category <slug> --limit 20
```

## Pipeline categories

`layer-assignment`, `crossing`, `compound`, `constraints`, `coordinate-assignment`, `routing`, `compaction`, `packing`, `overlap`

## Code module → queries

| Code | Category | Example query |
| --- | --- | --- |
| `computeDepths()` / longest-path columns | `layer-assignment` | `network simplex rank assignment slack layered digraph` |
| `terraformPipelineLayoutPacked.ts` | `packing`, `layer-assignment` | `column reassignment vertical slack cross-lane packing` |
| Compound frames / hierarchy | `compound` | `compound directed graph global ranking cluster borders` |
| VPSC / hull clearance | `constraints` | `VPSC separation constraints cluster containment` |
| Within-column X placement | `coordinate-assignment` | `Brandes Köpf horizontal coordinate assignment blocks` |
| Sibling columns / skyline | `packing` | `skyline strip packing bottom-left heuristic` |
| Edge routing | `routing` | `left edge algorithm channel routing track assignment` |
| 1D/2D compaction | `compaction` | `constraint graph one-dimensional compaction longest path` |
| Overlap / mental map | `overlap` | `layout adjustment mental map overlap removal` |
| Crossing within columns | `crossing` | `sifting k-layer straightline crossing minimization` |

## Starter query set

```bash
yarn graph-rag:query "network simplex rank assignment layered digraph" --category layer-assignment --pdf-only --json
yarn graph-rag:query "compound directed graph layout global ranking cluster borders" --category compound --pdf-only --json
yarn graph-rag:query "VPSC separation constraints IPSep-CoLa" --category constraints --pdf-only --json
yarn graph-rag:query "Brandes Köpf horizontal coordinate assignment" --category coordinate-assignment --pdf-only --json
yarn graph-rag:query "left edge algorithm channel routing track assignment" --category packing --pdf-only --json
yarn graph-rag:query "constraint graph one-dimensional compaction scanline" --category compaction --pdf-only --json
yarn graph-rag:query "layout adjustment mental map cluster busting" --category overlap --pdf-only --json
```

## Deep read after search

Query returns ~400-char excerpts. For proofs and algorithms, load the full PDF via `doc_id` — see `.agents/skills/graph-layout-rag/SKILL.md`.
