---
name: graph-layout-rag
description: Query local graph drawing / layout theory RAG corpus. Use when researching Terraform pipeline layout height, Sugiyama/dot layering, neato stress majorization, ELK/Mermaid/dagre, compound grouping, layer reassignment, or graph layout literature. After search, read full PDFs via manifest doc_id.
---

# Graph layout RAG

Local vector search over a harvested graph-drawing corpus (target ~2.8k catalog entries, ~2k full PDFs). Built for agents researching layered layout, crossing minimization, compound graphs, and Terraform pipeline height.

## When to use

- Explaining why Terraform **pipeline layout is vertically tall** (lane stacking) vs layered/hierarchical layout literature
- **dot rank assignment**, **network simplex**, **layer reassignment**, **Sugiyama** layering
- **Compound graphs**, **grouping**, **port constraints**, **ELK/Mermaid/dagre**
- **Separation constraints**, stress majorization (neato), orthogonal routing
- **VLSI compaction**, **strip packing / track assignment**, **mental-map overlap removal**
- Finding primary sources before changing `terraformPipelineLayout.ts`

## Agent workflow (recommended)

```
1. Search     → yarn graph-rag:query "…" --top 8 --json
2. Shortlist  → pick results by score, title, tags; note doc_id and page
3. Deep read  → if excerpt is not enough, load full PDF text (see below)
4. Cite       → use source_url + page from query result or manifest
```

**Query returns snippets only** (~400 chars per hit). For proofs, algorithms, or quotes you need step 3.

## Commands (from repo root)

```bash
# One-time setup
cd tools/graph-layout-rag && uv sync
cp .env.example .env   # see Embedding section below

yarn graph-rag:harvest
yarn graph-rag:ingest -- --force --rebuild   # first build or after embed model change
yarn graph-rag:query "network simplex rank assignment dot" --top 8 --json
```

Direct CLI (more flags):

```bash
cd tools/graph-layout-rag
uv run graph-layout-rag query "…" --top 8 --json
uv run graph-layout-rag query "…" --tag compound --json
uv run graph-layout-rag ingest -v            # resume incremental ingest (no --force)
```

### Ingest (embed + index)

**Checkpointing:** no `--resume` flag. After each batch (`GRAPH_RAG_INGEST_DOC_BATCH` docs, default 10), LanceDB + `data/indexes/{profile}/ingest_state.json` are updated. Stop anytime; resume with:

```bash
cd tools/graph-layout-rag
uv run graph-layout-rag ingest -v 2>&1 | tee -a data/ingest-run.log
```

Use **`--force --rebuild`** only for first full build or when changing embed model/dims/backend.

| Goal | Command |
|------|---------|
| First build / new embed model | `ingest --force --rebuild -v` |
| Resume after interrupt | `ingest -v` (no `--force`, no `--rebuild`) |
| Re-embed all, keep table | `ingest --force` |
| Drop table, fresh first batch | `ingest --rebuild` |

**Pick an embed profile explicitly** (`uv run graph-layout-rag embed profiles`):

| Profile | Use when |
|---------|----------|
| `mlx-qwen4b` | Free local ingest on Apple Silicon (MLX 4-bit, ~10–15+ active hours full corpus) |
| `openai-large` | Fast cloud ingest (~$5–7, ~30–90 min) with `OPENAI_API_KEY` |
| `gemini` | Cloud ingest via `GEMINI_API_KEY` / `GOOGLE_API_KEY` (embedding-001) |
| `gemini-2` | **Gemini Embedding 2** @ 3072 via Vertex AI (`GOOGLE_GENAI_USE_VERTEXAI` + project) or API key |

Set `RAG_EMBED_PROFILE=mlx-qwen4b` in `.env` or pass `--embed-profile mlx-qwen4b` on **both** `ingest` and `query`. For Vertex Embedding 2: `RAG_EMBED_PROFILE=gemini-2` + GCP creds in `.env` (see README). Legacy `RAG_EMBED_BACKEND=local` + model env vars still work as the implicit `default` profile.

**Per-profile indexes:** each profile writes to `data/indexes/{profile}/` (own LanceDB + ingest_state). Build multiple indexes for A/B testing without conflict; list with `uv run graph-layout-rag embed indexes`.

**Cloud one-time ingest:** `RAG_EMBED_PROFILE=openai-large` + `OPENAI_API_KEY`. Query cost negligible (~$0).

**Do not `query` during ingest** on 24 GB Mac (OOM risk — embed model loaded twice).

Logs: `data/ingest.log` (`-v` for debug). Embed progress: `embed progress: N/M texts (+Xs, total Ys)`.

### Harvest (refresh / expand corpus)

```bash
cd tools/graph-layout-rag
uv run graph-layout-rag harvest --deep-harvest --target-pdfs 2000 --workers 48 --resume -v
uv run graph-layout-rag harvest verify
uv run graph-layout-rag ingest --force
```

| Flag | Purpose |
|------|---------|
| `--deep-harvest` | OpenAlex 4k, arXiv 500, bib 1200 DOIs, 3 retry/bib passes |
| `--target-pdfs 2000` | Stop when ok PDF count reaches N |
| `--target 2800` | Catalog entry ceiling |
| `--workers 48` | Parallel downloads (sweet spot 32–64) |
| `--resume` | Skip seed stages; continue discovery passes |
| `harvest verify` | Validate ok PDFs on disk |
| `-v` | Verbose console logging |
| `--log-file PATH` | Default `data/harvest.log` |

Faster / partial harvest:

```bash
uv run graph-layout-rag harvest --skip-openalex --skip-dblp --max-openalex 50
```

## Query output (`--json`)

```json
{
  "query": "…",
  "results": [
    {
      "score": 0.63,
      "title": "A Technique for Drawing Directed Graphs",
      "excerpt": "…400 char snippet…",
      "source_url": "https://graphviz.org/documentation/TSE93.pdf",
      "page": 20,
      "tags": ["dot", "hierarchical", "graphviz"],
      "doc_id": "gansner-tse93"
    }
  ]
}
```

Filter flags: `--tag compound`, `--category packing`, `--pdf-only`, `--source handbook`, `--year-min 1990`

Pipeline research: see [docs/pipeline-rag-queries.md](../../../docs/pipeline-rag-queries.md).

```bash
yarn graph-rag:query "left edge channel assignment" --category packing --pdf-only --json
yarn graph-rag:catalog --category compaction --limit 20
```

### Query tags

`layer-assignment`, `compound`, `constraints`, `compaction`, `packing`, `overlap`, `research-thread`, `elk`, `sugiyama`, `crossing`, `grouped`, `ports`, `mermaid`, `dagre`, `handbook`, `graphviz`, `bibliography`

### Pipeline layout research threads

| Tag | Topics | Example query |
|-----|--------|---------------|
| `layer-assignment` | Network simplex, ALAP, node promotion, min-width dummy nodes | `ALAP as-late-as-possible layer reassignment` |
| `compaction` | VLSI 1D constraint graphs, scanline compaction | `constraint graph one-dimensional compaction longest path` |
| `constraints` | VPSC, IPSep-CoLa, cluster containment | `VPSC separation constraints overlap removal` |
| `compound` | Global ranking, cluster borders, ELK compound | `compound directed graph layout global ranking cluster borders` |
| `packing` | Skyline strip packing, left-edge track assignment | `left edge algorithm channel routing track assignment` |
| `overlap` | Mental map adjustment, cluster busting, PRISM | `layout adjustment mental map graph drawing` |

## Reading full papers (after search)

Only items with `status: "ok"` in the manifest have local PDFs (~2,088; target ~3,088 after pipeline harvest). Metadata-only entries have title/abstract only — no full text.

### 1. Resolve path from `doc_id`

```bash
cd tools/graph-layout-rag
uv run python3 -c "
import json
doc_id = 'gansner-tse93'  # from query result
items = {i['id']: i for i in json.load(open('data/manifest.json'))['items']}
item = items[doc_id]
print('status:', item['status'])
print('localPath:', item.get('localPath'))
print('url:', item.get('url'))
print('doi:', item.get('doi'))
"
```

PDFs live under `tools/graph-layout-rag/data/raw/pdf/`. Prefer `localPath` from manifest over guessing filenames.

### 2. Extract text (full doc or one page)

```bash
cd tools/graph-layout-rag
uv run python3 -c "
from graph_layout_rag.manifest import load_manifest
from graph_layout_rag.ingest.extract import extract_pdf_pages

doc_id = 'gansner-tse93'
page_num = 20  # optional; omit loop for full doc

item = next(i for i in load_manifest().items if i.id == doc_id)
if item.status != 'ok' or not item.localPath:
    raise SystemExit(f'No PDF for {doc_id} (status={item.status})')

pages = extract_pdf_pages(item)
if page_num:
    p = next((x for x in pages if x.page == page_num), None)
    print(p.text if p else 'page not found')
else:
    print('\n\n'.join(f'--- p.{p.page} ---\n{p.text}' for p in pages))
"
```

Agents with filesystem access may also **Read** the PDF at `tools/graph-layout-rag/{localPath}` directly.

### 3. Metadata-only fallback

If `status` is `metadata_only`, use `title`, `abstract`, `doi`, and `url` from manifest — or fetch via DOI if the agent has web access. Do not expect local PDF.

## Corpus quality (expectations)

| Layer | ~Count | Use |
|-------|--------|-----|
| Full PDFs (`ok`) | ~2,000 (target) | Deep reading, accurate quotes |
| Metadata only | ~500–800 | Discovery, citations; abstract when present |
| Failed | varies | Retry with `harvest --deep-harvest --resume` |

**High-signal sources:** `graphviz.org`, `handbook`, `topic-seed`, `elk-bibliography`, curated seeds. **Noisier:** OpenAlex long tail (some off-topic PDFs). Prefer top-ranked hits with layout-related tags.

**Index:** LanceDB at `tools/graph-layout-rag/data/indexes/{profile}/lancedb/` (target ~60k chunks for full harvest: ~35 chunks/PDF avg + metadata-only stubs). Chunks ~4k chars with overlap. Query ranks chunks; multiple chunks per paper exist — use `doc_id` + `page` to read contiguous text. Check `data/indexes/{profile}/ingest_state.json` / `batch done` lines in `data/ingest.log` for build progress.

## Example queries

```bash
yarn graph-rag:query "layer reassignment network simplex slack edges" --top 8 --json
yarn graph-rag:query "ALAP as-late-as-possible layer reassignment" --tag layer-assignment --json
yarn graph-rag:query "constraint graph one-dimensional compaction" --tag compaction --json
yarn graph-rag:query "VPSC separation constraints overlap removal" --tag constraints --json
yarn graph-rag:query "left edge algorithm channel routing" --tag packing --json
yarn graph-rag:query "layout adjustment mental map" --tag overlap --json
yarn graph-rag:query "compound graph grouping port constraints ELK" --tag compound --json
yarn graph-rag:query "crossing minimization sifting layered" --top 5 --json
yarn graph-rag:query "stress majorization neato" --top 5 --json
```

## Prerequisites

- Python 3.11+, `uv` installed
- `cd tools/graph-layout-rag && uv sync` once (pulls `rag-common[mlx]` for Apple Silicon 4-bit)
- Embeddings via `tools/rag-common`: OpenAI `text-embedding-3-large`, or local Qwen3 (MLX 4-bit on Darwin, Sentence Transformers otherwise)
- Re-run `ingest --force --rebuild` after switching embed backend/model/dims
- `OPENAI_API_KEY` only required for `RAG_EMBED_BACKEND=openai` or `auto` with valid key

## Paths (all gitignored except example manifest)

| Path | Contents |
|------|----------|
| `tools/graph-layout-rag/data/manifest.json` | Catalog: id, status, localPath, doi, abstract |
| `tools/graph-layout-rag/data/raw/pdf/` | Downloaded PDFs |
| `tools/graph-layout-rag/data/indexes/{profile}/` | Per-profile vector index + ingest checkpoint |
| `tools/graph-layout-rag/data/ingest.log` | Ingest structured log |
| `tools/graph-layout-rag/data/harvest.log` | Harvest run log |
| `tools/graph-layout-rag/data/harvest_checkpoint.json` | Harvest resume state |

## Related docs

- [tools/graph-layout-rag/README.md](../../tools/graph-layout-rag/README.md)
- [docs/terraform-pipeline-import-debug-handoff.md](../../docs/terraform-pipeline-import-debug-handoff.md) — pipeline height diagnostic

## Do not

- Commit `data/raw/`, `data/indexes/`, `data/manifest.json`, or log files
- Run `query` while `ingest` is active on a memory-constrained Mac (OOM)
- Resume ingest with `--force --rebuild` (re-does everything)
- Assume every manifest entry has a PDF — check `status` first
- Treat query `excerpt` as the full paper — use deep-read steps above
- Mix embed backends between ingest and query (vectors incompatible without rebuild)
