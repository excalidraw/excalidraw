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
  content_hash CHAR(64) NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'history',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_room_scene_snapshots_room_created (room_id, created_at),
  KEY idx_room_scene_snapshots_room_hash (room_id, content_hash),
  KEY idx_room_scene_snapshots_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS room_scene_latest (
  room_id VARCHAR(64) NOT NULL,
  encrypted_data LONGBLOB NOT NULL,
  iv VARBINARY(64) NOT NULL,
  content_hash CHAR(64) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id),
  KEY idx_room_scene_latest_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  qq_openid VARCHAR(191) NOT NULL,
  nickname VARCHAR(191) NOT NULL,
  avatar_url TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_qq_openid (qq_openid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_auth_sessions_token_hash (token_hash),
  KEY idx_auth_sessions_user_id (user_id),
  KEY idx_auth_sessions_expires_at (expires_at),
  CONSTRAINT fk_auth_sessions_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
