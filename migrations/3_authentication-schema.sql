-- Authentication Schema Migration for Excalidraw
-- Run this in your Supabase SQL Editor after enabling authentication
-- This migration only affects the scene_metadata table (diagrams and diagram_files tables are not included)

-- Enable the auth schema and necessary extensions
-- Note: Supabase automatically creates the auth schema when you enable authentication

-- Create profiles table to extend auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create function to handle user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function for profiles (reuse from scene_metadata)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for profiles table
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add user_id to existing tables
ALTER TABLE scene_metadata ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing data to be owned by a default user or make user_id nullable initially
-- Note: In production, you might want to handle this differently

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_scene_metadata_user_id ON scene_metadata(user_id);

-- Update RLS policies to enforce user-based access control

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all operations on scene_metadata" ON scene_metadata;

-- Create new user-based policies for scene_metadata
CREATE POLICY "Users can view own scene_metadata" ON scene_metadata
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scene_metadata" ON scene_metadata
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scene_metadata" ON scene_metadata
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scene_metadata" ON scene_metadata
  FOR DELETE USING (auth.uid() = user_id);

-- Create a function to get user's diagrams with metadata
CREATE OR REPLACE FUNCTION get_user_diagrams()
RETURNS TABLE (
  scene_id TEXT,
  name TEXT,
  description TEXT,
  version INTEGER,
  is_latest BOOLEAN,
  is_automatic BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sm.scene_id,
    sm.name,
    sm.description,
    sm.version,
    sm.is_latest,
    sm.is_automatic,
    sm.created_at,
    sm.updated_at
  FROM scene_metadata sm
  WHERE sm.user_id = auth.uid()
  ORDER BY sm.updated_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get user's storage usage
CREATE OR REPLACE FUNCTION get_user_storage_usage()
RETURNS TABLE (
  total_files BIGINT,
  total_size_bytes BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_files,
    COALESCE(SUM(octet_length(df.file_data)), 0) as total_size_bytes
  FROM diagram_files df
  WHERE df.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
