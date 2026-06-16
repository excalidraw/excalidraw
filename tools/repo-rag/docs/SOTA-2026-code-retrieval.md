# SOTA-2026 code retrieval — research synthesis + repo-rag roadmap

How agents should query a large codebase efficiently, what the 2025–2026 literature converged on, and how each finding maps onto **repo-rag** (`tools/repo-rag` + `tools/rag-common`). Measured results on this repo are in [Measured results](#measured-results-this-repo).

> TL;DR — repo-rag was already aligned with best practice on the big structural choices (AST chunking + hybrid BM25/dense + RRF k=60 + a deterministic AST code graph). The open gains are: cross-encoder reranking (**only helps when fed file path + symbol** — proven on this corpus), Anthropic-style contextual retrieval, a real eval harness (now built), an MCP/agentic surface, and code-specialized embeddings.

## 1. Hybrid retrieval + Reciprocal Rank Fusion is the validated baseline

AST-boundary chunking + BM25 fused with dense vectors via **Reciprocal Rank Fusion (RRF)** gives the highest end-to-end retrieval accuracy in current evaluations. RRF discards raw scores and fuses by rank: `score(d) = Σ 1/(k + rank_i(d))`. The constant `k = 60` from the 2009 Cormack paper remains the robust, tuning-free community default — it needs no labeled data to calibrate, unlike a weighted linear blend.

- **Why both:** BM25 nails exact tokens — symbol names, file paths, error strings, config keys. Dense vectors capture intent and synonyms in prose (docs, handoffs).
- **repo-rag:** already correct — `query/hybrid.py` (`RRF_K = 60`), fusing LanceDB cosine (`query/search.py::_dense_search`) with Tantivy BM25 (`ingest/bm25.py::search_bm25`), each retrieving 40 candidates. **No change needed to the fusion core.**

## 2. Cross-encoder reranking — "retrieve wide, rerank narrow" (with a code caveat)

A bi-encoder embeds query and document independently; a **cross-encoder** scores the _pair_ in one forward pass, so it judges relevance far more precisely — at higher latency. The standard pattern: retrieve a wide candidate set, then rerank the top ~20–40.

Anthropic's Contextual Retrieval study: contextual embeddings cut top-20 retrieval failure ~35%; **adding reranking pushes the combined reduction to ~67%**. Strong 2026 local models:

| Model | Notes |
| --- | --- |
| `BAAI/bge-reranker-v2-m3` | Apache-2.0, ~50–100ms GPU, single forward pass, 100+ langs |
| `Qwen3-Reranker-4B` | higher ceiling, ~4.5× latency (causal-LM scoring) |
| Cohere Rerank 3 / 3 Nimble | API, strong but hosted |

- **repo-rag:** `rag-common/rerank.py` already implements bge-reranker-v2-m3 (MPS-aware, lru-cached, graceful-degrading). It was **built but never called** by `search()`. Now wired in (`query/search.py`), opt-in via `--rerank` / `RAG_RERANK_ENABLED`.
- **Code caveat (measured here):** a _generic_ text reranker fed only the raw chunk body **hurt** this corpus (nDCG 0.68 → 0.61) — it reshuffles on prose similarity and demotes exact-symbol matches that BM25+dense already ranked well. This is the same dynamic behind the industry's "grep beat embeddings" reports. **Fix:** prepend `file_path` + `symbol` to the reranker input so it sees the structural signal code relevance hinges on. That flipped the result to a net win (MRR +0.048, nDCG +0.018). See [Measured results](#measured-results-this-repo).

## 3. Contextual Retrieval (Anthropic) — contextual embeddings + contextual BM25

Independently-embedded chunks lose surrounding context. The fix: prepend an LLM-generated 1–2 sentence blurb situating each chunk within its file/module **before** embedding _and_ before BM25 indexing ("Contextual Embeddings" + "Contextual BM25"). Reported ~35% (49% with contextual BM25) fewer retrieval failures. **Prompt caching** on the document body makes the one-time generation cheap.

- **repo-rag today:** `chunk/prefix.py` prepends only _static metadata_ (file/package/symbol comments) — a weak proxy. Real per-chunk contextualization is the next embedding-side lift.
- **Cheaper alternative — late chunking** (Jina, arXiv 2409.04701): embed the whole file with a long-context model, then pool per-chunk _afterward_ so each chunk carries document context. Training-free, no LLM cost. Good fit if the LLM contextualization bill is unwanted.

## 4. Agentic search is the 2026 paradigm shift — index as seed, not oracle

In 2025 Anthropic removed vector search from Claude Code, replacing the embedding pipeline with grep + tool-calling ("outperformed everything, by a lot"); Cursor, Windsurf, Cline, Devin, Sourcegraph Amp followed. The lesson (Augment's SWE-Bench work): _boring_ lexical + symbol navigation beats clever vector retrieval when the answer hinges on exact symbols, because an agent can **iterate** — grep → read → follow imports → refine — and chase `handler.ts → utils/auth.ts → lib/jwt.ts`, which a one-shot top-k cannot.

This does **not** mean delete the index. It means position retrieval as a fast **seed + navigate** layer an agent loops over, not a one-shot answer box.

- **repo-rag:** already shaped for this — `search` seeds, then `symbol` / `neighbors` / `context` (`graph.py`, `context.py`) navigate the AST graph. The remaining step is to **expose these as MCP tools** so an agent can drive the loop directly (Track 3).

## 5. Deterministic AST graphs beat LLM-extracted knowledge graphs

_Reliable Graph-RAG for Codebases_ (arXiv 2601.08773) compared AST-derived graphs vs LLM-extracted KGs vs vector-only on real Java repos: the **AST graph builds in seconds** (vs minutes), gives more complete coverage (LLM extraction silently skipped hundreds of files), costs far less, and scores highest correctness with the lowest hallucination. Vector-only was worst on architectural / multi-hop queries. Other systems (RepoHyper, dataflow-guided completion, tree-sitter CodeRAG) reach the same conclusion: parse to entities + relations, retrieve best chunks **plus their graph neighbors**.

- **repo-rag:** validates the SQLite AST graph (`graph.sqlite`: nodes/edges, `imports` / `calls` / `contains` / `tests`). One weakness — edges are **regex-extracted**; moving import/call edges onto the tree-sitter AST already parsed in `chunk/ast_ts.py` would raise `neighbors` / `context` precision (Track 3 stretch).

## 6. Code-specialized embeddings beat general text models

On MTEB-Code, code-tuned embedders lead general ones by ~4–6 points: **Qwen3-Embedding-8B** (~80.7 MTEB-Code), Voyage-code, NV-Embed-v2, BGE-M3. General `text-embedding-3-large` is a fine default but leaves code-retrieval accuracy on the table.

- **repo-rag:** the profile system (`rag-common/embed_profiles.toml`, `mlx-qwen4b` etc.) already supports swapping embedders. Add a code-specialized profile and benchmark it with the harness before changing the default (Track 3).

---

## Roadmap status

| Track | Item | Status |
| --- | --- | --- |
| 0 | Real eval harness — Hit@k / MRR / nDCG@k + `--compare` | **Done** (`eval.py`, `tests/test_eval.py`) |
| 1 | Wire cross-encoder reranker into `search()`, code-aware input | **Done** (`query/search.py`, `--rerank`) |
| 2 | Contextual retrieval (contextual embeddings + BM25) | **Done** (`chunk/contextualize.py`, `index --contextual`) |
| 3a | MCP server (seed→navigate loop) | **Done** (`mcp_server.py`, `repo-rag mcp`) |
| 3b | Code-specialized embed profile | **Done** (`qwen3-code`, native 2560-dim Qwen3-Embedding-4B) |
| 3c | AST-edge graph (tree-sitter import/call edges over regex) | Deferred — see note below |

**Track 2 (contextual retrieval).** `chunk/contextualize.py` generates a 1-2 sentence situating blurb per chunk, prepended in `chunk/prefix.py` so it flows into both the embedding text and the Tantivy BM25 index. LLM path: Claude Haiku (`claude-haiku-4-5`) with **prompt caching on the file body** (a file's chunks are processed consecutively so the cached document prefix is reused) — `uv sync --extra contextual` for the SDK. No-LLM fallback: the file's leading comment block. Gated behind `index --contextual` (recorded in `ingest_state`), default off, needs `--force --rebuild`. _Measuring the retrieval lift requires `ANTHROPIC_API_KEY` + a contextual reindex; the pipeline is unit- and functional-tested (`tests/test_contextualize.py`)._ Cheaper no-LLM alternative if the contextualization bill is unwanted: late chunking (arXiv 2409.04701).

**Track 3a (MCP).** `repo-rag mcp` (stdio, `uv sync --extra mcp`) exposes `search`/`symbol`/`neighbors`/`context`/`read` as MCP tools — thin wrappers over the existing functions — so an agent drives the seed→navigate loop directly. The index stays the fast seed/graph layer; the agent supplies the iteration.

**Track 3c (deferred, with rationale).** `graph.py` extracts import/call edges with regex. A tree-sitter rewrite would raise `neighbors`/`context` precision, but the regex graph is functional (17k nodes / 73k edges, validated by `neighbors`/`context`), and the literature validates the _deterministic-AST-graph approach_ — which repo-rag already embodies — more than the extraction mechanism. Left as a scoped, test-heavy follow-up rather than a rushed refactor; the chunker (`chunk/ast_ts.py`) already parses the AST the edges would reuse.

## Measured results (this repo)

Index: `gemini-2` (gemini-embedding-2-preview, 3072d), 10 judged queries, k=10. Run: `uv run repo-rag eval benchmark --compare` (reranker `bge-reranker-v2-m3`, MPS).

| Variant | Hit@10 | MRR | nDCG@10 | mean latency |
| --- | :-: | :-: | :-: | :-: |
| Hybrid + RRF (baseline) | 0.90 | 0.637 | 0.680 | ~1.2 s |
| + rerank on **raw chunk text** | 0.80 | 0.622 | 0.610 | ~3.2 s |
| + rerank on **path + symbol + text** | 0.90 | **0.684** | **0.698** | ~3.1 s |

**Takeaways:** (1) the eval harness paid for itself immediately — it caught that naive reranking _degrades_ this corpus; (2) reranking is a net win **only** when the cross-encoder receives the structural header; (3) it roughly doubles latency, so keep it **opt-in** (it is — default off) and reserve it for precision-sensitive queries. Re-validate after any embed profile or query-set change.

## How to reproduce

```bash
cd tools/repo-rag
uv run repo-rag eval benchmark --no-rerank          # baseline metrics
RAG_RERANK_ENABLED=1 uv run repo-rag eval benchmark --compare   # off vs on delta
uv run repo-rag query "<task>" --rerank --json      # ad-hoc reranked query
```

## Sources

- _RAG Is Not Always the Answer: How AI Agents Search Code in 2026_ (dev.to/nimay_04)
- Augment — _Why Grep Beat Embeddings in Our SWE-Bench Agent_ (567-labs / systematically-improving-rag)
- Anthropic — _Introducing Contextual Retrieval_ (platform.claude.com cookbook)
- RRF k=60 origin + practice — Cormack 2009; Weaviate / Elastic hybrid-search guides
- Reranker benchmarks 2026 — bge-reranker-v2-m3, Qwen3-Reranker; _Qwen3 Embedding_ (arXiv 2506.05176)
- _Reliable Graph-RAG for Codebases: AST-derived vs LLM-extracted graphs_ (arXiv 2601.08773)
- _Late Chunking_ (arXiv 2409.04701, Jina) · RepoHyper (arXiv 2403.06095) · MTEB-Code leaderboard 2026
