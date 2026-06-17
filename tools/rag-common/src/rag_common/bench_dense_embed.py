"""Dense embedding throughput benchmark (FP16 vs 4-bit) on CPU/MPS/CUDA."""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from rag_common.config import EmbedConfig, use_cuda_bnb_4bit
from rag_common.local_embed import _get_model_for_config, embed_local_texts, resolve_local_embed_device
from rag_common.resolve import resolve_embed_config

CHUNKS_TABLE = "chunks"
WARMUP = 32


def _now_id() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _sample_texts(lance_dir: Path, n: int) -> list[str]:
    import lancedb

    if not lance_dir.is_dir():
        raise RuntimeError(f"lance dir not found: {lance_dir}")
    db = lancedb.connect(str(lance_dir))
    tables = db.list_tables()
    names = tables if isinstance(tables, list) else list(getattr(tables, "tables", tables))
    if CHUNKS_TABLE not in names:
        raise RuntimeError(f"missing {CHUNKS_TABLE} in {lance_dir}")
    rows = db.open_table(CHUNKS_TABLE).to_arrow().to_pylist()
    texts = [str(r.get("text") or r.get("prefixed_text") or "") for r in rows]
    texts = [t for t in texts if t.strip()]
    if not texts:
        raise RuntimeError(f"no chunk text in {lance_dir}")
    return texts[:n]


def _bench_config(base: EmbedConfig, *, quant: str | None) -> EmbedConfig:
    return EmbedConfig(
        backend=base.backend,
        model=base.model,
        dimensions=base.dimensions,
        profile=base.profile,
        quant=quant,
    )


def _run_arm(
    texts: list[str],
    config: EmbedConfig,
    *,
    batch_size: int,
    label: str,
) -> dict[str, Any]:
    from rag_common.local_embed import _model_cache

    _model_cache.clear()
    os.environ["RAG_CUDA_BATCH_SIZE"] = str(batch_size)
    device = resolve_local_embed_device(config.model)
    warmup = texts[: min(WARMUP, len(texts))]
    if warmup:
        embed_local_texts(warmup, config=config)
    _model_cache.clear()
    _get_model_for_config(config)
    t0 = time.monotonic()
    embed_local_texts(texts, config=config)
    elapsed = time.monotonic() - t0
    peak_vram_mb = None
    if device == "cuda":
        try:
            import torch

            torch.cuda.synchronize()
            peak_vram_mb = round(torch.cuda.max_memory_allocated() / 1024 / 1024, 1)
            torch.cuda.reset_peak_memory_stats()
        except Exception:
            pass
    return {
        "label": label,
        "quant": config.quant,
        "device": device,
        "batch_size": batch_size,
        "texts": len(texts),
        "elapsed_s": round(elapsed, 3),
        "texts_per_s": round(len(texts) / elapsed, 2) if elapsed else 0.0,
        "peak_vram_mb": peak_vram_mb,
        "bnb_4bit": use_cuda_bnb_4bit(config),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Benchmark dense local embed throughput")
    parser.add_argument("--profile", required=True)
    parser.add_argument("--lance-dir", required=True, type=Path)
    parser.add_argument("--env-prefix", default="", help="e.g. GRAPH_RAG_ or REPO_RAG_")
    parser.add_argument("--sample", type=int, default=512)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--out-dir", type=Path, default=Path("data/eval/runs"))
    args = parser.parse_args(argv)

    os.environ.setdefault("RAG_LOCAL_EMBED_DEVICE", "cuda")
    texts = _sample_texts(args.lance_dir, args.sample)
    base = resolve_embed_config(args.env_prefix, profile=args.profile)

    arms: list[dict[str, Any]] = []
    for quant, label in ((None, "fp16"), ("4bit", "bnb-4bit")):
        cfg = _bench_config(base, quant=quant)
        try:
            arms.append(_run_arm(texts, cfg, batch_size=args.batch_size, label=label))
        except Exception as exc:
            arms.append({"label": label, "error": str(exc)})

    payload = {
        "run_id": _now_id(),
        "profile": args.profile,
        "lance_dir": str(args.lance_dir),
        "sample": args.sample,
        "arms": arms,
    }
    args.out_dir.mkdir(parents=True, exist_ok=True)
    out = args.out_dir / f"dense-embed-bench-{_now_id()}.json"
    out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, indent=2))
    print(f"\nWrote {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
