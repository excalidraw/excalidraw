from graph_layout_rag.eval.gold_validation import cases_for_track, validate_gold


def test_gold_validation_references_existing_manifest_items():
    payload = validate_gold()
    assert payload["missing_doc_ids"] == []
    assert payload["unique_relevant_doc_ids"] > 0


def test_pdf_deep_read_track_has_only_usable_relevant_labels():
    cases = cases_for_track("pdf-deep-read")
    assert cases
    assert all(case.pdf_only for case in cases)
    assert all(case.relevant_doc_ids for case in cases)
