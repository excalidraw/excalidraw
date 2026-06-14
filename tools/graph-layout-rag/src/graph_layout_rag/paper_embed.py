"""Citation-trained document embeddings for the relatedness axis (SciNCL / SPECTER2).

These models are trained so that papers near each other in the citation graph are near each
other in vector space — exactly the "find related papers" signal. They embed a paper from
its **title + abstract** and pool the **[CLS]** token (NOT mean pooling — sentence-transformers'
default mean pooling gives wrong vectors for this model family, which is why this module talks
to `transformers` directly).

Two models, A/B'd by the leave-one-out eval:
  * ``scincl``   — ``malteos/scincl``: plain transformers, CLS pooling.
  * ``specter2`` — ``allenai/specter2_base``, CLS pooling. The ``allenai/specter2`` proximity
                   adapter is loaded *only if* the AdapterHub ``adapters`` lib is importable;
                   it pins ``transformers<4.58`` and conflicts with the MLX embedding stack in
                   this env, so by default we use the (still citation-trained) base model.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class PaperModelSpec:
    key: str
    hf_model: str
    dimensions: int
    adapter: str | None = None  # set => needs the `adapters` lib + proximity adapter


MODEL_SPECS: dict[str, PaperModelSpec] = {
    "scincl": PaperModelSpec(key="scincl", hf_model="malteos/scincl", dimensions=768),
    "specter2": PaperModelSpec(
        key="specter2",
        hf_model="allenai/specter2_base",
        dimensions=768,
        adapter="allenai/specter2",
    ),
}


def model_spec(model: str) -> PaperModelSpec:
    if model not in MODEL_SPECS:
        raise ValueError(
            f"Unknown paper-embed model {model!r}. Choose from: {', '.join(MODEL_SPECS)}"
        )
    return MODEL_SPECS[model]


def paper_text(title: str | None, abstract: str | None, *, sep: str) -> str:
    """SPECTER/SciNCL convention: title, then the tokenizer's SEP, then abstract."""
    title = (title or "").strip()
    abstract = (abstract or "").strip()
    if abstract:
        return f"{title}{sep}{abstract}"
    return title


@lru_cache(maxsize=2)
def _load(model: str):
    import torch  # noqa: F401  (ensures torch import error surfaces early)
    from transformers import AutoModel, AutoTokenizer

    spec = model_spec(model)
    tokenizer = AutoTokenizer.from_pretrained(spec.hf_model)
    mdl = None
    if spec.adapter:
        try:  # use the proximity adapter when the (transformers<4.58-pinned) lib is present
            from adapters import AutoAdapterModel

            mdl = AutoAdapterModel.from_pretrained(spec.hf_model)
            mdl.load_adapter(spec.adapter, source="hf", load_as=model, set_active=True)
        except Exception:  # pragma: no cover - depends on optional, conflicting extra
            mdl = None
    if mdl is None:
        mdl = AutoModel.from_pretrained(spec.hf_model)
    mdl.eval()
    return tokenizer, mdl


def _device():
    import torch

    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def embed_papers(
    texts: list[str],
    *,
    model: str,
    batch_size: int = 16,
    max_length: int = 512,
) -> list[list[float]]:
    """Embed pre-formatted ``title[SEP]abstract`` strings → L2-normalized CLS vectors."""
    if not texts:
        return []
    import torch

    tokenizer, mdl = _load(model)
    device = _device()
    mdl = mdl.to(device)

    out: list[list[float]] = []
    with torch.no_grad():
        for start in range(0, len(texts), batch_size):
            batch = texts[start:start + batch_size]
            enc = tokenizer(
                batch,
                padding=True,
                truncation=True,
                max_length=max_length,
                return_tensors="pt",
            ).to(device)
            result = mdl(**enc)
            cls = result.last_hidden_state[:, 0, :]  # [CLS] pooling
            cls = torch.nn.functional.normalize(cls, p=2, dim=1)
            out.extend(cls.cpu().tolist())
    return out
