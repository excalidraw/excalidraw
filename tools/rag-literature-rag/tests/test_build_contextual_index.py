from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


def _load_script_module():
    path = Path(__file__).resolve().parents[1] / "scripts" / "build_contextual_index.py"
    spec = spec_from_file_location("build_contextual_index", path)
    assert spec and spec.loader
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class _FakeArrow:
    def __init__(self, rows):
        self._rows = rows

    def to_pylist(self):
        return self._rows


class _FakeSearch:
    def __init__(self, rows):
        self._rows = rows
        self.limit_value = None
        self.selected = None

    def select(self, cols):
        self.selected = cols
        return self

    def limit(self, value):
        self.limit_value = value
        return self

    def to_arrow(self):
        assert self.limit_value == len(self._rows)
        assert self.selected == ["doc_id", "text"]
        return _FakeArrow(self._rows)


class _FakeTable:
    def __init__(self):
        self.schema = type("Schema", (), {"names": ["doc_id", "vector", "text"]})()
        self.search_obj = _FakeSearch([{"doc_id": "a", "text": "one"}, {"doc_id": "b", "text": "two"}])

    def count_rows(self):
        return 2

    def search(self):
        return self.search_obj


def test_read_source_rows_reads_nonzero_limit():
    module = _load_script_module()

    rows = module._read_source_rows(_FakeTable())

    assert rows == [{"doc_id": "a", "text": "one"}, {"doc_id": "b", "text": "two"}]
