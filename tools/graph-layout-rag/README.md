# Graph layout RAG

Local research corpus for graph drawing and layout theory (Graphviz dot/neato, Sugiyama layering, stress majorization, handbook chapters, OpenAlex/DBLP metadata). Used by agents researching Terraform pipeline layout height and graph layout algorithms.

## Setup

Requires Python 3.11+ and [uv](https://github.com/astral-sh/uv).

```bash
cd tools/graph-layout-rag
uv sync
```

First ingest downloads the `all-MiniLM-L6-v2` embedding model (~90MB).

## Pipeline

```bash
# From repo root (yarn wrappers)
yarn graph-rag:harvest
yarn graph-rag:ingest
yarn graph-rag:query "layered graph drawing rank assignment" --top 8 --json

# Or directly
uv run graph-layout-rag harvest --max-openalex 50   # faster first pass
uv run graph-layout-rag ingest
uv run graph-layout-rag query "stress majorization neato" --top 5 --json
```

### Harvest

Downloads PDFs and metadata into `data/manifest.json` and `data/raw/`. Sources:

- [graphviz.org/theory](https://graphviz.org/theory/) — classic dot/neato papers
- [GD Handbook](https://cs.brown.edu/people/rtamassi/gdhandbook/) — chapter PDFs
- **Topic seeds** — ELK/Mermaid ([arXiv:2311.00533](https://arxiv.org/abs/2311.00533)), Sugiyama, Sander compound graphs, Stratisfimal, layer reassignment, constraints
- **ELK bibliography** — DOIs from the ELK survey paper
- OpenAlex (paginated, topic queries + graph-drawing concept filter) + DBLP + Semantic Scholar
- **arXiv** (cs.CG / cs.DS graph layout queries)
- Bibliography chain from seed PDFs (relevance-filtered DOIs)
- Paywalled books as `metadata_only` stubs

```bash
# Scale toward ~2k PDFs (multi-pass, resumable — may take several hours)
uv run graph-layout-rag harvest --deep-harvest --target-pdfs 2000 --workers 48 --resume -v
uv run graph-layout-rag harvest verify
uv run graph-layout-rag ingest --force

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

**Query tags:** `layer-assignment`, `compound`, `constraints`, `elk`, `sugiyama`, `crossing`, `grouped`, `ports`

### Ingest

Extracts text with PyMuPDF, chunks (~4000 chars, 600 overlap), embeds with sentence-transformers, indexes in LanceDB at `data/lancedb/`.

```bash
uv run graph-layout-rag ingest          # incremental by sha256
uv run graph-layout-rag ingest --force    # re-process all
```

### Query

JSON output for LLM agents:

```bash
uv run graph-layout-rag query "dot algorithm network simplex" --top 5 --json
uv run graph-layout-rag query "stress majorization" --tag neato --json
uv run graph-layout-rag query "compound graph port constraints ELK" --tag compound --json
```

## Gitignored data

- `data/raw/` — downloaded PDFs
- `data/lancedb/` — vector index
- `data/manifest.json` — harvest output
- `data/ingest_state.json` — incremental ingest state
- `.venv/`

## Copyright

Harvest attempts legal open-access downloads only. Paywalled books remain metadata stubs. Do not commit harvested PDFs or LanceDB indexes to git.

## Agent handoff

When debugging Terraform pipeline vertical height or researching layout algorithms, run query before deep-diving source papers. See `.agents/skills/graph-layout-rag/SKILL.md`.
