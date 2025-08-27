-- Fix versioning constraint for scene_metadata table
-- This migration removes the unique constraint on scene_id and adds a composite unique constraint
-- that allows multiple versions of the same scene

-- Drop the existing unique constraint on scene_id
ALTER TABLE scene_metadata DROP CONSTRAINT IF EXISTS scene_metadata_scene_id_key;

-- Add a composite unique constraint that allows multiple versions of the same scene
-- but ensures no duplicate scene_id + version + user_id combinations
ALTER TABLE scene_metadata ADD CONSTRAINT scene_metadata_unique_version 
  UNIQUE (scene_id, version, user_id);

-- Add an index for better performance on version queries
CREATE INDEX IF NOT EXISTS idx_scene_metadata_scene_version_user 
  ON scene_metadata(scene_id, version, user_id);

-- Add an index for better performance on name + version + user queries
CREATE INDEX IF NOT EXISTS idx_scene_metadata_name_version_user 
  ON scene_metadata(name, version, user_id);

-- Update the get_next_version function to work with user_id
CREATE OR REPLACE FUNCTION get_next_version(scene_name TEXT, user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    next_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version), 0) + 1
    INTO next_version
    FROM scene_metadata
    WHERE name = scene_name AND user_id = user_uuid;
    
    RETURN next_version;
END;
$$ LANGUAGE plpgsql;

-- Update the update_latest_version function to work with user_id
CREATE OR REPLACE FUNCTION update_latest_version(scene_name TEXT, latest_scene_id TEXT, user_uuid UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE scene_metadata
    SET is_latest = (scene_id = latest_scene_id)
    WHERE name = scene_name AND user_id = user_uuid;
END;
$$ LANGUAGE plpgsql;
