#!/usr/bin/env python3
"""
Post-harvest bibliography re-filter.

Re-runs OpenAlex relevance checks on bibliography-sourced manifest items whose
DOI prefixes suggest they may be off-topic (PLOS, BMC, Nature, PNAS, etc.) —
items that were accepted during harvest because OpenAlex was quota-exhausted.

Also removes metadata_only items with known off-topic DOI prefixes so future
harvest passes won't attempt to download them.

Safe to run after harvest completes and OpenAlex quota has reset (~3h after
the 429 with Retry-After: 11300 was received).

Usage:
    uv run python3 refilter_bibliography.py [--dry-run] [--workers N]

Flags:
    --dry-run   Print what would be removed without touching manifest or files.
    --workers N Parallel OpenAlex workers (default: 4).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()

    # Must run from the rag-literature-rag tool root
    manifest_path = Path("data/manifest.json")
    if not manifest_path.exists():
        sys.exit("Run from tools/rag-literature-rag/ — data/manifest.json not found")

    # Inline import after path check so errors are clear
    from rag_literature_rag.harvest.bibliography import _doi_relevance_decision
    from rag_literature_rag.harvest.parallel import parallel_map
    from rag_literature_rag.harvest.relevance import is_known_offtopic_doi
    from rag_literature_rag.paths import PKG_ROOT

    with manifest_path.open(encoding="utf-8") as f:
        manifest = json.load(f)
    items = manifest.get("items", [])

    # --- ok items: need OpenAlex re-check (quota may have been exhausted when accepted)
    ok_candidates = [
        i for i in items
        if i.get("source") == "bibliography"
        and i.get("status") == "ok"
        and i.get("doi")
        and is_known_offtopic_doi(i["doi"])
    ]

    # --- metadata_only items: can be purged immediately by prefix alone (no PDF to check)
    meta_remove = [
        i for i in items
        if i.get("source") == "bibliography"
        and i.get("status") == "metadata_only"
        and i.get("doi")
        and is_known_offtopic_doi(i["doi"])
    ]

    bib_ok = sum(1 for i in items if i.get("source") == "bibliography" and i.get("status") == "ok" and i.get("doi"))
    bib_meta = sum(1 for i in items if i.get("source") == "bibliography" and i.get("status") == "metadata_only" and i.get("doi"))

    print(f"Manifest items total:             {len(items)}")
    print(f"Bibliography ok with DOI:         {bib_ok}")
    print(f"Bibliography metadata_only w/DOI: {bib_meta}")
    print(f"ok suspects (need OpenAlex check):{len(ok_candidates)}")
    print(f"metadata_only suspects (instant): {len(meta_remove)}")
    print()

    # Re-check ok suspects via OpenAlex
    ok_keep, ok_remove = [], []
    if ok_candidates:
        print(f"Re-checking {len(ok_candidates)} ok DOIs via OpenAlex ({args.workers} workers) ...")

        def _check(item: dict) -> tuple[dict, bool]:
            relevant = _doi_relevance_decision(item["doi"])
            return item, relevant

        results = parallel_map(_check, ok_candidates, workers=args.workers, label="refilter")

        for result in results:
            if result is None:
                continue
            item, relevant = result
            if relevant:
                ok_keep.append(item)
            else:
                ok_remove.append(item)

        print(f"Results: {len(ok_keep)} relevant, {len(ok_remove)} irrelevant")
        print()

    all_remove = ok_remove + meta_remove

    if not all_remove:
        print("Nothing to remove.")
        return

    print(f"Items to remove: {len(ok_remove)} ok PDFs + {len(meta_remove)} metadata_only stubs")
    for item in ok_remove:
        title = item.get("title") or item.get("doi") or item["id"]
        lp = item.get("localPath", "")
        print(f"  [ok]   {title[:70]}")
        if lp:
            full = PKG_ROOT / lp
            size_kb = full.stat().st_size // 1024 if full.exists() else 0
            print(f"           {lp} ({size_kb} KB)")
    for item in meta_remove[:10]:
        title = item.get("title") or item.get("doi") or item["id"]
        print(f"  [meta] {title[:70]}")
    if len(meta_remove) > 10:
        print(f"  ... and {len(meta_remove) - 10} more metadata_only stubs")

    if args.dry_run:
        print(f"\n--dry-run: would remove {len(all_remove)} items ({len(ok_remove)} PDFs deleted, {len(meta_remove)} stubs dropped).")
        return

    answer = input(f"\nRemove {len(all_remove)} items from manifest and delete {len(ok_remove)} PDFs? [y/N] ").strip().lower()
    if answer != "y":
        print("Aborted.")
        return

    remove_ids = {i["id"] for i in all_remove}

    # Delete PDFs for ok items
    deleted_bytes = 0
    for item in ok_remove:
        lp = item.get("localPath")
        if lp:
            full = PKG_ROOT / lp
            if full.exists():
                deleted_bytes += full.stat().st_size
                full.unlink()
                print(f"  deleted {lp}")

    # Remove from manifest
    manifest["items"] = [i for i in items if i.get("id") not in remove_ids]

    # Atomic write
    tmp = manifest_path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(manifest_path)

    print(f"\nDone. Removed {len(all_remove)} items ({len(ok_remove)} PDFs, {len(meta_remove)} stubs), freed {deleted_bytes // 1024 // 1024} MB.")
    print("Manifest updated. Run ingest normally — the index will not include removed items.")


if __name__ == "__main__":
    main()
