# Terraform components ↔ tests map

Co-located tests use `terraform*.test.ts(x)` next to sources. This checklist is the regression inventory.

| Source | Test file | Notes |
| --- | --- | --- |
| `terraformAllplanmodulesRouteAlignment` (if any) | `terraformAllplanmodulesRouteAlignment.test.ts` |  |
| `terraformAwsIcons.ts` | `terraformAwsIcons.test.ts` | Icon library load + inject |
| `terraformColorWash.ts` | `terraformColorWash.test.ts` (relationship tests import `washHexColor`) | Parse / dim / restore |
| `terraformDataFlowEdges.ts` | `terraformDataFlowEdges.test.ts` | Parity with backend pipeline |
| `terraformElementMetadata.ts` | `terraformElementMetadata.test.ts` | Guards + graph address |
| `terraformElkLayout.ts` | `terraformElkLayout.test.ts` |  |
| `terraformExplodeGraph.ts` | `terraformExplodeGraph.test.ts` |  |
| `terraformLayoutComfort.ts` | (via layout / icons `tfComfortPx`) | No dedicated file |
| `terraformLayoutDuplicateGlyphs.ts` | `terraformLayoutDuplicateGlyphs.test.ts` |  |
| `terraformNetworkingVertex.ts` | `terraformNetworkingVertex.test.ts` |  |
| `terraformPlanMeta.ts` | imported in plan/elk tests | Constants only |
| `terraformPlanParsing.tsx` | `terraformPlanParsing.test.ts` |  |
| `terraformPrimaryVisibility.ts` | `terraformPrimaryVisibility.test.ts` |  |
| `terraformRelationshipFocus.ts` | `terraformRelationshipFocus.test.ts` |  |
| `terraformResourceCardLabel.ts` | `terraformResourceCardLabel.test.ts` |  |
| `terraformResourceHumanName.ts` | `terraformResourceHumanName.test.ts` |  |
| `terraformTopology*.ts` link modules | matching `*.test.ts` |  |
| `terraformTopologySgRulePlanConfig.ts` | `terraformTopologySgRulePlanConfig.test.ts` |  |
| `terraformTopologyLayout.ts` | `terraformTopologyLayout.test.ts` |  |
| `terraformTopologyPlacement.ts` | `terraformTopologyPlacement.test.ts` |  |
| `terraformTopologyExtract.ts` | `terraformTopologyExtract.test.ts` |  |
| `terraformVisibility.ts` | `terraformElkLayout.test.ts`, `terraformRelationshipFocus.test.ts`, `terraformVisibility.edgePins.test.ts` |  |
| `TerraformImportDialog.tsx` | `TerraformImportDialog.test.tsx` | Modal + mocks |
| `terraformDragLabels.ts` | `terraformDragLabels.test.ts` |  |

App-level explode behavior on a minimal editor scene is covered in `packages/excalidraw/tests/terraformAppIntegration.test.tsx` (uses `toggleTerraformExplode` + `API.updateScene`, matching the helper invoked from `App`).
