from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from rag_literature_rag.citation_store import normalize_doi
from rag_literature_rag.ingest.canonical import canonical_sort_key
from rag_literature_rag.manifest import load_manifest


class _UnionFind:
    def __init__(self, values: list[str]) -> None:
        self.parent = {value: value for value in values}

    def find(self, value: str) -> str:
        parent = self.parent[value]
        if parent != value:
            self.parent[value] = self.find(parent)
        return self.parent[value]

    def union(self, left: str, right: str) -> None:
        left_root = self.find(left)
        right_root = self.find(right)
        if left_root != right_root:
            self.parent[right_root] = left_root


@dataclass(frozen=True)
class CanonicalIdentityMap:
    canonical_by_doc: dict[str, str]
    aliases_by_canonical: dict[str, tuple[str, ...]]

    def canonicalize_doc_id(self, doc_id: str) -> str:
        return self.canonical_by_doc.get(doc_id, doc_id)

    def component_doc_ids(self, doc_id: str) -> tuple[str, ...]:
        canonical = self.canonicalize_doc_id(doc_id)
        aliases = self.aliases_by_canonical.get(canonical, ())
        ordered = [doc_id, canonical, *aliases]
        return tuple(dict.fromkeys(value for value in ordered if value))

    def canonical_doc_id(self, row: dict[str, Any]) -> str:
        doc_id = str(row.get("doc_id") or "")
        if doc_id in self.canonical_by_doc:
            return self.canonicalize_doc_id(doc_id)
        for alias in split_values(row.get("alias_doc_ids")):
            if alias in self.canonical_by_doc:
                return self.canonical_by_doc[alias]
        sha = str(row.get("canonical_sha256") or "")
        return f"sha256:{sha}" if sha else doc_id

    def aliases(self, canonical_doc_id: str, row: dict[str, Any]) -> list[str]:
        values = set(self.aliases_by_canonical.get(canonical_doc_id, ()))
        values.update(split_values(row.get("alias_doc_ids")))
        values.add(str(row.get("doc_id") or ""))
        values.discard("")
        values.discard(canonical_doc_id)
        return sorted(values)


def split_values(raw: Any) -> list[str]:
    if not raw:
        return []
    if isinstance(raw, str):
        return [value for value in raw.split(",") if value]
    return [str(value) for value in raw if value]


def _identity_tokens(item: Any) -> list[str]:
    tokens: list[str] = []
    doi = normalize_doi(item.doi)
    if doi:
        tokens.append(f"doi:{doi}")
    if item.sha256:
        tokens.append(f"sha256:{item.sha256}")
    if item.localPath:
        tokens.append(f"path:{item.localPath}")
    for provider, external_id in item.externalIds.items():
        if external_id:
            tokens.append(f"external:{provider.lower()}:{str(external_id).lower()}")
    return tokens


@lru_cache(maxsize=1)
def canonical_identity_map() -> CanonicalIdentityMap:
    items = load_manifest().items
    by_id = {item.id: item for item in items}
    union = _UnionFind(list(by_id))
    owner_by_token: dict[str, str] = {}

    for item in items:
        for token in _identity_tokens(item):
            owner = owner_by_token.setdefault(token, item.id)
            union.union(owner, item.id)

    components: dict[str, list[str]] = {}
    for doc_id in by_id:
        components.setdefault(union.find(doc_id), []).append(doc_id)

    canonical_by_doc: dict[str, str] = {}
    aliases_by_canonical: dict[str, tuple[str, ...]] = {}
    for doc_ids in components.values():
        canonical = min((by_id[doc_id] for doc_id in doc_ids), key=canonical_sort_key).id
        aliases = tuple(sorted(doc_id for doc_id in doc_ids if doc_id != canonical))
        aliases_by_canonical[canonical] = aliases
        for doc_id in doc_ids:
            canonical_by_doc[doc_id] = canonical

    return CanonicalIdentityMap(canonical_by_doc, aliases_by_canonical)


def clear_identity_cache() -> None:
    canonical_identity_map.cache_clear()
