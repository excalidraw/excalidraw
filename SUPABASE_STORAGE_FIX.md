# Supabase Storage RLS Policy Fix

## Problem
You're getting this error when trying to save scenes:
```
StorageApiError: new row violates row-level security policy
```

This happens because Supabase Storage bucket policies are not configured correctly.

## IMPORTANT: Use Supabase Dashboard (NOT SQL)

⚠️ **You CANNOT use raw SQL to create storage policies!** ⚠️

Supabase Storage policies must be created through the Dashboard UI because `storage.objects` is a system table you don't have direct access to.

## Solution

### Step 1: Create the Storage Bucket
1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **Create bucket**
4. Name it: `diagram-files`
5. Make it **Private** (not public)
6. Click **Create bucket**

### Step 2: Configure Bucket Policies Through Dashboard
1. In your Supabase Dashboard, go to **Storage**
2. Click on the `diagram-files` bucket
3. Go to the **Policies** tab
4. For each policy, click **Create policy** and use these settings:

#### Policy 1: Allow Users to Upload Files
- **Name**: `Users can upload files`
- **Allowed operation**: `INSERT`
- **Policy definition**:
  ```sql
  bucket_id = 'diagram-files' AND auth.role() = 'authenticated'
  ```
- **Click Save**

#### Policy 2: Allow Users to View Files
- **Name**: `Users can view files`
- **Allowed operation**: `SELECT`
- **Policy definition**:
  ```sql
  bucket_id = 'diagram-files' AND auth.role() = 'authenticated'
  ```
- **Click Save**

#### Policy 3: Allow Users to Update Files
- **Name**: `Users can update files`
- **Allowed operation**: `UPDATE`
- **Policy definition**:
  ```sql
  bucket_id = 'diagram-files' AND auth.role() = 'authenticated'
  ```
- **Click Save**

#### Policy 4: Allow Users to Delete Files
- **Name**: `Users can delete files`
- **Allowed operation**: `DELETE`
- **Policy definition**:
  ```sql
  bucket_id = 'diagram-files' AND auth.role() = 'authenticated'
  ```
- **Click Save**

### Quick Fix: Make Bucket Public (Fastest Solution)
If you want an immediate fix:

1. Go to **Storage** → `diagram-files` bucket
2. Click **Settings** (gear icon)
3. Toggle **Public** to ON
4. Click **Save**

⚠️ **Warning**: This makes files publicly readable, but you still need write policies for uploads. This is less secure but works immediately!

### Proper Fix: Set Up Policies (Recommended)
For a secure solution, create the policies as described above in Step 2.

### Step 4: Test the Fix
1. Try saving a scene in your app
2. Check the browser console for any remaining errors
3. The error should be resolved

## Additional Notes

- The storage policies use `storage.foldername(name)` to extract the user ID from the file path
- Files are stored in paths like: `files/shareLinks/{sceneId}`
- The policies ensure users can only access their own files
- Make sure RLS is enabled on the storage.objects table

## Troubleshooting

If you still get errors:
1. Check that the bucket name matches exactly: `diagram-files`
2. Verify the user is properly authenticated
3. Check the browser network tab for more detailed error information
4. Ensure the policies were created successfully in the SQL editor

## Quick Temporary Workaround

While you set up the policies, you can temporarily disable auto-save to prevent the errors:

1. Open `excalidraw-app/App.tsx`
2. Find the `autoSaveScene` function (around line 760)
3. Replace the function body with:

```typescript
const autoSaveScene = useCallback(async (
  elements: readonly OrderedExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
) => {
  // Temporarily disabled due to storage permissions
  console.log('Auto-save disabled - enable storage policies to restore auto-save');
  return;
}, []);
```

This will prevent the auto-save errors while you configure the storage policies. Remember to re-enable it after fixing the policies!
