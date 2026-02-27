const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId, GridFSBucket } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3003;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongodb:27017/excalidraw';
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost,http://localhost:80').split(',');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '4194304'); // 4MB default

let db;
let bucket;

// Middleware
app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.raw({ type: 'application/octet-stream', limit: '5mb' }));

// MongoDB connection
async function connectDB() {
  try {
    const client = await MongoClient.connect(MONGODB_URI);
    db = client.db();
    bucket = new GridFSBucket(db, { bucketName: 'files' });
    
    // Create indexes
    await db.collection('rooms').createIndex({ roomId: 1 }, { unique: true });
    await db.collection('rooms').createIndex({ updatedAt: -1 });
    await db.collection('rooms').createIndex({ displayName: 1 });
    
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Helper: Generate default room name
function generateDefaultRoomName() {
  const date = new Date().toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
  return `Untitled Room - ${date}`;
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 1. Get Room Data
app.get('/api/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const room = await db.collection('rooms').findOne({ roomId });
    
    if (!room) {
      return res.status(404).json({
        error: 'Room not found',
        roomId
      });
    }
    
    // Update last accessed time
    await db.collection('rooms').updateOne(
      { roomId },
      { $set: { lastAccessedAt: new Date() } }
    );
    
    res.json({
      roomId: room.roomId,
      displayName: room.displayName,
      data: {
        iv: room.iv.toString('base64'),
        ciphertext: room.ciphertext.toString('base64')
      },
      sceneVersion: room.sceneVersion,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      lastAccessedAt: new Date()
    });
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// 2. Save/Update Room Data
app.post('/api/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { iv, ciphertext, sceneVersion, displayName } = req.body;
    
    // Validation
    if (!iv || !ciphertext) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Missing required fields: iv, ciphertext'
      });
    }
    
    const roomData = {
      roomId,
      displayName: displayName || generateDefaultRoomName(),
      iv: Buffer.from(iv, 'base64'),
      ciphertext: Buffer.from(ciphertext, 'base64'),
      sceneVersion: sceneVersion || 0,
      updatedAt: new Date(),
      lastAccessedAt: new Date()
    };
    
    // Check if room exists
    const existing = await db.collection('rooms').findOne({ roomId });
    
    if (!existing) {
      roomData.createdAt = new Date();
    }
    
    await db.collection('rooms').updateOne(
      { roomId },
      { $set: roomData },
      { upsert: true }
    );
    
    res.json({
      success: true,
      roomId,
      sceneVersion: roomData.sceneVersion,
      updatedAt: roomData.updatedAt
    });
  } catch (error) {
    console.error('Error saving room:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// 3. Upload File
app.post('/api/files/:prefix/:fileId', async (req, res) => {
  try {
    const { prefix, fileId } = req.params;
    const fileData = req.body;
    
    if (!Buffer.isBuffer(fileData)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Request body must be binary data'
      });
    }
    
    if (fileData.length > MAX_FILE_SIZE) {
      return res.status(413).json({
        error: 'File too large',
        maxSize: MAX_FILE_SIZE,
        receivedSize: fileData.length
      });
    }
    
    const filename = `${prefix}/${fileId}`;
    
    // Check if file already exists and delete it
    const existingFiles = await bucket.find({ filename }).toArray();
    for (const file of existingFiles) {
      await bucket.delete(file._id);
    }
    
    // Upload new file
    const uploadStream = bucket.openUploadStream(filename, {
      metadata: {
        prefix,
        fileId,
        uploadedAt: new Date()
      }
    });
    
    await new Promise((resolve, reject) => {
      uploadStream.on('finish', resolve);
      uploadStream.on('error', reject);
      uploadStream.end(fileData);
    });
    
    res.json({
      success: true,
      fileId,
      prefix,
      size: fileData.length,
      uploadedAt: new Date()
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// 4. Download File
app.get('/api/files/:prefix/:fileId', async (req, res) => {
  try {
    const { prefix, fileId } = req.params;
    const filename = `${prefix}/${fileId}`;
    
    const files = await bucket.find({ filename }).toArray();
    
    if (files.length === 0) {
      return res.status(404).json({
        error: 'File not found',
        fileId,
        prefix
      });
    }
    
    const file = files[0];
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('Content-Length', file.length);
    
    const downloadStream = bucket.openDownloadStream(file._id);
    downloadStream.pipe(res);
    
    downloadStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error',
          message: error.message
        });
      }
    });
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// 5. Get Multiple Files Metadata
app.post('/api/files/metadata', async (req, res) => {
  try {
    const { files } = req.body;
    
    if (!Array.isArray(files)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'files must be an array'
      });
    }
    
    const results = await Promise.all(
      files.map(async ({ prefix, fileId }) => {
        const filename = `${prefix}/${fileId}`;
        const found = await bucket.find({ filename }).toArray();
        
        if (found.length > 0) {
          return {
            fileId,
            prefix,
            exists: true,
            size: found[0].length
          };
        }
        
        return {
          fileId,
          prefix,
          exists: false
        };
      })
    );
    
    res.json({ files: results });
  } catch (error) {
    console.error('Error fetching file metadata:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// 6. List All Rooms
app.get('/api/rooms', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    const sortBy = req.query.sortBy || 'updatedAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    
    const sortField = ['updatedAt', 'createdAt', 'displayName'].includes(sortBy) 
      ? sortBy 
      : 'updatedAt';
    
    const total = await db.collection('rooms').countDocuments();
    
    const rooms = await db.collection('rooms')
      .find({})
      .project({
        roomId: 1,
        displayName: 1,
        createdAt: 1,
        updatedAt: 1,
        lastAccessedAt: 1,
        _id: 0
      })
      .sort({ [sortField]: sortOrder })
      .skip(offset)
      .limit(limit)
      .toArray();
    
    // Add isActive flag (active if accessed in last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const roomsWithStatus = rooms.map(room => ({
      ...room,
      isActive: room.lastAccessedAt > oneHourAgo
    }));
    
    res.json({
      rooms: roomsWithStatus,
      total,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error listing rooms:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// 7. Get Room Metadata
app.get('/api/rooms/:roomId/metadata', async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const room = await db.collection('rooms').findOne(
      { roomId },
      { 
        projection: {
          roomId: 1,
          displayName: 1,
          createdAt: 1,
          updatedAt: 1,
          lastAccessedAt: 1,
          sceneVersion: 1,
          _id: 0
        }
      }
    );
    
    if (!room) {
      return res.status(404).json({
        error: 'Room not found',
        roomId
      });
    }
    
    res.json(room);
  } catch (error) {
    console.error('Error fetching room metadata:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// 8. Update Room Metadata
app.put('/api/rooms/:roomId/metadata', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { displayName } = req.body;
    
    // Validation
    if (!displayName || typeof displayName !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'displayName is required and must be a string'
      });
    }
    
    if (displayName.length < 1 || displayName.length > 100) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Display name must be between 1 and 100 characters'
      });
    }
    
    const result = await db.collection('rooms').updateOne(
      { roomId },
      { 
        $set: { 
          displayName,
          updatedAt: new Date()
        }
      }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        error: 'Room not found',
        roomId
      });
    }
    
    res.json({
      success: true,
      roomId,
      displayName,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error updating room metadata:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Start server
connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Excalidraw Backend API running on http://0.0.0.0:${PORT}`);
    console.log(`📊 MongoDB URI: ${MONGODB_URI}`);
    console.log(`🔒 CORS Origins: ${CORS_ORIGINS.join(', ')}`);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});
