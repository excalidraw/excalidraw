"""Scan manifest PDFs for MuPDF extraction issues."""

from __future__ import annotations

import json

import click

from graph_layout_rag.ingest.extract import extract_pdf_result
from graph_layout_rag.manifest import load_manifest
from graph_layout_rag.paths import PKG_ROOT


@click.command("check-pdfs", context_settings={"help_option_names": ["-h", "--help"]})
@click.option("--limit", default=0, show_default=True, type=int, help="Max docs (0 = all).")
@click.option("--warnings-only", is_flag=True, help="Only show docs with MuPDF messages or empty text.")
@click.option("--json", "as_json", is_flag=True, help="JSON output.")
def check_pdfs_cmd(limit: int, warnings_only: bool, as_json: bool) -> None:
    """Scan ok manifest PDFs for MuPDF font warnings and empty text extraction."""
    manifest = load_manifest()
    ok_items = [i for i in manifest.items if i.status == "ok" and i.localPath]
    if limit > 0:
        ok_items = ok_items[:limit]

    rows: list[dict] = []
    for item in ok_items:
        path = PKG_ROOT / item.localPath
        result = extract_pdf_result(item)
        row = {
            "doc_id": item.id,
            "title": item.title,
            "local_path": item.localPath,
            "pages_with_text": len(result.pages),
            "failed_pages": result.failed_pages,
            "open_error": result.open_error,
            "has_font_warnings": result.has_font_warnings,
            "mupdf_messages": result.mupdf_messages[:500] if result.mupdf_messages else "",
        }
        if warnings_only and not (
            result.open_error or result.has_font_warnings or not result.pages or result.failed_pages
        ):
            continue
        if not path.is_file():
            row["open_error"] = "file missing"
        rows.append(row)

    if as_json:
        click.echo(json.dumps(rows, indent=2))
        return

    if not rows:
        click.echo("No matching PDFs.")
        return

    problem = sum(
        1
        for r in rows
        if r["open_error"] or r["has_font_warnings"] or r["pages_with_text"] == 0 or r["failed_pages"]
    )
    click.echo(f"Scanned {len(rows)} PDF(s); {problem} with extraction issues.\n")
    for r in rows:
        flags: list[str] = []
        if r["open_error"]:
            flags.append(f"error={r['open_error']}")
        if r["has_font_warnings"]:
            flags.append("font-warning")
        if r["pages_with_text"] == 0:
            flags.append("empty-text")
        if r["failed_pages"]:
            flags.append(f"failed-pages={r['failed_pages']}")
        flag_s = f" [{', '.join(flags)}]" if flags else ""
        click.echo(f"- {r['doc_id']}{flag_s}")
        click.echo(f"  {r['title'][:80]}")
        if r["mupdf_messages"]:
            click.echo(f"  MuPDF: {r['mupdf_messages'][:200]}")
