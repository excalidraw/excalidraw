# Repaired Baseline Measurement - 2026-06-20

- Git SHA: `05e82a9c1`
- Profile: `cuda-qwen0.6b-1024`
- Decision: measurement gate is still blocked for profile promotion comparisons.
- Next action: repair or expand evaluation pools before LongRAG and reduced-dimension full runs.

## Commands

```bash
uv run rag-literature-rag eval corpus-health --embed-profile cuda-qwen0.6b-1024 --track catalog --json
uv run rag-literature-rag eval corpus-health --embed-profile cuda-qwen0.6b-1024 --track pdf-deep-read --json
uv run rag-literature-rag eval fallback-audit --embed-profile cuda-qwen0.6b-1024
uv run rag-literature-rag eval performance-campaign --execute --stage repair-audit --stage repair --baseline-profile cuda-qwen0.6b-1024 --pdf-backend docling --passes 1 --run-dir data/eval/runs/20260620-measurement-repair-retry --json
uv run rag-literature-rag eval performance-campaign --execute --stage baseline --stage diagnostics --baseline-profile cuda-qwen0.6b-1024 --passes 1 --run-dir data/eval/runs/20260620-repaired-baseline --json
```

## Data Quality

| Track | Active fallback docs | Qrel fallback judgments | Chunks | Docs |
| --- | --: | --: | --: | --: |
| catalog | 0 | 0 | 21,211 | 1,270 |
| pdf-deep-read | 0 | 0 | 21,211 | 1,270 |

The initial audit found 26 qrel-heavy `empty_pdf_metadata_fallback` docs. All 26 were locally repairable and reingested with `docling`, writing 519 chunks. The repaired audit against `repair-ingest.log` reports 0 fallback docs.

## Baseline Metrics

| Track | Strategy | nDCG@10 | bpref | hole@10 | Failures | p95 ms | RSS GB |
| --- | --- | --: | --: | --: | --: | --: | --: |
| catalog | dense | 0.5560 | 0.4216 | 0.4405 | 3 | 33.53 | 1.300 |
| catalog | hybrid | 0.3680 | 0.3496 | 0.5646 | 3 | 36.47 | 1.304 |
| catalog | bm25 | 0.0529 | 0.0294 | 0.9209 | 40 | 2.97 | 0.609 |
| pdf-deep-read | dense | 0.6020 | 0.4815 | 0.3756 | 3 | 70.67 | 1.381 |
| pdf-deep-read | hybrid | 0.4079 | 0.3832 | 0.5220 | 3 | 77.91 | 1.360 |
| pdf-deep-read | bm25 | 0.0755 | 0.0473 | 0.8970 | 39 | 4.18 | 0.611 |

Diagnostics use the judged-pool metrics (`ndcg@10_new`, `bpref_new`, and `hole_rate@10`). The benchmark JSON also contains legacy raw nDCG values, but those are not sufficient for promotion decisions.

## Decision

Do not launch LongRAG, 768d, 512d, or docsummary full-corpus comparisons yet. The repaired data-quality gate is clean, but the measurement gate is not: baseline has nonzero miss failures and high `hole@10`, so candidate deltas would be dominated by pool coverage rather than profile quality.
