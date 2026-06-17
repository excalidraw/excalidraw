"""Dense embedding throughput benchmark (FP16 vs 4-bit) on CPU/MPS/CUDA.

Read-only: samples chunk text from an existing LanceDB index.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from graph_layout_rag.env import load_env_file
from graph_layout_rag.ingest.embed import prepare_embed_config
from graph_layout_rag.paths import CHUNKS_TABLE, DATA_DIR, profile_index_paths
from rag_common.config import EmbedConfig, use_cuda_bnb_4bit
from rag_common.local_embed import _get_model_for_config, embed_local_texts, resolve_local_embed_device

WARMUP = 32


def _now_id() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _sample_texts(source_profile: str, n: int) -> list[str]:
    import lancedb

    paths = profile_index_paths(source_profile)
    db = lancedb.connect(str(paths.lance_dir))
    rows = db.open_table(CHUNKS_TABLE).to_arrow().to_pylist()
    texts = [str(r.get("text") or "") for r in rows]
    texts = [t for t in texts if t.strip()]
    if not texts:
        raise RuntimeError(f"no chunk text found under profile {source_profile!r}")
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


def main() -> int:
    load_env_file()
    parser = argparse.ArgumentParser(description="Benchmark dense local embed throughput")
    parser.add_argument("--profile", required=True, help="Target embed profile name")
    parser.add_argument("--source-profile", required=True, help="LanceDB profile to sample texts from")
    parser.add_argument("--sample", type=int, default=512)
    parser.add_argument("--batch-size", type=int, default=16)
    args = parser.parse_args()

    os.environ.setdefault("RAG_LOCAL_EMBED_DEVICE", "cuda")
    texts = _sample_texts(args.source_profile, args.sample)
    base = prepare_embed_config(profile=args.profile)

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
        "source_profile": args.source_profile,
        "sample": args.sample,
        "arms": arms,
    }
    out = DATA_DIR / "eval" / "runs" / f"dense-embed-bench-{_now_id()}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, indent=2))
    print(f"\nWrote {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
