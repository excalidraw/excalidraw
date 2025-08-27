# Excalidraw Supabase Integration

This document explains how to set up and use Supabase for storing Excalidraw diagrams in a self-hosted environment.

## Overview

The Supabase integration replaces Firebase with Supabase for:
- **Diagram Storage**: Encrypted diagrams stored in Supabase database
- **File Storage**: Images and other files stored in Supabase Storage
- **Real-time Collaboration**: Live collaboration features continue to work

## Prerequisites

1. **Supabase Account**: Create an account at [supabase.com](https://supabase.com)
2. **Supabase Project**: Create a new project in your Supabase dashboard

## Setup Instructions

### 1. Environment Variables

Create a `.env.local` file in the root directory of your project:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

> **Note**: Replace `your-project-ref` and `your-supabase-anon-key` with your actual Supabase project URL and anonymous key. You can find these in your Supabase dashboard under **Settings > API**.

### 2. Database Setup

Run the SQL migration script in your Supabase dashboard:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase-migration.sql`
4. Click **Run** to execute the migration

This will create:
- `diagrams` table for storing encrypted diagrams
- `diagram_files` table for file metadata
- Proper indexes and RLS policies

### 3. Storage Setup

Create a storage bucket for diagram files:

1. In your Supabase dashboard, go to **Storage**
2. Click **Create bucket**
3. Name it `diagram-files`
4. Set it to **Public** (so files can be accessed publicly)
5. Click **Create bucket**

## Features

### Diagram Storage
- **Encrypted Storage**: Diagrams are encrypted before storage using the same encryption as Firebase
- **Version Control**: Scene versions are tracked to prevent unnecessary saves
- **Conflict Resolution**: Automatic reconciliation of concurrent edits

### File Storage
- **Image Upload**: Images and other files are uploaded to Supabase Storage
- **Compression**: Files are compressed before upload
- **Public Access**: Files are publicly accessible via Supabase Storage URLs

### Real-time Collaboration
- **Live Editing**: Multiple users can collaborate in real-time
- **Socket.IO Integration**: Collaboration continues to work through Socket.IO
- **Room-based**: Users join rooms for collaborative editing

## API Functions

The Supabase integration provides the following main functions:

### Diagram Operations
- `saveToSupabase()` - Save a diagram to Supabase
- `loadFromSupabase()` - Load a diagram from Supabase
- `isSavedToSupabase()` - Check if diagram is already saved

### File Operations
- `saveFilesToSupabase()` - Upload files to Supabase Storage
- `loadFilesFromSupabase()` - Download files from Supabase Storage

## Migration from Firebase

If you're migrating from Firebase:

1. **Environment Variables**: Update your environment variables as described above
2. **Database Migration**: The new Supabase functions will automatically handle data storage
3. **No Data Migration**: Existing Firebase data will remain accessible through Firebase (if you keep the Firebase config)

## Security Considerations

### Row Level Security (RLS)
The database tables use RLS policies that allow public access. For production use, you may want to:

1. **Restrict Access**: Implement authentication-based policies
2. **Add User Authentication**: Integrate with Supabase Auth for user-specific diagrams
3. **API Key Security**: Use service role key for server-side operations instead of anonymous key

### Environment Variables
- **Keep Keys Secret**: Never commit `.env.local` to version control
- **Use Different Keys**: Consider using different keys for development and production
- **Rotate Keys**: Regularly rotate your Supabase keys

## Troubleshooting

### Common Issues

1. **Environment Variables Not Loaded**
   - Ensure `.env.local` is in the root directory
   - Restart your development server
   - Check that variable names match exactly

2. **Database Connection Errors**
   - Verify your Supabase URL and key
   - Check that the database tables exist
   - Ensure RLS policies allow your operations

3. **File Upload Errors**
   - Verify the `diagram-files` bucket exists
   - Check bucket permissions
   - Ensure you have sufficient Supabase Storage quota

4. **Collaboration Not Working**
   - Ensure Socket.IO server is running
   - Check WebSocket connection
   - Verify room creation and joining logic

### Debug Mode
Enable debug logging by setting:
```bash
VITE_APP_DEBUG=true
```

## Performance Optimization

### Database
- **Indexes**: The migration includes optimized indexes
- **Caching**: Scene versions are cached to prevent unnecessary saves
- **Batch Operations**: Multiple operations are batched where possible

### Storage
- **Compression**: Files are compressed before upload
- **Caching**: Files have cache headers for optimal performance
- **CDN**: Supabase Storage serves files through a global CDN

## Next Steps

After setup, you can:

1. **Test the Integration**: Create and save diagrams to verify everything works
2. **Customize Security**: Implement authentication and authorization
3. **Monitor Usage**: Use Supabase dashboard to monitor database and storage usage
4. **Scale**: Consider Supabase's paid plans for production use

## Support

For issues related to:
- **Excalidraw**: Check the main Excalidraw repository
- **Supabase**: Visit Supabase documentation and community
- **Integration**: Refer to this documentation or create an issue

## Files Modified

The following files were modified/created for Supabase integration:

- `excalidraw-app/data/supabase.ts` - Main Supabase client
- `excalidraw-app/data/index.ts` - Updated to use Supabase
- `excalidraw-app/collab/Collab.tsx` - Updated collaboration logic
- `excalidraw-app/App.tsx` - Updated file loading
- `excalidraw-app/app_constants.ts` - Renamed storage constants
- `excalidraw-app/tests/collab.test.tsx` - Updated test mocks
- `supabase-migration.sql` - Database schema
- `SUPABASE_SETUP.md` - Setup instructions
- `.env.example` - Environment template
