#!/usr/bin/env bash
# Report-only Oxlint pass (v1). Remove "|| true" once baseline warnings are cleared.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

PATHS=()
shopt -s nullglob
for f in \
  packages/excalidraw/components/terraformLayoutCore.ts \
  packages/excalidraw/components/terraformSceneApply.ts \
  packages/excalidraw/components/terraformImportMerge.ts \
  packages/excalidraw/components/terraformImportDialogUtils.ts \
  packages/excalidraw/components/terraformElementActionsSelection.ts \
  packages/excalidraw/components/useTerraformImportDialog.ts \
  packages/excalidraw/components/useTerraformRelationshipFocusEffect.ts \
  packages/excalidraw/components/TerraformSelectedShapeActions.tsx \
  packages/excalidraw/components/TerraformImportDialog.tsx \
  packages/excalidraw/components/terraform*.ts \
  packages/excalidraw/components/terraform*.tsx \
  packages/excalidraw/components/Terraform*.tsx; do
  PATHS+=("$f")
done
shopt -u nullglob

echo "Oxlint (report-only): ${#PATHS[@]} files"
yarn oxlint "${PATHS[@]}" || true
exit 0
