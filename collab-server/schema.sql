CREATE TABLE IF NOT EXISTS room_aliases (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  alias VARCHAR(191) NOT NULL,
  room_id VARCHAR(64) NOT NULL,
  room_key VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_room_aliases_alias (alias),
  UNIQUE KEY uk_room_aliases_room_id (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS room_scene_snapshots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id VARCHAR(64) NOT NULL,
  encrypted_data LONGBLOB NOT NULL,
  iv VARBINARY(64) NOT NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'hourly',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_room_scene_snapshots_room_created (room_id, created_at),
  KEY idx_room_scene_snapshots_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS room_scene_latest (
  room_id VARCHAR(64) NOT NULL,
  encrypted_data LONGBLOB NOT NULL,
  iv VARBINARY(64) NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id),
  KEY idx_room_scene_latest_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
