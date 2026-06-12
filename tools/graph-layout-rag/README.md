# Graph layout RAG

Local research corpus for graph drawing and layout theory (Graphviz dot/neato, Sugiyama layering, stress majorization, handbook chapters, OpenAlex/DBLP metadata). Used by agents researching Terraform pipeline layout height and graph layout algorithms.

## Setup

Requires Python 3.11+ and [uv](https://github.com/astral-sh/uv).

```bash
cd tools/graph-layout-rag
uv sync
cp .env.example .env   # or reuse tools/repo-rag/.env — set OPENAI_API_KEY
```

Embeddings use shared [`tools/rag-common`](../rag-common) with **named profiles** (`RAG_EMBED_PROFILE` or `--embed-profile`). Legacy `RAG_EMBED_BACKEND=auto|openai|local|gemini` still works as the implicit `default` profile.

```bash
uv run graph-layout-rag embed profiles   # list built-in profiles
```

| Profile | Backend | Model | Dims | When |
| --- | --- | --- | --- | --- |
| `openai-large` | openai | `text-embedding-3-large` | 1024 | Fast cloud ingest (~$5–7 full corpus) |
| `openai-small` | openai | `text-embedding-3-small` | 1024 | Cheaper cloud |
| `gemini` | gemini | `gemini-embedding-001` | 768 | `GEMINI_API_KEY` or `GOOGLE_API_KEY` |
| `gemini-2` | gemini | `gemini-embedding-2` | 3072 | Vertex AI (recommended) or AI Studio key |
| `mlx-qwen4b` | local | `Qwen/Qwen3-Embedding-4B` (MLX 4-bit) | 1024 | Free Apple Silicon ingest |
| `mlx-qwen0.6b` | local | `Qwen/Qwen3-Embedding-0.6B` (MLX 4-bit) | 1024 | Faster local |
| `local-fp16-qwen4b` | local | Qwen3-4B FP16 (ST/MPS) | 1024 | Heavier RAM |

API key and embed env load from `tools/graph-layout-rag/.env`, sibling `tools/repo-rag/.env`, or `.env.example`. See **Embedding & ingest** below.

## Pipeline

```bash
# From repo root (yarn wrappers)
yarn graph-rag:harvest
yarn graph-rag:ingest -- --force --rebuild   # required after embed model change
yarn graph-rag:query "layered graph drawing rank assignment" --top 8 --json
yarn graph-rag:catalog

# Or directly
uv run graph-layout-rag harvest --max-openalex 50   # faster first pass
uv run graph-layout-rag ingest --force --rebuild
uv run graph-layout-rag query "stress majorization neato" --top 5 --json
```

### Harvest

Downloads PDFs and metadata into `data/manifest.json` and `data/raw/`. Sources:

- [graphviz.org/theory](https://graphviz.org/theory/) — classic dot/neato papers
- [GD Handbook](https://cs.brown.edu/people/rtamassi/gdhandbook/) — chapter PDFs
- **Topic seeds** — ELK/Mermaid, Sugiyama, Sander compound graphs, Stratisfimal, layer reassignment, constraints, **compaction**, **packing**, **overlap** research threads
- **ELK bibliography** — DOIs from the ELK survey paper
- OpenAlex (paginated, topic queries + graph-drawing concept filter) + DBLP + Semantic Scholar
- **arXiv** (cs.CG / cs.DS graph layout queries)
- Bibliography chain from seed PDFs (relevance-filtered DOIs)
- Paywalled books as `metadata_only` stubs

```bash
# Scale toward ~2k PDFs (multi-pass, resumable — may take several hours)
uv run graph-layout-rag harvest --deep-harvest --target-pdfs 2000 --workers 48 --resume -v
uv run graph-layout-rag harvest verify
uv run graph-layout-rag ingest --force --rebuild

# Faster partial harvest
uv run graph-layout-rag harvest --skip-openalex --skip-dblp --max-openalex 50
uv run graph-layout-rag harvest --dry-run
```

| Flag | Purpose |
| --- | --- |
| `--deep-harvest` | Raises caps (OpenAlex 4k, arXiv 500, bib 1200 DOIs, 3 retry/bib passes) |
| `--target-pdfs 2000` | Stop when `ok` PDF count reaches N |
| `--target 2800` | Catalog entry ceiling (metadata + PDFs) |
| `--resume` | Skip one-time seed stages; keep discovery passes |
| `--max-passes 5` | Discovery loop iterations |
| `harvest verify` | Re-check ok PDFs on disk; downgrade invalid |

**Query tags:** `layer-assignment`, `compound`, `constraints`, `compaction`, `packing`, `overlap`, `elk`, `sugiyama`, `crossing`, `grouped`, `ports`, `research-thread`

### Ingest

Extracts text with PyMuPDF, chunks (~4000 chars, 600 overlap), embeds, indexes in LanceDB at `data/indexes/{profile}/lancedb/` (one index per embed profile).

```bash
uv run graph-layout-rag ingest -v           # incremental (resume) — default after first build
uv run graph-layout-rag ingest --force      # re-embed all docs (keep existing LanceDB rows)
uv run graph-layout-rag ingest --rebuild    # drop vector table, recreate on first batch
uv run graph-layout-rag ingest --force --rebuild   # full rebuild (required after embed model change)
```

#### Resume / checkpointing (no `--resume` flag)

Ingest checkpoints **per batch** (every `GRAPH_RAG_INGEST_DOC_BATCH` docs, default 10):

1. Chunks flushed to **`data/indexes/{profile}/lancedb/`**
2. Doc ids + sha256 saved to **`data/indexes/{profile}/ingest_state.json`**

**Stop anytime** (`Ctrl+C`). At most one in-flight batch (~≤10 docs) is lost and re-embedded on resume.

**Resume later** (same `.env` embed config — do **not** pass `--force` or `--rebuild`):

```bash
cd tools/graph-layout-rag
uv run graph-layout-rag ingest -v 2>&1 | tee -a data/ingest-run.log
```

Already-indexed docs are skipped when manifest `sha256` matches `ingest_state.json`. Harvest uses `--resume`; ingest uses **incremental mode by default**.

#### Multi-profile indexes (A/B testing)

Each embed profile has its own index directory — profiles no longer overwrite each other:

```bash
RAG_EMBED_PROFILE=gemini-2 uv run graph-layout-rag ingest --force --rebuild -v
RAG_EMBED_PROFILE=mlx-qwen4b uv run graph-layout-rag ingest --force --rebuild -v

uv run graph-layout-rag query "Sugiyama layering" --embed-profile gemini-2 --json
uv run graph-layout-rag query "Sugiyama layering" --embed-profile mlx-qwen4b --json
uv run graph-layout-rag embed indexes
```

#### Embedding & ingest on Apple Silicon (recommended local)

In `.env` (profile replaces hand-tuning five+ vars):

```bash
RAG_EMBED_PROFILE=mlx-qwen4b
GRAPH_RAG_INGEST_DOC_BATCH=10       # lower if RAM pressure; 25+ batches spike unified memory on MPS
```

Or legacy env:

```bash
RAG_EMBED_BACKEND=local
RAG_LOCAL_EMBED_MODEL=Qwen/Qwen3-Embedding-4B
RAG_LOCAL_EMBED_DIMS=1024
RAG_LOCAL_EMBED_QUANT=4bit          # MLX via mlx-embeddings (~2.1 GB weights)
```

Requires `rag-common[mlx]` (included in `uv sync` for this package). Progress: `data/ingest.log` and stderr (`embed progress: N/M texts (+Xs, total Ys)`). Use `-v` for per-doc chunk logs.

**Prevent sleep during long runs:**

```bash
caffeinate -dims uv run graph-layout-rag ingest -v 2>&1 | tee -a data/ingest-run.log
```

**Do not run `query` while ingest is running** on a 24 GB Mac — loading the embed model twice risks OOM.

#### Cloud ingest (faster one-time build)

In `.env`:

```bash
RAG_EMBED_PROFILE=openai-large
OPENAI_API_KEY=sk-...
GRAPH_RAG_WORKERS=4                  # parallel API batches
```

Gemini alternative: `RAG_EMBED_PROFILE=gemini` + `GEMINI_API_KEY`.

**Gemini Embedding 2 via Vertex AI** (best quality; incompatible with MLX / gemini-001 index):

```bash
# tools/graph-layout-rag/.env
RAG_EMBED_PROFILE=gemini-2
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

uv run graph-layout-rag ingest --force --rebuild -v
uv run graph-layout-rag query "Sugiyama layering" --embed-profile gemini-2 --json
```

Requires `rag-common[gemini]` (included in `uv sync` for this package).

**Adaptive rate limiting (gemini-2):** ingest paces `embed_content` to a sliding tokens-per-minute budget so Vertex 429s are rare. Tune in `.env` after checking [Vertex quotas](https://cloud.google.com/vertex-ai/docs/generative-ai/quotas-genai):

```bash
RAG_GEMINI_TOKENS_PER_MIN=100000   # raise gradually if logs stay 429-free
RAG_GEMINI_RATE_HEADROOM=0.85
RAG_GEMINI_MIN_INTERVAL_MS=50
```

Learned budget persists in `~/.cache/rag-common/gemini_rate_state.json` across resume runs. **Resume after interrupt** (keeps indexed chunks — no `--force` / `--rebuild`):

```bash
uv run graph-layout-rag ingest -v
```

Then `uv run graph-layout-rag ingest --force --rebuild`. Typical full corpus (~1,679 PDFs + 1,119 metadata-only, ~60k chunks, ~770 tokens/chunk):

| Model                    | Est. cost (one-time) | Est. time  |
| ------------------------ | -------------------- | ---------- |
| `text-embedding-3-large` | **~$5–7**            | ~30–90 min |
| `text-embedding-3-small` | **~$1**              | similar    |

`ingest_state.json` records `total_tokens_embedded` and `estimated_cost_usd` after OpenAI runs.

#### Query cost

| Phase | Cost |
| --- | --- |
| **Initial ingest** | OpenAI: ~$5–7 once (see above). Local: $0 (time + electricity). |
| **Each query** | **~$0** local. OpenAI: ~20–50 tokens/query → **&lt; $0.01** even for heavy use. LanceDB search is always local. |

Query and index **must use the same embed profile** (or matching backend/model/dims). Switching profiles requires `ingest --force --rebuild`.

```bash
uv run graph-layout-rag ingest -v --embed-profile mlx-qwen4b
uv run graph-layout-rag query "layer reassignment" --embed-profile mlx-qwen4b --json
```

#### Realistic timing (full ~2.8k manifest, ~1,679 PDFs)

| Setup | Active time | Notes |
| --- | --- | --- |
| MLX 4-bit Qwen3-4B, M4 Pro 24 GB | **~10–15+ hours** | ~30–50 chunks/min; ~35 chunks/PDF avg; macOS sleep pauses progress |
| OpenAI `text-embedding-3-large` | **~30–90 min** | Parallel workers; no local RAM fight |
| Qwen3-0.6B MLX 4-bit | **~3–4× faster** than 4B | Slightly lower retrieval quality |

Progress metric: trust **manifest items ingested** (scan progress in log every 100 items), not guessed chunk %. Early handbook/Graphviz PDFs are chunk-dense.

After switching embed models or dims, run **`ingest --force --rebuild`** (vector spaces are incompatible).

### Query

JSON output for LLM agents:

```bash
uv run graph-layout-rag query "dot algorithm network simplex" --top 5 --json
uv run graph-layout-rag query "constraint graph one-dimensional compaction" --tag compaction --json
uv run graph-layout-rag query "left edge algorithm channel routing" --tag packing --json
uv run graph-layout-rag query "VPSC separation constraints overlap removal" --tag constraints --json
uv run graph-layout-rag query "left edge channel assignment" --category packing --pdf-only --json
```

### Catalog

Classify harvested PDFs into **pipeline-layout categories** (derived from manifest tags + title/abstract keywords; not written back to manifest):

`layer-assignment`, `crossing`, `compound`, `constraints`, `coordinate-assignment`, `routing`, `compaction`, `packing`, `overlap`

```bash
yarn graph-rag:catalog
uv run graph-layout-rag catalog
uv run graph-layout-rag catalog --category compound --limit 20
uv run graph-layout-rag catalog --uncategorized
uv run graph-layout-rag catalog --doc-id gansner-tse93
uv run graph-layout-rag catalog --json
uv run graph-layout-rag catalog --include-orphans   # PDFs on disk missing from manifest
```

### Pipeline harvest (+1000 pipeline PDFs)

```bash
yarn graph-rag:harvest -- --pipeline-harvest --resume --workers 48 -v
yarn graph-rag:harvest verify
yarn graph-rag:ingest
```

See [docs/pipeline-rag-queries.md](../../docs/pipeline-rag-queries.md) for category-filtered query examples.

## Gitignored data

- `data/raw/` — downloaded PDFs
- `data/indexes/` — per-profile vector indexes (`{profile}/lancedb/`, `{profile}/ingest_state.json`)
- `data/manifest.json` — harvest output
- `data/harvest_checkpoint.json` — harvest resume state
- `data/harvest.log` — harvest run log
- `data/ingest.log`, `data/ingest-run.log` — ingest structured log / tee output
- `.venv/`, `.env`

## Copyright

Harvest attempts legal open-access downloads only. Paywalled books remain metadata stubs. Do not commit harvested PDFs or LanceDB indexes to git.

## Agent handoff

When debugging Terraform pipeline vertical height or researching layout algorithms, run query before deep-diving source papers. See `.agents/skills/graph-layout-rag/SKILL.md`.
