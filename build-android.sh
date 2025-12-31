#!/bin/bash
# Build Excalidraw Android APK using Docker
# Usage: ./build-android.sh [--rebuild-base] [--release]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

echo_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

echo_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse arguments
BUILD_TYPE="debug"
REBUILD_BASE=false

for arg in "$@"; do
    case $arg in
        --release)
            BUILD_TYPE="release"
            ;;
        --rebuild-base)
            REBUILD_BASE=true
            ;;
        --help)
            echo "Usage: ./build-android.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --rebuild-base  Force rebuild of base Docker image"
            echo "  --release       Build release APK (not implemented yet)"
            echo "  --help          Show this help message"
            exit 0
            ;;
    esac
done

# Image names
BASE_IMAGE="excalidraw-android-base"
BUILD_IMAGE="excalidraw-android"
OUTPUT_DIR="$SCRIPT_DIR/output"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo_info "=== Excalidraw Android Build ==="
echo_info "Build type: $BUILD_TYPE"
echo_info "Output directory: $OUTPUT_DIR"
echo ""

# Step 1: Build base image if it doesn't exist or rebuild requested
if ! docker image inspect "$BASE_IMAGE" &>/dev/null || [[ "$REBUILD_BASE" == true ]]; then
    if [[ "$REBUILD_BASE" == true ]]; then
        echo_info "Rebuilding base image (--rebuild-base flag set)..."
        docker build --no-cache -t "$BASE_IMAGE" -f Dockerfile.android-base .
    else
        echo_info "Building base image (this may take a while on first run)..."
        docker build -t "$BASE_IMAGE" -f Dockerfile.android-base .
    fi
    echo_success "Base image built successfully"
else
    echo_info "Base image already exists. Use --rebuild-base to force rebuild."
fi

# Step 2: Build the app image
echo_info "Building Excalidraw Android app..."
docker build -t "$BUILD_IMAGE" -f Dockerfile.android .
echo_success "App image built successfully"

# Step 3: Run the container to export the APK
echo_info "Exporting APK..."
docker run --rm -v "$OUTPUT_DIR:/output" "$BUILD_IMAGE"

# Check if APK was exported
if [[ -f "$OUTPUT_DIR/excalidraw-debug.apk" ]]; then
    APK_SIZE=$(du -h "$OUTPUT_DIR/excalidraw-debug.apk" | cut -f1)
    echo ""
    echo_success "=== Build Complete ==="
    echo_success "APK: $OUTPUT_DIR/excalidraw-debug.apk ($APK_SIZE)"
    echo ""
    echo_info "To install on a connected device:"
    echo "  adb install $OUTPUT_DIR/excalidraw-debug.apk"
else
    echo_error "APK was not generated. Check build logs above."
    exit 1
fi
