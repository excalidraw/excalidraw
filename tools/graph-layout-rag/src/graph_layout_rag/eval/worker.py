from __future__ import annotations

import argparse
import json
from pathlib import Path

from graph_layout_rag.env import load_env_file
from graph_layout_rag.eval.benchmark import _atomic_write_json, evaluate_strategy
from graph_layout_rag.eval.strategies import strategy_registry


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--strategy", required=True)
    parser.add_argument("--track", required=True)
    parser.add_argument("--embed-profile", required=True)
    parser.add_argument("--top", required=True, type=int)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    load_env_file()
    strategy = strategy_registry()[args.strategy]
    payload = evaluate_strategy(
        strategy,
        embed_profile=args.embed_profile,
        track=args.track,
        top=args.top,
        verbose=False,
    )
    _atomic_write_json(args.output, payload)


if __name__ == "__main__":
    main()
