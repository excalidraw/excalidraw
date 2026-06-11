from pathlib import Path

PKG_ROOT = Path(__file__).resolve().parents[2]
REPO_RAG_ROOT = PKG_ROOT.parent / "repo-rag"
ENV_PATH = PKG_ROOT / ".env"
ENV_EXAMPLE_PATH = PKG_ROOT / ".env.example"
REPO_RAG_ENV_PATH = REPO_RAG_ROOT / ".env"
DATA_DIR = PKG_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PDF_DIR = RAW_DIR / "pdf"
HTML_DIR = RAW_DIR / "html"
MANIFEST_PATH = DATA_DIR / "manifest.json"
LANCE_DIR = DATA_DIR / "lancedb"
INGEST_STATE_PATH = DATA_DIR / "ingest_state.json"
CHUNKS_TABLE = "chunks"

# OpenAI text-embedding-3-large pricing (USD per 1M input tokens)
EMBED_COST_PER_MILLION_TOKENS = 0.13
