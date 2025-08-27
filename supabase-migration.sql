-- Supabase Migration Script for Excalidraw
-- Run this in your Supabase SQL Editor

-- Create diagrams table
CREATE TABLE IF NOT EXISTS diagrams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL UNIQUE,
  scene_version INTEGER NOT NULL,
  ciphertext BYTEA NOT NULL,
  iv BYTEA NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create diagram_files table
CREATE TABLE IF NOT EXISTS diagram_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL,
  file_data BYTEA NOT NULL,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(diagram_id, file_id)
);

-- Create scene_metadata table for exported scenes
CREATE TABLE IF NOT EXISTS scene_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id TEXT NOT NULL UNIQUE,
  encryption_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE diagrams ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagram_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE scene_metadata ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (you may want to restrict these based on your needs)
-- For diagrams
CREATE POLICY "Allow all operations on diagrams" ON diagrams FOR ALL USING (true);

-- For diagram_files
CREATE POLICY "Allow all operations on diagram_files" ON diagram_files FOR ALL USING (true);

-- For scene_metadata
CREATE POLICY "Allow all operations on scene_metadata" ON scene_metadata FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_diagrams_room_id ON diagrams(room_id);
CREATE INDEX IF NOT EXISTS idx_diagrams_created_at ON diagrams(created_at);
CREATE INDEX IF NOT EXISTS idx_diagram_files_diagram_id ON diagram_files(diagram_id);
CREATE INDEX IF NOT EXISTS idx_diagram_files_file_id ON diagram_files(file_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for diagrams table
CREATE TRIGGER update_diagrams_updated_at BEFORE UPDATE ON diagrams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
