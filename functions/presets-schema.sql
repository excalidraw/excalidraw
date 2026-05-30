CREATE TABLE IF NOT EXISTS terraform_import_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  builtin INTEGER NOT NULL DEFAULT 0,
  view TEXT NOT NULL CHECK (view IN ('semantic', 'module', 'pipeline')),
  root_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS terraform_import_preset_stacks (
  preset_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  stack_id TEXT NOT NULL,
  label TEXT NOT NULL,
  plan_path TEXT NOT NULL,
  dot_path TEXT NOT NULL,
  state_path TEXT,
  plan_text TEXT,
  dot_text TEXT,
  state_text TEXT,
  PRIMARY KEY (preset_id, sort_order),
  FOREIGN KEY (preset_id) REFERENCES terraform_import_presets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS terraform_import_preset_tfd (
  preset_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  path TEXT NOT NULL,
  content TEXT,
  PRIMARY KEY (preset_id, sort_order),
  FOREIGN KEY (preset_id) REFERENCES terraform_import_presets(id) ON DELETE CASCADE
);

-- Large plan/dot/state/tfd payloads are split when a single row exceeds D1 SQL limits.
CREATE TABLE IF NOT EXISTS terraform_import_preset_blob_chunks (
  preset_id TEXT NOT NULL,
  blob_kind TEXT NOT NULL,
  blob_key TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (preset_id, blob_kind, blob_key, chunk_index),
  FOREIGN KEY (preset_id) REFERENCES terraform_import_presets(id) ON DELETE CASCADE
);
