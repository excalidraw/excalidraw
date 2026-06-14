import os
from pathlib import Path

PKG_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = PKG_ROOT.parent.parent
ENV_PATH = PKG_ROOT / ".env"
ENV_EXAMPLE_PATH = PKG_ROOT / ".env.example"

# Data dir is overridable so an isolated/sample index (e.g. validating contextual
# retrieval or a new embed profile) never clobbers the production index at data/.
_data_override = os.getenv("REPO_RAG_DATA_DIR")
DATA_DIR = Path(_data_override).expanduser().resolve() if _data_override else PKG_ROOT / "data"
DEFAULT_LOG_FILE = DATA_DIR / "repo-rag.log"
MANIFEST_PATH = DATA_DIR / "manifest.json"
LANCE_DIR = DATA_DIR / "lancedb"
BM25_DIR = DATA_DIR / "bm25"
INGEST_STATE_PATH = DATA_DIR / "ingest_state.json"
CHUNKS_TABLE = "chunks"
EVAL_QUERIES_PATH = PKG_ROOT / "eval" / "queries.json"
GRAPH_DB_PATH = DATA_DIR / "graph.sqlite"

# OpenAI text-embedding-3-large pricing (USD per 1M input tokens)
EMBED_COST_PER_MILLION_TOKENS = 0.13
