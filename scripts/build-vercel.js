#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting Vercel build for Excalidraw...');

try {
  // Build all packages first
  console.log('📦 Building packages...');
  execSync('yarn build:packages', { 
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });

  // Build the app
  console.log('🏗️ Building Excalidraw app...');
  execSync('yarn build:app', { 
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '../excalidraw-app')
  });

  // Build version info
  console.log('📝 Building version info...');
  execSync('yarn build:version', { 
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '../excalidraw-app')
  });

  // Verify the build output exists
  const buildPath = path.resolve(__dirname, '../excalidraw-app/build');
  const fs = require('fs');
  if (!fs.existsSync(buildPath)) {
    throw new Error(`Build output not found at ${buildPath}`);
  }
  
  console.log('✅ Vercel build completed successfully!');
  console.log(`📁 Build output: ${buildPath}`);
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
