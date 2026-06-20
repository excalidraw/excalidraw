# Repo RAG Operations

## Commands

From the repo root:

```bash
yarn repo-rag:query "compound pipeline sibling columns" --top 8 --json
yarn repo-rag:query "preset loader D1 cache" --source-type handoff --json
yarn repo-rag:query "dependency-cruiser terraformLayoutCore" --path-contains pipeline --json
yarn repo-rag:status
yarn repo-rag:index
yarn repo-rag:index --force
```

Global CLI flags go before the subcommand:

```bash
yarn repo-rag --workers 12 index
yarn repo-rag -v --log index
```

Direct explorer commands from `tools/repo-rag`:

```bash
uv run repo-rag search "pipeline layout compound" --top 8
uv run repo-rag symbol terraformPipelineLayoutCompound
uv run repo-rag neighbors terraformPipelineLayoutCompound --depth 2
uv run repo-rag read terraformPipelineLayoutCompound
uv run repo-rag context "fix sibling column collision in compound layout" --budget 6000
uv run repo-rag explain packages/excalidraw/components/terraformPipelineLayoutCompound.ts
uv run repo-rag eval benchmark
uv run repo-rag eval benchmark --compare
```

## Embedding Profiles

List profiles:

```bash
cd tools/repo-rag && uv run repo-rag embed profiles
```

Common profiles:

| Profile | Backend | Dims | Use when |
| --- | --- | ---: | --- |
| `cuda-qwen0.6b-1024` | local | 1024 | Production query profile after GPU reembed |
| `gemini-2` | gemini | 3072 | Secondary cloud build |
| `openai-large` | openai | 1024 | Smaller OpenAI vectors |
| `mlx-qwen4b` | local | 1024 | Free Apple Silicon ingest |
| `qwen3-code` | local | 2560 | Code-specialized Qwen3-4B native dims |

Set the same profile on index and query:

```bash
RAG_EMBED_PROFILE=gemini-2 uv run repo-rag index --force --rebuild
RAG_EMBED_PROFILE=cuda-qwen0.6b-1024 uv run repo-rag query "compound pipeline" --top 8 --json
```

Per-profile indexes live under `data/indexes/{profile}/`. Legacy flat `data/lancedb/` still works only when `data/indexes/` is empty.

## Query Filters

| Flag | Values | Use |
| --- | --- | --- |
| `--source-type` | `handoff`, `terraform`, `code`, `app`, `test`, `doc` | Narrow corpus |
| `--package` | package name | Package scope |
| `--path-contains` | substring | Path filter |
| `--embed-profile` | profile name | Match a built index |
| `--rerank` / `--no-rerank` | flag | Opt-in local cross-encoder rerank |
| `--top` | number | Result count |

Reranking is off by default. It has helped precision-sensitive lookup only when the reranker sees `file_path + symbol + text`; revalidate with:

```bash
RAG_RERANK_ENABLED=1 uv run repo-rag eval benchmark --compare
```

## Contextual Retrieval

Contextual retrieval is opt-in at index time:

```bash
uv sync --extra contextual
ANTHROPIC_API_KEY=... uv run repo-rag index --force --rebuild --contextual
```

Without an Anthropic key it falls back to a deterministic heuristic. Revalidate with `eval benchmark --compare` after rebuilding.

## MCP Server

Expose iterative search tools to an agent:

```bash
cd tools/repo-rag
uv sync --extra mcp
uv run repo-rag mcp
```

Tools: `search`, `symbol`, `neighbors`, `context`, and `read`.

## Important Handoff Docs

- [docs/terraform-pipeline-import-agent-guide.md](../../../../docs/terraform-pipeline-import-agent-guide.md)
- [docs/pipeline-semantic-placement-agent-handoff.md](../../../../docs/pipeline-semantic-placement-agent-handoff.md)
- [docs/terraform-pipeline-compound-import-guide.md](../../../../docs/terraform-pipeline-compound-import-guide.md)
- [docs/terraform-pipeline-import-debug-handoff.md](../../../../docs/terraform-pipeline-import-debug-handoff.md)
