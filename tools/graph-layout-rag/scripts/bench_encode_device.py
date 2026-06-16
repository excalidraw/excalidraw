"""Encode throughput benchmark for SPLADE/ColBERT on CPU, MPS (Mac), or CUDA (remote GPU).

Arms per model family:
  * fastembed       -- production ONNX path (CPU or CUDA via fastembed-gpu).
  * torch-CPU/MPS/CUDA -- HF backbone timing (Mac MPS or Ubuntu CUDA).

Read-only: pulls sample chunk text from LanceDB; writes results under data/eval/runs/.

Usage:
    uv run python scripts/bench_encode_device.py
    uv run python scripts/bench_encode_device.py --sample 256 --batch-size 8 --models splade,colbert,splade_v3
    GRAPH_RAG_FASTEMBED_CUDA=1 uv run python scripts/bench_encode_device.py --models splade,colbert
"""
from __future__ import annotations

import argparse
import json
import platform
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from graph_layout_rag.env import load_env_file
from graph_layout_rag.eval.encode_device import fastembed_kwargs, resolve_encode_device
from graph_layout_rag.eval.experimental_index import DEFAULT_MODELS
from graph_layout_rag.eval.hardware import assert_memory_start_safe, memory_snapshot
from graph_layout_rag.eval.splade_v3_encoder import PYTORCH_SPARSE_MODELS, SpladeV3Encoder
from graph_layout_rag.paths import CHUNKS_TABLE, DATA_DIR, profile_index_paths

WARMUP_BATCHES = 1
SPLADE_V3_DEFAULT = "naver/splade-v3"


def _now_id() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def _sample_texts(profile: str, n: int) -> list[str]:
    import lancedb

    paths = profile_index_paths(profile)
    db = lancedb.connect(str(paths.lance_dir))
    rows = db.open_table(CHUNKS_TABLE).to_arrow().to_pylist()
    texts = [str(r.get("text") or "") for r in rows]
    texts = [t for t in texts if t.strip()]
    if not texts:
        raise RuntimeError(f"no chunk text found under profile {profile!r}")
    return texts[:n]


def _batches(items: list, size: int):
    for i in range(0, len(items), size):
        yield items[i : i + size]


def _time_arm(
    *,
    name: str,
    encode_batch: Callable[[list[str]], int],
    texts: list[str],
    batch_size: int,
) -> dict[str, Any]:
    batches = list(_batches(texts, batch_size))
    for warm in batches[:WARMUP_BATCHES]:
        encode_batch(warm)
    t0 = time.monotonic()
    total_tokens = 0
    for batch in batches:
        total_tokens += encode_batch(batch)
    elapsed = time.monotonic() - t0
    snap = memory_snapshot()
    return {
        "arm": name,
        "chunks": len(texts),
        "tokens": total_tokens,
        "seconds": round(elapsed, 3),
        "chunks_per_s": round(len(texts) / elapsed, 1) if elapsed else None,
        "tokens_per_s": round(total_tokens / elapsed, 0) if elapsed else None,
        "peak_rss_gb": snap.process_peak_rss_gb,
    }


def _fastembed_arm(
    kind: str,
    model_name: str,
    texts: list[str],
    batch_size: int,
    *,
    label: str,
) -> dict[str, Any]:
    from fastembed import LateInteractionTextEmbedding, SparseTextEmbedding

    fe_kwargs = fastembed_kwargs()
    if kind == "splade":
        model = SparseTextEmbedding(model_name=model_name, **fe_kwargs)
    else:
        model = LateInteractionTextEmbedding(model_name=model_name, **fe_kwargs)

    def encode_batch(batch: list[str]) -> int:
        for _ in model.embed(batch, batch_size=len(batch)):
            pass
        return 0

    return _time_arm(name=label, encode_batch=encode_batch, texts=texts, batch_size=batch_size)


def _splade_v3_arm(model_name: str, texts: list[str], batch_size: int, *, device: str) -> dict[str, Any]:
    encoder = SpladeV3Encoder(model_name, device=device)

    def encode_batch(batch: list[str]) -> int:
        for _ in encoder.embed(batch, batch_size=len(batch)):
            pass
        return 0

    label = f"splade-v3-{device.upper()}"
    return _time_arm(name=label, encode_batch=encode_batch, texts=texts, batch_size=batch_size)


def _torch_arm(
    kind: str,
    model_name: str,
    texts: list[str],
    batch_size: int,
    *,
    device: str,
    dtype: str,
    max_tokens: int,
) -> dict[str, Any]:
    import torch
    from transformers import AutoModel, AutoModelForMaskedLM, AutoTokenizer

    torch_dtype = torch.float16 if dtype == "fp16" else torch.float32
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    if kind == "splade":
        model = AutoModelForMaskedLM.from_pretrained(model_name, torch_dtype=torch_dtype)
    else:
        model = AutoModel.from_pretrained(model_name, torch_dtype=torch_dtype)
    model = model.to(device).eval()

    def encode_batch(batch: list[str]) -> int:
        enc = tokenizer(
            batch,
            padding=True,
            truncation=True,
            max_length=max_tokens,
            return_tensors="pt",
        ).to(device)
        with torch.no_grad():
            out = model(**enc)
            if kind == "splade":
                logits = out.logits
                mask = enc["attention_mask"].unsqueeze(-1)
                weighted = torch.log1p(torch.relu(logits)) * mask
                _ = weighted.max(dim=1).values
            else:
                _ = out.last_hidden_state
        if device == "mps":
            torch.mps.synchronize()
        elif device == "cuda":
            torch.cuda.synchronize()
        return int(enc["attention_mask"].sum().item())

    return _time_arm(
        name=f"torch-{device.upper()}{'-fp16' if dtype == 'fp16' else ''}",
        encode_batch=encode_batch,
        texts=texts,
        batch_size=batch_size,
    )


def _mps_available() -> bool:
    try:
        import torch

        return bool(torch.backends.mps.is_available())
    except Exception:
        return False


def _cuda_available() -> bool:
    try:
        import torch

        return bool(torch.cuda.is_available())
    except Exception:
        return False


def _resolve_model(kind: str) -> str:
    if kind == "splade_v3":
        return SPLADE_V3_DEFAULT
    return DEFAULT_MODELS[kind]


def _render_table(results: list[dict[str, Any]]) -> str:
    header = "| model | arm | chunks/s | tokens/s | seconds | peak RSS GB |"
    sep = "| --- | --- | ---: | ---: | ---: | ---: |"
    lines = [header, sep]
    for r in results:
        tps = "" if r["tokens_per_s"] in (None, 0) else f"{r['tokens_per_s']:.0f}"
        lines.append(
            f"| {r['model']} | {r['arm']} | {r['chunks_per_s']} | {tps} | "
            f"{r['seconds']} | {r['peak_rss_gb']} |"
        )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", default="gemini-2-structure-v1")
    parser.add_argument("--sample", type=int, default=512, help="number of chunks to encode")
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--max-tokens", type=int, default=512)
    parser.add_argument(
        "--models",
        default="splade,colbert",
        help="comma list: splade,colbert,splade_v3",
    )
    parser.add_argument("--min-available-gb", type=float, default=8.0)
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()

    load_env_file()
    start_mem = assert_memory_start_safe(args.min_available_gb)

    kinds = [k.strip() for k in args.models.split(",") if k.strip()]
    texts = _sample_texts(args.profile, args.sample)
    encode_device = resolve_encode_device()
    fe_label = "fastembed-CUDA" if encode_device == "cuda" else "fastembed-CPU"
    print(
        f"Loaded {len(texts)} chunks from {args.profile!r}; "
        f"batch_size={args.batch_size}, max_tokens={args.max_tokens}, "
        f"fastembed={fe_label}"
    )

    mps_ok = _mps_available()
    cuda_ok = _cuda_available()
    if not mps_ok:
        print("NOTE: torch MPS not available — skipping Mac GPU arms.")
    if not cuda_ok:
        print("NOTE: torch CUDA not available — skipping CUDA arms.")

    results: list[dict[str, Any]] = []
    for kind in kinds:
        model_name = _resolve_model(kind)
        bench_kind = "splade" if kind == "splade_v3" else kind
        print(f"\n=== {kind} ({model_name}) ===")

        if kind != "splade_v3":
            print(f"  {fe_label} ...", flush=True)
            r = _fastembed_arm(kind, model_name, texts, args.batch_size, label=fe_label)
            r["model"], r["dtype"] = kind, "fp32"
            results.append(r)
            print(f"    {r['chunks_per_s']} chunks/s")

        if kind == "splade_v3":
            for device in ("cpu", "cuda"):
                if device == "cuda" and not cuda_ok:
                    continue
                print(f"  splade-v3 ({device}) ...", flush=True)
                r = _splade_v3_arm(model_name, texts, args.batch_size, device=device)
                r["model"], r["dtype"] = kind, "fp32"
                results.append(r)
                print(f"    {r['chunks_per_s']} chunks/s")
            continue

        print("  torch-CPU ...", flush=True)
        r = _torch_arm(
            bench_kind,
            model_name,
            texts,
            args.batch_size,
            device="cpu",
            dtype="fp32",
            max_tokens=args.max_tokens,
        )
        r["model"], r["dtype"] = kind, "fp32"
        results.append(r)
        print(f"    {r['chunks_per_s']} chunks/s")

        if mps_ok:
            for dtype in ("fp32", "fp16"):
                print(f"  torch-MPS ({dtype}) ...", flush=True)
                r = _torch_arm(
                    bench_kind,
                    model_name,
                    texts,
                    args.batch_size,
                    device="mps",
                    dtype=dtype,
                    max_tokens=args.max_tokens,
                )
                r["model"], r["dtype"] = kind, dtype
                results.append(r)
                print(f"    {r['chunks_per_s']} chunks/s")

        if cuda_ok:
            for dtype in ("fp32", "fp16"):
                print(f"  torch-CUDA ({dtype}) ...", flush=True)
                r = _torch_arm(
                    bench_kind,
                    model_name,
                    texts,
                    args.batch_size,
                    device="cuda",
                    dtype=dtype,
                    max_tokens=args.max_tokens,
                )
                r["model"], r["dtype"] = kind, dtype
                results.append(r)
                print(f"    {r['chunks_per_s']} chunks/s")

    table = _render_table(results)
    print("\n" + table)

    out_dir = args.out or (DATA_DIR / "eval" / "runs" / f"encode-device-bench-{_now_id()}")
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "platform": platform.platform(),
        "profile": args.profile,
        "sample": len(texts),
        "batch_size": args.batch_size,
        "max_tokens": args.max_tokens,
        "encode_device": encode_device,
        "mps_available": mps_ok,
        "cuda_available": cuda_ok,
        "pytorch_sparse_models": sorted(PYTORCH_SPARSE_MODELS),
        "memory_start": start_mem.to_dict(),
        "results": results,
    }
    _atomic_write_json(out_dir / "results.json", payload)
    (out_dir / "results.md").write_text(table + "\n", encoding="utf-8")
    print(f"\nWrote {out_dir}/results.json and results.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
