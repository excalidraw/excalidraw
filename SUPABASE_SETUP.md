# Supabase Setup for Excalidraw

## Prerequisites

1. Create a Supabase account at [supabase.com](https://supabase.com)
2. Create a new project in your Supabase dashboard

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Legacy Firebase (leave empty if migrating from Firebase)
VITE_APP_FIREBASE_CONFIG={}
```

You can find these values in your Supabase project dashboard under Settings > API.

## Database Schema

The following tables will be created in your Supabase database:

### `diagrams`

```sql
CREATE TABLE diagrams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL UNIQUE,
  scene_version INTEGER NOT NULL,
  ciphertext BYTEA NOT NULL,
  iv BYTEA NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE diagrams ENABLE ROW LEVEL SECURITY;

-- Create policy for public read/write access (you may want to restrict this)
CREATE POLICY "Allow all operations on diagrams" ON diagrams FOR ALL USING (true);
```

### `diagram_files`

```sql
CREATE TABLE diagram_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagram_id UUID REFERENCES diagrams(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL,
  file_data BYTEA NOT NULL,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(diagram_id, file_id)
);

-- Enable RLS
ALTER TABLE diagram_files ENABLE ROW LEVEL SECURITY;

-- Create policy for public read/write access
CREATE POLICY "Allow all operations on diagram_files" ON diagrams FOR ALL USING (true);
```

## Storage Bucket (for files)

Create a storage bucket named `diagram-files` in your Supabase dashboard:

1. Go to **Storage** in your Supabase dashboard
2. Create a new bucket called `diagram-files`
3. **Important**: Set it to **public** if you want files to be publicly accessible
4. **Disable RLS** for the bucket (see troubleshooting below if you get permission errors)

## Troubleshooting

### Storage Upload Errors

If you get **"new row violates row-level security policy"** error when exporting:

1. Go to your Supabase dashboard → **Storage** → **diagram-files** bucket
2. Click the **Settings** tab (gear icon)
3. **Disable RLS** by toggling off "Enable Row Level Security"
4. Click **Save changes**

This will allow anonymous uploads to the storage bucket. For production, you should implement proper authentication and RLS policies.

### Alternative: Use Service Role Key

For better security, you can use the service role key instead of the anonymous key:

1. In your Supabase dashboard → **Settings** → **API**
2. Copy the **service_role** key (keep this secret!)
3. Update your `.env.local`:
   ```bash
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-service-role-key  # Use service_role key instead
   ```

## Loading Exported Scenes

When you export a scene, it generates a URL like: `http://localhost:3000#json=S3RreFQexcdt,encryptionKey`

To load the scene:
1. **Copy the URL** that opens after export
2. **Open it in any browser** - the app will automatically load from Supabase Storage
3. **The scene loads** with all elements, images, and data intact

## Storage vs Database

- **Database (`diagrams` table)**: Used for collaborative sessions and real-time editing
- **Storage (`files/shareLinks/`)**: Used for exported shareable scenes
- **Both are persistent** and accessible via URLs

## Next Steps

After setting up your Supabase project and environment variables, the application will automatically use Supabase for storing diagrams instead of Firebase.
