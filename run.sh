#!/bin/bash

# Define colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting Excalidraw Local Development Environment (Docker)...${NC}"

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker could not be found. Please install Docker."
    exit 1
fi

echo -e "${GREEN}Building and starting container...${NC}"
echo -e "${BLUE}The app will be available at http://localhost:5173${NC}"

# Run docker compose
docker compose up --build
