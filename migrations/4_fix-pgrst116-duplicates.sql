-- Fix PGRST116 Error: Remove Duplicate Records in scene_metadata
-- This script identifies and removes duplicate records that cause "Results contain 2 rows" errors

-- 1. First, let's see what duplicates exist
SELECT 
  name, 
  version, 
  user_id, 
  is_latest,
  COUNT(*) as duplicate_count,
  array_agg(scene_id) as scene_ids,
  array_agg(id) as record_ids
FROM scene_metadata 
GROUP BY name, version, user_id, is_latest
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, name;

-- 2. Show the actual duplicate records
WITH duplicates AS (
  SELECT 
    name, 
    version, 
    user_id, 
    is_latest,
    COUNT(*) as duplicate_count
  FROM scene_metadata 
  GROUP BY name, version, user_id, is_latest
  HAVING COUNT(*) > 1
)
SELECT 
  sm.*,
  d.duplicate_count
FROM scene_metadata sm
JOIN duplicates d ON 
  sm.name = d.name AND 
  sm.version = d.version AND 
  sm.user_id = d.user_id AND 
  sm.is_latest = d.is_latest
ORDER BY sm.name, sm.version, sm.created_at;

-- 3. Remove duplicates by keeping only the most recent record for each combination
-- This will fix the PGRST116 error by ensuring only one row exists per unique combination

DELETE FROM scene_metadata 
WHERE id IN (
  SELECT id FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY name, version, user_id, is_latest 
        ORDER BY created_at DESC, id DESC
      ) as rn
    FROM scene_metadata
  ) ranked
  WHERE rn > 1
);

-- 4. Verify duplicates are removed
SELECT 
  name, 
  version, 
  user_id, 
  is_latest,
  COUNT(*) as record_count
FROM scene_metadata 
GROUP BY name, version, user_id, is_latest
HAVING COUNT(*) > 1
ORDER BY record_count DESC, name;

-- 5. Add a unique constraint to prevent future duplicates
-- This will prevent the PGRST116 error from happening again

-- First, drop the constraint if it exists
ALTER TABLE scene_metadata DROP CONSTRAINT IF EXISTS unique_scene_metadata_combination;

-- Add a unique constraint on the combination that should be unique
ALTER TABLE scene_metadata 
ADD CONSTRAINT unique_scene_metadata_combination 
UNIQUE (name, version, user_id, is_latest);

-- 6. Show final table statistics
SELECT 
  'Total records' as metric,
  COUNT(*) as value
FROM scene_metadata
UNION ALL
SELECT 
  'Unique combinations' as metric,
  COUNT(DISTINCT (name, version, user_id, is_latest)) as value
FROM scene_metadata
UNION ALL
SELECT 
  'Users with data' as metric,
  COUNT(DISTINCT user_id) as value
FROM scene_metadata
UNION ALL
SELECT 
  'Latest versions' as metric,
  COUNT(*) as value
FROM scene_metadata
WHERE is_latest = true;

-- 7. Test query that was causing PGRST116 error
-- This should now return at most 1 row per combination
SELECT 
  name,
  version,
  user_id,
  is_latest,
  COUNT(*) as row_count
FROM scene_metadata
GROUP BY name, version, user_id, is_latest
ORDER BY name, version;
