from __future__ import annotations

import json

import click

from graph_layout_rag.eval.gold_validation import validate_gold


@click.command("validate-gold")
@click.option("--json", "as_json", is_flag=True, help="Print machine-readable validation.")
def validate_gold_cmd(as_json: bool) -> None:
    """Validate evaluation labels against the current manifest."""
    payload = validate_gold()
    if as_json:
        click.echo(json.dumps(payload, indent=2))
        return
    click.echo(
        f"cases={payload['case_count']} relevant_ids={payload['unique_relevant_doc_ids']} "
        f"missing={len(payload['missing_doc_ids'])} "
        f"metadata_only={len(payload['metadata_only_doc_ids'])} "
        f"impossible_pdf_only_cases={len(payload['impossible_pdf_only_cases'])}"
    )
    if payload["impossible_pdf_only_cases"]:
        click.echo("PDF-only cases with no local relevant PDF:")
        for case_id in payload["impossible_pdf_only_cases"]:
            click.echo(f"  {case_id}")
