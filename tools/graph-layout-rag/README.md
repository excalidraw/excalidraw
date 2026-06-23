# Graph layout RAG

Local research corpus for graph drawing and layout theory (Graphviz dot/neato, Sugiyama layering, stress majorization, handbook chapters, OpenAlex/DBLP metadata). Used by agents researching Terraform pipeline layout height and graph layout algorithms.

## Setup

Requires Python 3.11+ and [uv](https://github.com/astral-sh/uv).

```bash
cd tools/graph-layout-rag
uv sync --extra mlx   # add --extra mlx on Apple Silicon for local MLX embed profiles; omit on Linux/CUDA
cp .env.example .env   # or reuse tools/repo-rag/.env — set OPENAI_API_KEY
```

`mlx` is an opt-in extra, not a base dependency — it's Apple-Silicon-only and breaks the Linux/CUDA
desktop venv if installed there (see [docs/quality-campaign-2026-06-23.md](docs/quality-campaign-2026-06-23.md)).

Embeddings use shared [`tools/rag-common`](../rag-common) with **named profiles** (`RAG_EMBED_PROFILE` or `--embed-profile`). Legacy `RAG_EMBED_BACKEND=auto|openai|local|gemini` still works as the implicit `default` profile.

```bash
uv run graph-layout-rag embed profiles   # list built-in profiles
```

| Profile | Backend | Model | Dims | When |
| --- | --- | --- | --- | --- |
| `openai-large` | openai | `text-embedding-3-large` | 1024 | Fast cloud ingest (~$5–7 full corpus) |
| `openai-small` | openai | `text-embedding-3-small` | 1024 | Cheaper cloud |
| `gemini` | gemini | `gemini-embedding-001` | 768 | `GEMINI_API_KEY` or `GOOGLE_API_KEY` |
| `gemini-2` | gemini | `gemini-embedding-2-preview` | 3072 | Preserved fixed-window baseline |
| `gemini-2-structure-v1` | gemini | `gemini-embedding-2-preview` | 3072 | Secondary cloud build; source for GPU reembed |
| `cuda-qwen0.6b-1024` | local | `Qwen/Qwen3-Embedding-0.6B` (CUDA FP16) | 1024 | **Production query profile** (GPU reembed from gemini secondary) |
| `cuda-qwen0.6b-section-v1` | local | `Qwen/Qwen3-Embedding-0.6B` (CUDA 4-bit) | 1024 | Chunking campaign: enrich indexed text with document/section metadata |
| `cuda-qwen0.6b-small2big-v1` | local | `Qwen/Qwen3-Embedding-0.6B` (CUDA 4-bit) | 1024 | Chunking campaign: smaller child chunks (~350 target / 550 max) |
| `cuda-qwen0.6b-contextual-v1` | local | `Qwen/Qwen3-Embedding-0.6B` (CUDA 4-bit) | 1024 | Contextual Retrieval build with local LLM-generated context |
| `cuda-qwen4b-1024` | local | `Qwen/Qwen3-Embedding-4B` (CUDA 4-bit) | 1024 | Quality campaign probe; skipped on RTX 3060 Ti 8 GB after OOM |
| `cuda-qwen4b-2560` | local | `Qwen/Qwen3-Embedding-4B` (CUDA 4-bit) | 2560 | Quality campaign high-dimensional probe; skipped on current GPU |
| `mlx-qwen4b` | local | `Qwen/Qwen3-Embedding-4B` (MLX 4-bit) | 1024 | Free Apple Silicon ingest |
| `mlx-qwen0.6b` | local | `Qwen/Qwen3-Embedding-0.6B` (MLX 4-bit) | 1024 | Faster local |
| `local-fp16-qwen4b` | local | Qwen3-4B FP16 (ST/MPS) | 1024 | Heavier RAM |

API key and embed env load from `tools/graph-layout-rag/.env`, sibling `tools/repo-rag/.env`, or `.env.example`. See **Embedding & ingest** below.

## Local-first embedding

Production query profile: **`cuda-qwen0.6b-1024`** (Qwen3-Embedding-0.6B @ 1024 dims on RTX 3060 Ti, $0 API). Build the **secondary** `gemini-2-structure-v1` index once on Mac/Vertex, then GPU re-embed:

```bash
# Mac: build secondary (if missing)
RAG_EMBED_PROFILE=gemini-2-structure-v1 uv run graph-layout-rag ingest --force --rebuild

# Mac → GPU box → Mac (shared scripts in tools/rag-common/scripts/)
RAG_GPU_TOOL=tools/graph-layout-rag \
  tools/graph-layout-rag/scripts/gpu_dense_reembed.sh

# Query (default from .env)
yarn graph-rag:query "layered graph drawing" --top 8 --json
```

Benchmark (catalog qrels, hybrid nDCG@10): gemini-2-structure-v1 **0.768** vs cuda-qwen0.6b-1024 **0.718**. Local Ollama HyDE (2026-06-17) did not improve cuda hybrid — see [local LLM benchmark](../../docs/graph-layout-rag-local-llm-benchmark-2026.md).

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
- **Library docs** — OGDF, ELK, dagre, Graphviz engine/algorithm pages (implementer-grade source for compaction/packing/routing)
- OpenAlex (paginated, topic queries + graph-drawing concept filter) + DBLP + Semantic Scholar
- **Complete trusted venues** — schema.org-driven DROPS GD 2024/2025 plus strictly filtered SoCG, and the fully paginated JGAA archive with direct PDF links. A separate source checkpoint fetches only newly configured volumes/issues on rerun.
- **Crossref venues** — JGAA/CGTA/GD/LIPIcs plus visualization (TVCG, CGF/EuroVis, InfoVis, PacificVis) and VLSI CAD (TCAD, DAC, ICCAD, ISPD); broad journals are strict relevance-gated
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

`--workers` is the process-wide active PDF download budget, including downloads started by concurrent discovery sources. Provider API calls use separate shared policies and persistent thread-local clients. Semantic Scholar defaults to 32 concurrent requests, cools down after 429s, and resumes unfinished requests in the same run. OpenAlex is capped at 100 RPS and reserves metered work from the configured daily free-dollar budget; free singleton lookups continue after that budget is exhausted. End-of-run provider summaries report throughput, outcomes, retries, cooldowns, peak concurrency, and OpenAlex budget usage.

Set `OPENALEX_API_KEY` in `.env`. Optional overrides include `GRAPH_RAG_OPENALEX_CONCURRENCY`, `GRAPH_RAG_OPENALEX_RPS`, `GRAPH_RAG_OPENALEX_FREE_BUDGET_USD`, `GRAPH_RAG_S2_CONCURRENCY`, `GRAPH_RAG_S2_COOLDOWN_SECONDS`, and `GRAPH_RAG_CORE_RPS`. CORE defaults to the documented anonymous `10/min`, or personal-key `25/min` when `CORE_API_KEY` is set.

| Flag | Purpose |
| --- | --- |
| `--deep-harvest` | Raises caps (OpenAlex 4k, arXiv 500, bib 1200 DOIs, 3 retry/bib passes) |
| `--target-pdfs 2000` | Stop when `ok` PDF count reaches N |
| `--target 2800` | Catalog entry ceiling (metadata + PDFs) |
| `--resume` | Skip one-time seed stages; keep discovery passes |
| `--max-passes 5` | Discovery loop iterations |
| `harvest verify` | Re-check ok PDFs on disk; downgrade invalid |
| `harvest enrich` | Backfill missing abstracts via OpenAlex (no downloads); run before `prune` |

**Query tags:** `layer-assignment`, `compound`, `constraints`, `compaction`, `packing`, `overlap`, `elk`, `sugiyama`, `crossing`, `grouped`, `ports`, `research-thread`

### Ingest

Extracts Markdown-aware structural blocks, targets ~800-token chunks (1200 hard max) with complete-paragraph overlap, deduplicates identical PDFs by SHA-256, then embeds and indexes LanceDB + BM25 under `data/indexes/{profile}/`.

```bash
uv run graph-layout-rag ingest status --embed-profile gemini-2-structure-v1 --json
uv run graph-layout-rag eval retrieval --embed-profile gemini-2-structure-v1 --json
```

### Chunking campaign profiles

The 2026-06-18 quality campaign keeps the production default unchanged and adds local-first A/B profiles:

- `cuda-qwen0.6b-section-v1`: default chunk boundaries, but indexed dense/BM25 text is prefixed with document title, year, authors, source URL, section path, categories, tags, and aliases.
- `cuda-qwen0.6b-small2big-v1`: smaller child chunks (`target=350`, `max=550`, `overlap=80`) with a distinct chunking fingerprint and extraction-cache key.
- `cuda-qwen0.6b-contextual-v1`: default chunking plus local-LLM contextual prefixes through `rag_common.local_llm` (`RAG_LLM_BACKEND=ollama` on `desktop`).

Build each as its own index and benchmark against neutral qrels:

```bash
RAG_EMBED_PROFILE=cuda-qwen0.6b-small2big-v1 uv run graph-layout-rag ingest --force --rebuild -v
uv run graph-layout-rag eval benchmark --embed-profile cuda-qwen0.6b-small2big-v1 \
  --qrels data/eval/qrels/catalog/qrels.json --strategy dense --strategy bm25 --strategy hybrid --report -v
```

Campaign report: [docs/rag/graph-layout-rag-quality-campaign-2026-06-18.md](../../docs/rag/graph-layout-rag-quality-campaign-2026-06-18.md).

Current result: `cuda-qwen0.6b-section-v1` is built and synced, but is not promoted as the default because its PDF nDCG gain is offset by a catalog regression.

**2026-06-23 follow-up campaign** (porting rag-literature-rag's wins): weighted-RRF fusion
(`dense_weight=1.0, sparse_weight=2.0`, promoted as the new default in `query/hybrid.py`) and a
full `cuda-qwen0.6b-contextual-v1` build/benchmark (4501 docs, 0 errors) — contextual regresses
both tracks vs. the plain baseline and vs. `section-v1`, so it stays a non-default profile.
Full writeup: [docs/quality-campaign-2026-06-23.md](docs/quality-campaign-2026-06-23.md).

## Retrieval benchmark

The production query default is **hybrid retrieval**: Gemini dense search fused with Tantivy BM25 using RRF `k=20` over a pool of ≥80 fused candidates (both tuned on the de-biased qrels). On a **de-biased, multi-system-pooled + LLM-judged** gold set, hybrid is the measured winner on both tracks (catalog 0.768 / pdf 0.715 nDCG@10); BM25 alone is mid-pack and dense converges with it. HyDE query expansion wins the pdf track. Local reranking is off by default (no gain, higher memory). Full results, methodology, and the pooling-bias correction that overturned the earlier "BM25 wins" verdict: [the bake-off report](../../docs/graph-layout-rag-architecture-bakeoff-2026.md).

Validate labels before comparing retrieval strategies:

```bash
uv run graph-layout-rag eval validate-gold --json
```

Run the hardware-safe current-index benchmark. Each strategy runs in an isolated subprocess and writes resumable results under `data/eval/runs/`:

```bash
yarn graph-rag:eval -- \
  --embed-profile gemini-2-structure-v1 \
  --no-llm-transforms --report -v
```

Paid Google Ranking API strategies require explicit opt-in and default to a 500-unit hard cap:

```bash
yarn graph-rag:eval -- \
  --embed-profile gemini-2-structure-v1 \
  --strategy hybrid_google_fast --strategy hybrid_google_default \
  --cloud-rerank --allow-cloud-cost --max-cloud-ranking-units 500 --report -v
```

Optional learned sparse and late-interaction experiments always create new, immutable indexes:

```bash
uv sync --extra retrieval-experiments
# ColBERT/SPLADE need a Docker Qdrant server (local-mode multivector OOMs 24 GB):
docker run -d --name graphrag-qdrant -p 6333:6333 qdrant/qdrant   # latest = 1.18.2
export GRAPH_RAG_QDRANT_URL=http://localhost:6333
uv run --with pylance --extra retrieval-experiments graph-layout-rag eval build-retrieval-index \
  --base-profile gemini-2-structure-v1 --kind splade
uv run --with pylance --extra retrieval-experiments graph-layout-rag eval build-retrieval-index \
  --base-profile gemini-2-structure-v1 --kind colbert
```

**Remote GPU box (Ubuntu + RTX 3060 Ti, SSH-only):** use `retrieval-experiments-gpu` (fastembed-gpu + sentence-transformers). Cannot install alongside CPU `fastembed` in the same venv.

```bash
# On Ubuntu after ssh user@gpu-host
cd ~/excalidraw-tf/tools/graph-layout-rag
uv sync --extra retrieval-experiments-gpu
export GRAPH_RAG_QDRANT_URL=http://127.0.0.1:6333
export GRAPH_RAG_ENCODE_DEVICE=cuda
uv run python scripts/bench_encode_device.py --sample 512 --batch-size 8 --models splade,colbert,splade_v3
```

| Kind | Default (small) | Recommended upgrade | VRAM batch hint (3060 Ti) |
| --- | --- | --- | --- |
| SPLADE | `prithivida/Splade_PP_en_v1` | `naver/splade-v3` (PyTorch) | batch 16–32 |
| ColBERT | `answerdotai/answerai-colbert-small-v1` | `jinaai/jina-colbert-v2` | batch 4–8 |
| ColBERT | — | `colbert-ir/colbertv2.0` | batch 8–16 |

Pass `--model` and `--encode-device cuda` to `eval build-retrieval-index`. SPLADE-v3 models (`naver/splade-v3`, `naver/splade-v3-distilbert`) use sentence-transformers SparseEncoder, not fastembed.

Mac ↔ Ubuntu sync: set `GRAPH_RAG_GPU_SSH` in `.env`, then `scripts/gpu_sync_to_remote.sh` / `scripts/gpu_sync_from_remote.sh`. Long encode jobs: `tmux new -s graphrag-encode` on Ubuntu. Full A/B matrix: `scripts/gpu_build_ab_indexes.sh`.

#### Local LLM transforms (Ollama on 3060 Ti)

HyDE and `--expand auto` use **Ollama on the GPU box** (`desktop` over SSH), not the Mac. Dense embed stays on CUDA (`cuda-qwen0.6b-1024`). See [local LLM benchmark doc](../../docs/graph-layout-rag-local-llm-benchmark-2026.md).

**Verdict (2026-06-17 shootout on desktop):** local HyDE did **not** beat cuda hybrid on neutral qrels (baseline **0.715 / 0.684** nDCG@10). Default remains **`hybrid` without LLM**. If you enable the router, set `RAG_OLLAMA_MODEL=gemma4:e4b` on the box; avoid `qwen3.5:9b` co-load on 8 GB (HyDE workers crash).

| Model      |   catalog router |       pdf router | p95 (router) |
| ---------- | ---------------: | ---------------: | -----------: |
| gemma4:e4b |            0.710 |            0.678 |  ~330–430 ms |
| gemma4:e2b |            0.705 |            0.659 |  ~330–430 ms |
| qwen3.5:9b | 0.715 (= hybrid) | 0.684 (= hybrid) |        ~11 s |

```bash
# One-time on desktop (sudo):
ssh desktop 'curl -fsSL https://ollama.com/install.sh | sh && sudo systemctl enable --now ollama'

# From Mac: sync cuda index + run model shootout on desktop
cd tools/graph-layout-rag
./scripts/gpu_execute_local_llm_benchmark.sh
./scripts/gpu_sync_from_remote.sh   # when tmux job finishes (grep LOCAL_LLM_BENCHMARK_DONE on desktop)
```

On `desktop`, export `RAG_EMBED_PROFILE=cuda-qwen0.6b-1024` before benchmark — `gpu_local_llm_benchmark.sh` preserves an explicit profile over `.env` defaults.

Query with auto HyDE (after setting `RAG_LLM_BACKEND=ollama` on the box):

```bash
uv run graph-layout-rag query "why so tall" --expand auto --json
uv run graph-layout-rag query "VPSC constraints" --pdf-only --expand auto --json
```

#### De-biased evaluation (multi-system pooling)

⚠️ Never expand the gold set from a single retriever — that caused **pooling bias** and a false "BM25 wins" verdict (see the bake-off report). The gold set is now backed by diverse-pool + LLM-judged qrels at `data/eval/qrels/<track>/qrels.json`; benchmark with `--qrels`. Build/refresh them with:

```bash
uv run graph-layout-rag eval pool  --track catalog --embed-profile gemini-2-structure-v1 \
  --system bm25 --system dense --system hybrid --system hyde --system multi_query \
  --system splade --system colbert --splade-index <dir> --colbert-index <dir>
uv run graph-layout-rag eval judge --track catalog               # gemini-3.1-pro, source-blind, cached
uv run graph-layout-rag eval diagnostics --track catalog --embed-profile gemini-2-structure-v1 \
  --qrels data/eval/qrels/catalog/qrels.json --strategy bm25 --strategy dense --strategy hybrid
uv run graph-layout-rag eval benchmark --embed-profile gemini-2-structure-v1 \
  --qrels data/eval/qrels/catalog/qrels.json --report -v
```

```bash
uv run graph-layout-rag ingest -v           # incremental (resume) — default after first build
uv run graph-layout-rag ingest --force      # re-embed all docs (keep existing LanceDB rows)
uv run graph-layout-rag ingest --rebuild    # drop vector table, recreate on first batch
uv run graph-layout-rag ingest --force --rebuild   # full rebuild (required after embed model change)
```

Local PDF extraction (`pymupdf` or `docling`) runs in a bounded process pool while the parent process embeds and checkpoints completed documents. `GRAPH_RAG_EXTRACT_WORKERS` defaults to `4`; `0` or `1` selects serial extraction. Completed outcomes cross a bounded `GRAPH_RAG_EXTRACT_QUEUE_DOCS` queue (default `2 * GRAPH_RAG_INGEST_DOC_BATCH`), so a slow embedding batch cannot buffer the corpus in memory. Gemini PDF extraction stays serial at the document level because it already parallelizes page API calls internally.

Docling is configured with:

```bash
GRAPH_RAG_PDF_BACKEND=docling
GRAPH_RAG_DOCLING_OCR=0
GRAPH_RAG_DOCLING_TABLES=1
GRAPH_RAG_DOCLING_TIMEOUT_S=600
GRAPH_RAG_DOCLING_DEVICE=auto
GRAPH_RAG_DOCLING_THREADS=2
GRAPH_RAG_INGEST_DOC_BATCH=25
GRAPH_RAG_EXTRACT_QUEUE_DOCS=50
```

Each extraction process caches one Docling `DocumentConverter`. Invalid Docling option values log a warning and use the defaults above.

#### Resume / checkpointing (no `--resume` flag)

Ingest checkpoints **per batch** (every `GRAPH_RAG_INGEST_DOC_BATCH` docs, default 25):

1. Chunks flushed to **`data/indexes/{profile}/lancedb/`**
2. Doc ids + sha256 saved to **`data/indexes/{profile}/ingest_state.json`**

**Stop anytime** (`Ctrl+C`). At most one in-flight batch (~≤10 docs) is lost and re-embedded on resume.

**Resume later** (same `.env` embed config — do **not** pass `--force` or `--rebuild`):

```bash
cd tools/graph-layout-rag
uv run graph-layout-rag ingest -v 2>&1 | tee -a data/ingest-run.log
```

Already-indexed docs are skipped when manifest `sha256` matches `ingest_state.json`. Harvest uses `--resume`; ingest uses **incremental mode by default**.

#### Progress and ETA

The ingest process writes atomic live telemetry to `data/indexes/{profile}/ingest_status.json`. It reports the current phase, canonical document totals, processed versus fully checkpointed documents, queued batch work, elapsed time, throughput, and a blended ETA:

```bash
uv run graph-layout-rag ingest status --embed-profile mlx-qwen4b
uv run graph-layout-rag ingest status --embed-profile mlx-qwen4b --json
tail -f data/ingest.log
```

INFO progress logs are emitted every 25 canonical documents or 30 seconds by default. Tune them with `GRAPH_RAG_INGEST_PROGRESS_LOG_EVERY` and `GRAPH_RAG_INGEST_PROGRESS_LOG_INTERVAL_S`. Local embedding progress also reports text throughput and an ETA for the active batch.

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
GRAPH_RAG_INGEST_DOC_BATCH=10       # optional lower-memory override for local MPS embedding
```

Or legacy env:

```bash
RAG_EMBED_BACKEND=local
RAG_LOCAL_EMBED_MODEL=Qwen/Qwen3-Embedding-4B
RAG_LOCAL_EMBED_DIMS=1024
RAG_LOCAL_EMBED_QUANT=4bit          # MLX via mlx-embeddings (~2.1 GB weights)
```

Requires `rag-common[mlx]` — run `uv sync --extra mlx` (opt-in, Apple Silicon only). Progress: `data/ingest.log` and stderr (`embed progress: N/M texts (... texts/s, eta ...)`). Use `-v` for per-doc extraction logs.

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

**Concurrency (gemini-2):** Vertex embeds one instance per request, so throughput comes from concurrent requests, not batching. Ingest fans `embed_content` calls across `GRAPH_RAG_WORKERS` threads (default 48 for Gemini) that share the adaptive rate limiter — order is preserved. Raise `GRAPH_RAG_WORKERS` to speed a full `--rebuild` as long as the TPM budget below stays the binding throttle.

**Adaptive rate limiting (gemini-2):** ingest paces `embed_content` to a sliding tokens-per-minute budget so Vertex 429s are rare. Tune in `.env` after checking [Vertex quotas](https://cloud.google.com/vertex-ai/docs/generative-ai/quotas-genai):

```bash
RAG_GEMINI_TOKENS_PER_MIN=2000000
RAG_GEMINI_RATE_HEADROOM=0.95
RAG_GEMINI_MIN_INTERVAL_MS=5
GRAPH_RAG_WORKERS=48                 # concurrent embed requests (shares the TPM budget)
```

Learned budget persists in `~/.cache/rag-common/gemini_rate_state.json` across resume runs. After increasing quota, remove that file once so an older reduced budget does not constrain the new run. **Resume after interrupt** (keeps indexed chunks — no `--force` / `--rebuild`):

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

Retrieval is **hybrid by default**: dense vectors (LanceDB cosine) fused with BM25 lexical hits (Tantivy) via reciprocal rank fusion, then optionally reranked by a local cross-encoder. Query results are grouped by canonical paper identity (DOI, PDF SHA-256, local path, and provider external ids) and retain the top evidence passages for that paper. `year_min` is pushed into dense search; other selective filters widen the retrieval pool before post-fusion filtering.

Canonical grouping is derived from the current manifest at query time. It does not require re-ingesting an existing index when aliases are added or merged. `doc_id` remains the id of the winning indexed row; use `canonical_doc_id` as the paper-level identity and `alias_doc_ids` to resolve alternate metadata or local PDF records.

JSON output for LLM agents:

```bash
uv run graph-layout-rag query "dot algorithm network simplex" --top 5 --json
uv run graph-layout-rag query "constraint graph one-dimensional compaction" --tag compaction --json
uv run graph-layout-rag query "left edge algorithm channel routing" --tag packing --json
uv run graph-layout-rag query "VPSC separation constraints overlap removal" --tag constraints --json
uv run graph-layout-rag query "left edge channel assignment" --category packing --pdf-only --json

# Retrieval controls
uv run graph-layout-rag query "stress majorization neato" --rerank --json   # cross-encoder rerank
uv run graph-layout-rag query "stress majorization neato" --no-hybrid --json # dense-only (skip BM25)
```

| Flag / env | Effect |
| --- | --- |
| `--hybrid` / `--no-hybrid` | Fuse BM25 + dense (default on). Degrades to dense if no BM25 index yet. |
| `--rerank` / `--no-rerank` | Local cross-encoder rerank, overrides `RAG_RERANK_ENABLED`. |
| `--max-per-doc` | Maximum evidence passages nested under each canonical paper result. |
| `RAG_RERANK_ENABLED=true` | Default-on reranking without the flag. |
| `RAG_RERANK_MODEL` | Cross-encoder id (default `BAAI/bge-reranker-v2-m3`; downloads on first use). |
| `RAG_RERANK_TOP` | Override the number of reranked results returned. |

JSON results gain `canonical_doc_id`, identity aliases, nested `evidence`, `dense_rank` / `sparse_rank` (fusion provenance), `fusion_score`, `rerank_score` (when reranked), and `page_end` (chunk page span). Reranking is **off by default**; run it on demand. **Do not rerank while ingest is running** on a 24 GB Mac — loading the cross-encoder alongside the embed model risks OOM.

Representative result:

```json
{
  "score": 0.032522,
  "title": "A Technique for Drawing Directed Graphs",
  "excerpt": "The rank assignment is formulated...",
  "page": 20,
  "page_end": 21,
  "doc_id": "gansner-tse93",
  "canonical_doc_id": "gansner-tse93",
  "alias_doc_ids": ["graphviz-a-method-for-drawing-directed-graphs"],
  "evidence": [
    {
      "excerpt": "The rank assignment is formulated...",
      "page": 20,
      "page_end": 21,
      "section_path": "4. Rank assignment",
      "chunk_id": "gansner-tse93:20:0",
      "score": 0.032522
    },
    {
      "excerpt": "The network simplex procedure...",
      "page": 22,
      "page_end": 22,
      "section_path": "4. Rank assignment",
      "chunk_id": "gansner-tse93:22:0",
      "score": 0.031746
    }
  ]
}
```

`--top` counts canonical papers. `--max-per-doc` controls the number of evidence passages nested under each paper. The top-level excerpt/page mirror the highest-ranked evidence passage for compatibility with existing callers.

> **Rebuild note:** the BM25 index, chunk page-spans, and the enriched gemini-2 embed bodies are produced during ingest. To populate them on an existing corpus, run `ingest --force --rebuild` once. Until then, `--hybrid` falls back to dense-only.

### Related papers

Use citation structure when starting from a known paper rather than a topic query:

```bash
uv run graph-layout-rag cite related gansner-tse93 --signal fused --top 10 --json
```

`cite related` accepts either a canonical or alias `doc_id`. It checks all ids in the canonical identity component for a citation-graph node and deduplicates returned neighbors to canonical papers. The default fused signal combines co-citation, undirected personalized PageRank, bibliographic coupling, and a light citation-trained embedding signal. Keep this separate from topic `query` ranking; citation relatedness did not improve query relevance in the current evaluation.

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
- `data/trusted_venue_checkpoint.json` — completed DROPS volumes and JGAA issues
- `data/harvest.log` — harvest run log
- `data/ingest.log`, `data/ingest-run.log` — ingest structured log / tee output
- `.venv/`, `.env`

## Copyright

Harvest attempts legal open-access downloads only. Paywalled books remain metadata stubs. Do not commit harvested PDFs or LanceDB indexes to git.

## Agent handoff

When debugging Terraform pipeline vertical height or researching layout algorithms, run query before deep-diving source papers. See `.agents/skills/graph-layout-rag/SKILL.md`.

Full architecture (harvest, ingest, query, tests): [ARCHITECTURE.md](./ARCHITECTURE.md)
