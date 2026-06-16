# Graph Layout RAG — 2026 SOTA Architectures & Roadmap (two query paths, beyond RAG)

Date: 2026-06-15 · Scope: deep review of state-of-the-art retrieval / related-paper / agentic architectures, mapped onto this repo's two query paths, with a prioritized "implement-all-and-compare" roadmap.

Companion docs: [search eval + SOTA review](graph-layout-rag-search-eval-and-sota-2026.md) · [retrieval benchmark assessment](graph-layout-rag-retrieval-benchmark-assessment.md). Judge of record for every experiment below = the expanded gold set (`eval/gold_cases.py`, **49 cases / 112 relevant docs**) for search, and leave-one-out (`eval/related_eval.py`) for related.

---

## 0. TL;DR

- **You are not behind.** Your search path (Gemini dense + Tantivy BM25 + RRF) is the same first stage that **PaperQA2** uses to achieve _superhuman_ scientific synthesis. Your related path (Personalized PageRank over a citation graph) is the same core that **HippoRAG 2** uses for memory. The frontier is mostly about _what you add on top_, not replacing what you have.
- **The single biggest "beyond RAG" lever is an agentic / iterative loop** (decompose → gather evidence → contextual-summary rerank → iterate) that uses your two existing paths as tools. This is where the quality ceiling is for an agent-consumed research assistant.
- **Within RAG**, three cheap-to-strong upgrades: wire your already-built **query transforms** into `search()`; pilot **contextual-retrieval** chunk augmentation; replace the (proven-harmful) pointwise cross-encoder with a **listwise LLM reranker**.
- **The flashiest options are the most conditional.** ColBERT/ColPali (late interaction) is a real lever — especially OCR-free retrieval of figures/tables/equations from your diagram-heavy corpus — but it's an experimental-index A/B, not a default swap. Graph-for-_search_ (GraphRAG) **often underperforms vanilla RAG** per GraphRAG-Bench (ICLR'26); treat the HippoRAG-style unification as a gated research bet.
- **Recommended order:** (1) strengthen the two-stage pipeline, (2) agentic loop, (3) late-interaction/ColPali index, (4) PPR/graph-memory unification. Build all four as A/B arms; let the expanded gold set decide.

---

## 1. Capability map (current → frontier → next step)

| Capability | You have | 2026 frontier | Recommended next |
| --- | --- | --- | --- |
| Dense embeddings | Gemini Embedding 2 @ 3072 | Gemini-001 #1 MTEB ~68.3; Qwen3-Embedding-8B / NV-Embed / Llama-Embed-Nemotron close behind (open weights converged) | Keep Gemini; note self-host fallback |
| Lexical | Tantivy BM25 | BM25 + learned sparse (SPLADE-v3) | Add SPLADE as 3rd fusion arm (experiment) |
| Fusion | RRF k=60 | RRF / weighted / learned fusion | Keep; test dense-weighted RRF |
| Chunking | `markdown-structure-v1` + static section/topic/tags | Contextual Retrieval, late chunking, RAPTOR | Contextual-retrieval experimental index |
| Reranking | pointwise cross-encoder (off by default — _hurts here_) | listwise LLM (RankZephyr/FIRST/E²Rank/jina-v3), Qwen3-Reranker | Listwise reranker A/B; lift char cap |
| Query understanding | none in default path (transforms exist, unused) | HyDE, step-back, multi-query, decomposition | Wire transforms into `search()` |
| Multi-vector / visual | none | ColBERTv2, ColPali/ColQwen (OCR-free PDF) | Experimental late-interaction index |
| Related / recommend | co-citation + PPR + coupling + SciNCL/SPECTER2 | same pattern is SOTA; PPR-over-graph memory | Add `is_influential` + co-author ablations |
| Orchestration | single-shot per path | agentic deep research (PaperQA2, Search-o1) | Agentic loop over both paths |

---

## 2. Search path — SOTA, mapped to your code

### 2.1 Embeddings (no urgent change)

Google **Gemini Embedding 001** leads English MTEB (~68.32); open-weight **Qwen3-Embedding-8B** (Apache-2.0, +6 MTEB over OpenAI), **NV-Embed**, and **Llama-Embed-Nemotron-8B** (top multilingual) have converged with the proprietary APIs. Your `gemini-2-structure-v1` (Gemini Embedding 2 @ 3072) sits at the frontier. _Action: none required; record Qwen3-Embedding-8B as the self-host escape hatch if Vertex cost/latency becomes a problem._ ([MTEB 2026](https://app.ailog.fr/en/blog/news/rag-benchmark-mteb-2026), [embedding models 2026](https://app.ailog.fr/en/blog/news/embedding-models-2026))

### 2.2 Chunk augmentation — Contextual Retrieval ≫ late chunking / RAPTOR for quality

- **Contextual Retrieval** (Anthropic): prepend a 50–100 token LLM-generated context to each chunk before embedding _and_ BM25 indexing; ~35% → ~49% fewer retrieval failures. Your chunker already injects section/topic/tags (a static analog), so you're well-positioned to extend it.
- **Late chunking** (Jina): cheaper, but "tends to sacrifice relevance and completeness."
- **RAPTOR**: recursive summary tree; beats BM25 by 5–10 F1 on long-doc QA, but heavier.
- 2026 practitioner guidance: start with token-accurate recursive splits; graduate to contextual/hierarchical only when metrics justify the cost. _Action: build one immutable contextual-retrieval experimental index, A/B vs production._ ([Anthropic cookbook](https://platform.claude.com/cookbook/capabilities-contextual-embeddings-guide), [chunking 2026](https://www.firecrawl.dev/blog/best-chunking-strategies-rag), [RAPTOR](https://proceedings.iclr.cc/paper_files/paper/2024/file/8a2acd174940dbca361a6398a4f9df91-Paper-Conference.pdf))

### 2.3 Late interaction / multi-vector — your biggest single-stage lever (conditional)

- **ColBERTv2**: per-token embeddings + MaxSim late interaction → near-cross-encoder accuracy at bi-encoder speed; 2-bit/1-bit quantization (256B → 20–36B/vector) solves the old storage problem; strongest **out-of-domain**.
- **ColPali / ColQwen2.5 / ColInternVL**: treat each PDF page as an image, 1,024 patch embeddings/page (32×32) projected to 128-d, ColBERT-style MaxSim — **no OCR**. Tops the ViDoRe benchmark. For a **graph-drawing corpus where the signal is often in figures, tables, and equations**, this is uniquely relevant. 2026 successors: CausalEmbed, ColParse, Ops-ColQwen3; LIR workshop @ ECIR 2026 signals this is the hot frontier. _Action: your repo already has the hook (`eval build-retrieval-index --kind colbert`, `benchmark --retrieval-index`); add a ColPali arm for visual pages._ ([Weaviate late interaction](https://weaviate.io/blog/late-interaction-overview), [ColPali](https://arxiv.org/abs/2407.01449), [ColPali on GPU 2026](https://www.spheron.network/blog/colpali-multimodal-document-rag-gpu-cloud/), [LIR @ ECIR 2026](https://arxiv.org/pdf/2511.00444))

### 2.4 Reranking — switch paradigm, don't just swap models

Your measured result (MiniLM/BGE cross-encoders _reduce_ quality and trip the swap guard) is consistent with where the field moved: **listwise LLM rerankers** now beat pointwise cross-encoders on nDCG@10.

- **RankZephyr / RankGPT** (listwise), **FIRST** (single-token listwise, faster), **E²Rank** (an embedding model reused as a listwise reranker, +4.06 nDCG@10 over RankQwen3 at 0.6B), **jina-reranker-v3** ("last but not late interaction" listwise), **REARANK** (RL reranking agent, robust out-of-domain).
- **Qwen3-Reranker** (0.6B/4B/8B, 32k context) is the strong open pointwise/pairwise default.
- Also: your reranker only sees the first 2000 chars (`rag_common/rerank.py:MAX_RERANK_CHARS`) — raise it so structured chunks aren't truncated. _Action: A/B a listwise reranker (E²Rank or jina-v3) and Qwen3-Reranker-0.6B over top-20; only promote if it clears the change bar on both tracks._ ([reranker guide](https://machinelearningmastery.com/top-5-reranking-models-to-improve-rag-results/), [E²Rank](https://arxiv.org/pdf/2510.22733), [jina-reranker-v3](https://arxiv.org/pdf/2509.25085), [empirical analysis](https://arxiv.org/pdf/2508.16757))

### 2.5 Query understanding — the cheapest real win

`query/transforms.py` already implements `multi_query_rewrites()`, `hyde_passage()`, `step_back_query()`, but they're only reachable via `--llm-transforms` benchmark strategies, not the default `search()`. Your `vague-*` gold cases fail precisely because no transform bridges colloquial symptoms ("why is my layout so tall") to the technical literature. _Action: gate transforms behind a low-confidence heuristic (short query / low top-1 fusion score / `--expand`)._ ([RAG patterns 2026](https://dev.to/young_gao/rag-is-not-dead-advanced-retrieval-patterns-that-actually-work-in-2026-2gbo))

### 2.6 Learned sparse (optional 3rd arm)

SPLADE-v3-style learned sparse adds a complementary signal to BM25+dense; your harness already supports a `splade` / `dense_splade` experimental index. Low priority but cheap to A/B.

---

## 3. Related path — SOTA

Your fused ranker (`citation_rank.py`: co-citation 1.5 ≫ PPR 0.6 > coupling 0.3 > embedding 0.15) is, per the 2026 literature, **the correct design**:

- **SPECTER2 / SciNCL remain the reference** citation-aware embeddings, and the literature confirms they capture **topical** proximity, **not** direct-citation link prediction — exactly what your leave-one-out A/B found (embeddings ~0.04–0.06 MRR alone). 2026 successors (citation-importance-aware representations, fine-grained knowledge-entity embeddings, Deep CCA citation recommendation) give only modest gains. Don't expect a citation-embedding upgrade to move link prediction.
- **GraphRAG / PPR fusion is the recommended pattern**: graph traversal _augments_ embeddings via additive scoring — your exact architecture.
- **Underused signals you already store**: the `is_influential` edge flag and the `authorship` co-author graph. _Action: add both as ablation arms in `eval related`; adopt only if they beat `related_v2`._

([SPECTER2](https://allenai.org/blog/specter2-adapting-scientific-document-embeddings-to-multiple-fields-and-task-formats-c95686c06567), [SciNCL](https://arxiv.org/pdf/2202.06671), [fine-grained 2026](https://arxiv.org/pdf/2601.19513), [DCCA citation rec](https://arxiv.org/pdf/2507.17603), [Neo4j GraphRAG](https://neo4j.com/blog/developer/unleashing-the-power-of-graphrag/))

---

## 4. Beyond RAG

### 4.1 Agentic / iterative retrieval — the headline upgrade

The frontier of research-assistant quality is **agentic RAG**: retrieval decisions embedded in the reasoning loop.

- **PaperQA2** (superhuman scientific synthesis; matches/exceeds PhD experts): architecture = **tantivy full-text + dense (metadata-aware) + LLM reranking with Retrieval-augmented Contextual Summarization (RCS)**, wrapped in an agent with tools (query rewrite, _gather evidence_, "get more if under-supported"). **You already have the tantivy + dense first stage.** The deltas are RCS reranking and the agent loop.
- **Search-o1 / Search-R1 / DeepResearcher / R1-Searcher**: reasoning models that interleave generation with retrieval, decompose multi-hop questions, and issue targeted follow-up queries (ReAct / Self-Ask / Self-RAG lineage). _Action (priority #2): a `deep_research` orchestrator that exposes `search_raw()` and `cite related` as tools, does query decomposition + RCS-style contextual summarization + iterate-until-supported._ ([PaperQA2](https://www.futurehouse.org/research-announcements/engineering-blog-journey-to-superhuman-performance-on-scientific-tasks), [Search-o1](https://arxiv.org/pdf/2501.05366), [RAG-Reasoning survey](https://arxiv.org/pdf/2507.09477))

### 4.2 Graph memory (HippoRAG 2) — gated

**HippoRAG 2** = dual-node KG (passage + phrase) + **Personalized PageRank** + LLM triple filtering; +7% on associative/multi-hop memory over the SOTA embedding model without regressing simple tasks. It is conceptually your `cite related` PPR, generalized to unify "about X" (search) and "related to Y" (related) in one substrate. **Caveat (decisive):** **GraphRAG-Bench (ICLR'26)** finds GraphRAG _frequently underperforms vanilla RAG_ on real tasks; its clear win is **multi-hop** (e.g., 91% vs vector-RAG 34% in one study), while flat methods (PageIndex) beat it on local fact retrieval (97% vs 72%). _Action (priority #4, gated): only pursue PPR-unification if your usage is multi-hop-heavy; prove it on the gold set before adopting._ ([HippoRAG 2](https://arxiv.org/abs/2502.14802), [GraphRAG-Bench](https://github.com/GraphRAG-Bench/GraphRAG-Benchmark), [when to use graphs](https://arxiv.org/pdf/2506.05690))

### 4.3 Long-context vs RAG / CAG — minor here

2026 consensus: **hybrid-tiered** — Cache-Augmented Generation (preload + KV-cache a stable core corpus) for the well-defined part, RAG for the large/fast-moving long tail. Your 2,349-PDF corpus is too big for pure CAG, but a stable "canonical seeds" subset could be CAG-preloaded for an agent's working context. Low priority. ([CAG vs RAG](https://arxiv.org/pdf/2412.15605), [VentureBeat](https://venturebeat.com/ai/beyond-rag-how-cache-augmented-generation-reduces-latency-complexity-for-smaller-workloads))

### 4.4 Generative retrieval (DSI) — watch, don't adopt

Differentiable Search Index (generate doc-IDs directly from a seq2seq model) is elegant but still struggles to scale to millions of passages and to handle a frequently-changing corpus like yours. Monitor; not actionable. ([DSI scaling](https://arxiv.org/pdf/2305.11841))

### 4.5 Reference systems & external eval targets

- **OpenScholar** (Ai2, _Nature_ 2026): 45M-paper datastore (~250M passage embeddings), trained retriever+reranker, **iterative self-feedback** generation; lifts citation-F1 dramatically (GPT-4o 0.1 → 39.5 with its pipeline). Closest large-scale analog to what you're building.
- **Ai2 Asta / AstaBench** (ICLR'26 oral): open agentic-science ecosystem + 2,400-problem benchmark across literature comprehension → code → discovery, built on a **Semantic Scholar MCP**. Use **ScholarQABench / AstaBench** as an _external_ yardstick beyond your in-corpus gold set, and the Semantic Scholar MCP as a possible tool for the agentic layer. ([OpenScholar](https://allenai.org/blog/openscilm), [Nature](https://www.nature.com/articles/s41586-025-10072-4), [Asta](https://allenai.org/blog/asta), [AstaBench](https://github.com/allenai/asta-bench))

---

## 5. Recommended priority ordering (my pick)

1. **Strengthen the two-stage pipeline** — query transforms in `search()` + contextual-retrieval index + listwise reranker (+ larger char cap). Lowest risk, fixes the known vague-query gap, and **establishes the baseline every other arm must beat**.
2. **Agentic / iterative retrieval layer** — the highest quality ceiling for the agent use case; the genuine "beyond RAG" step; reuses paths (1) as tools.
3. **Late-interaction / multimodal index (ColBERT + ColPali)** — biggest single-stage retrieval lever and the only path to figure/table/equation retrieval; experimental-index A/B.
4. **PPR / graph-memory unification (HippoRAG-2 style)** — most ambitious, reuses existing PPR, **gated** on the GraphRAG-Bench caveat and a multi-hop need.

---

## 6. Implement-all-and-compare matrix

All arms judged on the **expanded 49/112 gold set** (search) + **leave-one-out** (related), reusing `eval/benchmark.py` and `eval/related_eval.py`. Change bar (from the benchmark assessment): beat current on **both** tracks by **>0.01**, within memory guards, surviving manual failure review.

| # | Arm | Built on (reuse) | How to run / eval |
| --- | --- | --- | --- |
| 0 | Baseline hybrid (current) | `query/search.py` | `eval benchmark --embed-profile gemini-2-structure-v1` |
| 1a | + query transforms | `query/transforms.py`, `retrieve_multi_query` | `eval benchmark --llm-transforms` |
| 1b | + contextual-retrieval index | new immutable index via ingest context step | `eval benchmark --retrieval-index <ctx>` |
| 1c | + listwise / Qwen3 reranker | `rag_common/rerank.py` (model + `MAX_RERANK_CHARS`) | new benchmark strategy |
| 1d | + SPLADE arm | `eval build-retrieval-index --kind splade` | `eval benchmark --retrieval-index … --strategy dense_splade` |
| 2 | Agentic loop | new `deep_research` module; tools = `search_raw()` + `cite related` | ScholarQABench/AstaBench subset + manual review |
| 3 | ColBERT / ColPali | `eval/experimental_index.py`, `build-retrieval-index --kind colbert` | `eval benchmark --retrieval-index <colbert>` |
| 4 | PPR-unified memory | `query/citation_rank.py` PPR + passage graph | `eval benchmark` + `eval related` |
| R | related ablations (`is_influential`, co-author) | `citation_rank.py`, `citation_store.py` | `eval related --variant …` |

**Prerequisite for every dense/hybrid/agentic run:** refresh Vertex ADC — `gcloud auth application-default login` (it is currently expired; that is why live dense queries hang). BM25-only and graph/related arms run offline.

---

## 7. Sources

Embeddings: [MTEB 2026](https://app.ailog.fr/en/blog/news/rag-benchmark-mteb-2026) · [models 2026](https://app.ailog.fr/en/blog/news/embedding-models-2026) · [Modal MTEB](https://modal.com/blog/mteb-leaderboard-article) Late interaction / visual: [Weaviate](https://weaviate.io/blog/late-interaction-overview) · [ColPali](https://arxiv.org/abs/2407.01449) · [ColPali GPU 2026](https://www.spheron.network/blog/colpali-multimodal-document-rag-gpu-cloud/) · [LIR @ ECIR 2026](https://arxiv.org/pdf/2511.00444) · [Visual doc retrieval survey 2026](https://arxiv.org/pdf/2602.19961) Chunking: [Anthropic contextual retrieval](https://platform.claude.com/cookbook/capabilities-contextual-embeddings-guide) · [chunking 2026](https://www.firecrawl.dev/blog/best-chunking-strategies-rag) · [RAPTOR](https://proceedings.iclr.cc/paper_files/paper/2024/file/8a2acd174940dbca361a6398a4f9df91-Paper-Conference.pdf) Reranking: [reranker guide](https://machinelearningmastery.com/top-5-reranking-models-to-improve-rag-results/) · [E²Rank](https://arxiv.org/pdf/2510.22733) · [jina-reranker-v3](https://arxiv.org/pdf/2509.25085) · [RankZephyr](https://arxiv.org/pdf/2312.02724) · [empirical analysis](https://arxiv.org/pdf/2508.16757) Agentic / beyond RAG: [Search-o1](https://arxiv.org/pdf/2501.05366) · [RAG-Reasoning survey](https://arxiv.org/pdf/2507.09477) · [PaperQA2](https://www.futurehouse.org/research-announcements/engineering-blog-journey-to-superhuman-performance-on-scientific-tasks) · [PaperQA2 paper](https://arxiv.org/abs/2409.13740) Graph / memory: [HippoRAG 2](https://arxiv.org/abs/2502.14802) · [GraphRAG-Bench](https://github.com/GraphRAG-Bench/GraphRAG-Benchmark) · [when to use graphs](https://arxiv.org/pdf/2506.05690) · [Neo4j GraphRAG](https://neo4j.com/blog/developer/unleashing-the-power-of-graphrag/) Long context / CAG: [CAG paper](https://arxiv.org/pdf/2412.15605) · [VentureBeat](https://venturebeat.com/ai/beyond-rag-how-cache-augmented-generation-reduces-latency-complexity-for-smaller-workloads) Generative retrieval: [DSI scaling](https://arxiv.org/pdf/2305.11841) Scientific systems: [OpenScholar](https://allenai.org/blog/openscilm) · [Nature](https://www.nature.com/articles/s41586-025-10072-4) · [Asta](https://allenai.org/blog/asta) · [AstaBench](https://github.com/allenai/asta-bench) · [SPECTER2](https://allenai.org/blog/specter2-adapting-scientific-document-embeddings-to-multiple-fields-and-task-formats-c95686c06567) · [SciNCL](https://arxiv.org/pdf/2202.06671)
