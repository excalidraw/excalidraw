-- Supabase Migration Script for Excalidraw
-- Run this in your Supabase SQL Editor

-- Create scene_metadata table for exported scenes with versioning support
CREATE TABLE IF NOT EXISTS scene_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id TEXT NOT NULL UNIQUE,
  encryption_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_latest BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE scene_metadata ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (you may want to restrict these based on your needs)
-- For scene_metadata
CREATE POLICY "Allow all operations on scene_metadata" ON scene_metadata FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_scene_metadata_name ON scene_metadata(name);
CREATE INDEX IF NOT EXISTS idx_scene_metadata_version ON scene_metadata(version);
CREATE INDEX IF NOT EXISTS idx_scene_metadata_latest ON scene_metadata(is_latest);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for scene_metadata table
CREATE TRIGGER update_scene_metadata_updated_at BEFORE UPDATE ON scene_metadata
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get the next version number for a scene name
CREATE OR REPLACE FUNCTION get_next_version(scene_name TEXT)
RETURNS INTEGER AS $$
DECLARE
    next_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version), 0) + 1
    INTO next_version
    FROM scene_metadata
    WHERE name = scene_name;
    
    RETURN next_version;
END;
$$ LANGUAGE plpgsql;

-- Function to mark all versions of a scene as not latest except the specified one
CREATE OR REPLACE FUNCTION update_latest_version(scene_name TEXT, latest_scene_id TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE scene_metadata
    SET is_latest = (scene_id = latest_scene_id)
    WHERE name = scene_name;
END;
$$ LANGUAGE plpgsql;
