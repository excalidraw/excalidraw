from graph_layout_rag.eval.experimental_index import (
    DEFAULT_MODELS,
    _clean_payload,
)


def test_experimental_models_are_pinned():
    assert DEFAULT_MODELS["splade"] == "prithivida/Splade_PP_en_v1"
    assert DEFAULT_MODELS["colbert"] == "answerdotai/answerai-colbert-small-v1"


def test_clean_payload_converts_nan_to_none():
    payload = _clean_payload({"year": float("nan"), "title": "x"})
    assert payload == {"year": None, "title": "x"}
