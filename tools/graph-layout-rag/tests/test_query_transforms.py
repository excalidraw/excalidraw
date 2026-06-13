import json

from graph_layout_rag.query import transforms


def test_transform_cache_roundtrip(tmp_path, monkeypatch):
    cache_path = tmp_path / "transform_cache.json"
    monkeypatch.setattr(transforms, "CACHE_PATH", cache_path)
    monkeypatch.setattr(transforms, "_generate_text", lambda prompt: "rewritten query one")

    first = transforms.step_back_query("network simplex rank assignment")
    second = transforms.step_back_query("network simplex rank assignment")
    assert first == second == "rewritten query one"
    assert cache_path.is_file()
    data = json.loads(cache_path.read_text(encoding="utf-8"))
    assert "step_back::network simplex rank assignment" in data


def test_multi_query_rewrites_parses_lines(tmp_path, monkeypatch):
    cache_path = tmp_path / "transform_cache.json"
    monkeypatch.setattr(transforms, "CACHE_PATH", cache_path)
    monkeypatch.setattr(
        transforms,
        "_generate_text",
        lambda prompt: "rank assignment heuristic\nlayered drawing optimization\n",
    )
    rewrites = transforms.multi_query_rewrites("network simplex", n=2)
    assert rewrites == ["rank assignment heuristic", "layered drawing optimization"]
