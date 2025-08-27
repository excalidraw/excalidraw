-- Migration to add is_automatic column to scene_metadata table
-- Run this in your Supabase SQL editor

ALTER TABLE scene_metadata 
ADD COLUMN IF NOT EXISTS is_automatic BOOLEAN DEFAULT FALSE;

-- Update existing records to have is_automatic = false
UPDATE scene_metadata 
SET is_automatic = FALSE 
WHERE is_automatic IS NULL;
