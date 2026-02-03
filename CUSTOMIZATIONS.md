# Excalidraw Customizations Summary

## Overview
This document tracks all customizations made to the Excalidraw project to avoid port conflicts on localhost.

## Changes Made

### 1. Docker Compose Port Configuration
**File:** `docker-compose.yml`
- **Change:** Updated container port mapping from `3000:80` to `3081:80`
- **Reason:** Port 3000 conflicts with other localhost services
- **Impact:** Docker container now exposes the app on port 3081

### 2. Development Environment Configuration
**File:** `.env.development`
- **Change:** Updated `VITE_APP_PLUS_APP` from `http://localhost:3000` to `http://localhost:3081`
- **Reason:** Align with new Docker port configuration
- **Impact:** Development environment references correct port for Plus app integration

## Access Points
After these changes, the application is accessible at:
- **Docker Container:** http://localhost:3081
- **Dev Server:** http://localhost:3001 (configured via `VITE_APP_PORT` in `.env.development`)

## Repository Setup
- **Upstream:** excalidraw/excalidraw (main repository)
- **Fork:** github.com/JZKK720/excalidraw.git
- **Branch:** custom-port-3081

## Notes
- These changes are maintained in a separate branch to avoid conflicts with upstream
- Port 3081 is used to avoid common localhost conflicts
- No changes made to core application logic, only configuration files
