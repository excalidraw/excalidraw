#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TTD_DIR="$ROOT_DIR/packages/excalidraw/components/TTDDialog"

echo "🔧 Applying Grail patches..."

if [ -f "$TTD_DIR/VoiceButton.tsx" ]; then
  echo "✓ Patches already applied"
  exit 0
fi

cp "$SCRIPT_DIR/voice/VoiceButton.tsx" "$TTD_DIR/"
echo "  ✓ VoiceButton.tsx"

for patch in "$SCRIPT_DIR/voice/"*.patch; do
  patchname=$(basename "$patch")
  if git apply --check "$patch" 2>/dev/null; then
    git apply "$patch"
    echo "  ✓ $patchname"
  else
    echo "  ⚠ $patchname (already applied or conflict)"
  fi
done

echo "🧠 Applying prompt-mode patches..."
for patch in "$SCRIPT_DIR/prompt-mode/"*.patch; do
  patchname=$(basename "$patch")
  if git apply --check "$patch" 2>/dev/null; then
    git apply "$patch"
    echo "  ✓ $patchname"
  else
    echo "  ⚠ $patchname (already applied or conflict)"
  fi
done

echo "✅ Grail patches applied!"
