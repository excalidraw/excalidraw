from pathlib import Path

PKG_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PKG_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PDF_DIR = RAW_DIR / "pdf"
HTML_DIR = RAW_DIR / "html"
MANIFEST_PATH = DATA_DIR / "manifest.json"
LANCE_DIR = DATA_DIR / "lancedb"
INGEST_STATE_PATH = DATA_DIR / "ingest_state.json"
CHUNKS_TABLE = "chunks"
