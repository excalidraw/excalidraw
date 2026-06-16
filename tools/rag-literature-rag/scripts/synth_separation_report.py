"""Method-separation report: does the synthetic gold set distinguish retrievers?

Reads the latest `eval benchmark` run (produced with RAG_LIT_SYNTH_GOLD=1, so each
strategy's per-case list contains BOTH curated-42 and synthetic cases), splits cases
by id prefix, and answers the campaign's core question:

  * Per strategy: mean nDCG@10 on curated-42 vs on the synthetic set.
  * Across strategies: the SPREAD (max-min) of mean nDCG@10 — wider on the synthetic
    set = the eval finally separates methods that clustered on the 42.
  * Spearman rank-correlation between the curated and synthetic strategy orderings —
    high = synthetic agrees with the human anchor (trustworthy); low = surfaced, not
    hidden.

No LLM, no embedding. Pure read over benchmark.json. Pass a run dir or use latest.
"""
from __future__ import annotations

import glob
import json
import statistics
import sys
from pathlib import Path

from rag_literature_rag.paths import DATA_DIR


def _latest_run() -> Path:
    runs = sorted(glob.glob(str(DATA_DIR / "eval" / "runs" / "*")))
    if not runs:
        raise SystemExit("No benchmark runs found; run `eval benchmark` first.")
    return Path(runs[-1])


def _spearman(a: list[float], b: list[float]) -> float:
    """Spearman rho between two equal-length score vectors (no scipy dependency)."""
    n = len(a)
    if n < 2:
        return float("nan")

    def _rank(xs: list[float]) -> list[float]:
        order = sorted(range(n), key=lambda i: xs[i])
        ranks = [0.0] * n
        i = 0
        while i < n:
            j = i
            while j + 1 < n and xs[order[j + 1]] == xs[order[i]]:
                j += 1
            avg = (i + j) / 2.0 + 1.0  # average rank for ties (1-based)
            for k in range(i, j + 1):
                ranks[order[k]] = avg
            i = j + 1
        return ranks

    ra, rb = _rank(a), _rank(b)
    mean_a, mean_b = sum(ra) / n, sum(rb) / n
    cov = sum((ra[i] - mean_a) * (rb[i] - mean_b) for i in range(n))
    va = sum((r - mean_a) ** 2 for r in ra) ** 0.5
    vb = sum((r - mean_b) ** 2 for r in rb) ** 0.5
    return cov / (va * vb) if va and vb else float("nan")


def _split_means(strategy_json: dict) -> tuple[float | None, float | None, int, int]:
    """Return (curated_mean_ndcg, synth_mean_ndcg, n_curated, n_synth)."""
    cur, syn = [], []
    for c in strategy_json.get("cases", []):
        v = c.get("ndcg@10")
        if v is None:
            continue
        (syn if str(c.get("id", "")).startswith("synth-") else cur).append(v)
    cm = statistics.mean(cur) if cur else None
    sm = statistics.mean(syn) if syn else None
    return cm, sm, len(cur), len(syn)


def report(run_dir: Path) -> None:
    for track in ("catalog", "pdf-deep-read"):
        files = sorted(glob.glob(str(run_dir / "strategies" / f"{track}--*.json")))
        rows = []
        for f in files:
            d = json.loads(Path(f).read_text())
            # Benchmark marks success as "completed"; only skip genuine failures.
            if d.get("status") in ("failed", "aborted", "oom"):
                continue
            cm, sm, nc, ns = _split_means(d)
            if cm is None or sm is None or ns == 0:
                continue
            rows.append((d["strategy"], cm, sm))
        if not rows:
            print(f"\n## {track}: no eval'd strategies with synthetic cases (run with RAG_LIT_SYNTH_GOLD=1)")
            continue

        rows.sort(key=lambda r: -r[2])  # by synthetic nDCG
        cur_scores = [r[1] for r in rows]
        syn_scores = [r[2] for r in rows]
        cur_spread = max(cur_scores) - min(cur_scores)
        syn_spread = max(syn_scores) - min(syn_scores)
        rho = _spearman(cur_scores, syn_scores)

        n_cur = _split_means(json.loads(Path(files[0]).read_text()))[2]
        n_syn = _split_means(json.loads(Path(files[0]).read_text()))[3]
        print(f"\n## {track}  (curated n={n_cur}, synthetic n={n_syn})")
        print(f"{'strategy':28} {'nDCG@10 curated':>16} {'nDCG@10 synth':>14}")
        for name, cm, sm in rows:
            print(f"{name:28} {cm:16.3f} {sm:14.3f}")
        print(f"\n  nDCG@10 spread (max-min): curated={cur_spread:.3f}  synthetic={syn_spread:.3f}")
        print(f"  separation gain: {syn_spread - cur_spread:+.3f}  (positive = synthetic separates methods better)")
        print(f"  curated-vs-synthetic Spearman rho: {rho:.3f}  (high = synthetic agrees with the human anchor)")


if __name__ == "__main__":
    run = Path(sys.argv[1]) if len(sys.argv) > 1 else _latest_run()
    print(f"# Method-separation report — {run.name}")
    report(run)
