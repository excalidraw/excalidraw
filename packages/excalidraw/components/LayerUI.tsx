import clsx from "clsx";
import React from "react";

import {
  CLASSES,
  DEFAULT_SIDEBAR,
  TOOL_TYPE,
  arrayToMap,
  capitalizeString,
  isShallowEqual,
} from "@excalidraw/common";

import { mutateElement, newElementWith } from "@excalidraw/element";

import { showSelectedShapeActions } from "@excalidraw/element";

import { ShapeCache } from "@excalidraw/element";

import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import { actionToggleStats } from "../actions";
import { trackEvent } from "../analytics";
import { TunnelsContext, useInitializeTunnels } from "../context/tunnels";
import { UIAppStateContext } from "../context/ui-appState";
import { useAtom, useAtomValue } from "../editor-jotai";

import { t } from "../i18n";
import { calculateScrollCenter } from "../scene";

import {
  SelectedShapeActions,
  ShapesSwitcher,
  CompactShapeActions,
} from "./Actions";
import { LoadingMessage } from "./LoadingMessage";
import { LockButton } from "./LockButton";
import { MobileMenu } from "./MobileMenu";
import { PasteChartDialog } from "./PasteChartDialog";
import { Section } from "./Section";
import Stack from "./Stack";
import { UserList } from "./UserList";
import { PenModeButton } from "./PenModeButton";
import Footer from "./footer/Footer";
import { isSidebarDockedAtom } from "./Sidebar/Sidebar";
import MainMenu from "./main-menu/MainMenu";
import { ActiveConfirmDialog } from "./ActiveConfirmDialog";
import { useEditorInterface, useStylesPanelMode } from "./App";
import { OverwriteConfirmDialog } from "./OverwriteConfirm/OverwriteConfirm";
import { sidebarRightIcon } from "./icons";
import { DefaultSidebar } from "./DefaultSidebar";
import { TTDDialog } from "./TTDDialog/TTDDialog";
import { Stats } from "./Stats";
import ElementLinkDialog from "./ElementLinkDialog";
import { ErrorDialog } from "./ErrorDialog";
import { EyeDropper, activeEyeDropperAtom } from "./EyeDropper";
import { FixedSideContainer } from "./FixedSideContainer";
import { HelpDialog } from "./HelpDialog";
import { HintViewer } from "./HintViewer";
import { ImageExportDialog } from "./ImageExportDialog";
import { TerraformImportDialog } from "./TerraformImportDialog";
import { repairTerraformEdgeBindings } from "./terraformVisibility";
import { Island } from "./Island";
import { JSONExportDialog } from "./JSONExportDialog";
import { LaserPointerButton } from "./LaserPointerButton";
import { Toast } from "./Toast";

import "./LayerUI.scss";
import "./Toolbar.scss";

import type { ActionManager } from "../actions/manager";

import type { Language } from "../i18n";
import type {
  AppProps,
  AppState,
  ExcalidrawProps,
  BinaryFiles,
  UIAppState,
  AppClassProperties,
} from "../types";

interface LayerUIProps {
  actionManager: ActionManager;
  appState: UIAppState;
  files: BinaryFiles;
  canvas: HTMLCanvasElement;
  setAppState: React.Component<any, AppState>["setState"];
  elements: readonly NonDeletedExcalidrawElement[];
  onLockToggle: () => void;
  onHandToolToggle: () => void;
  onPenModeToggle: AppClassProperties["togglePenMode"];
  showExitZenModeBtn: boolean;
  langCode: Language["code"];
  renderTopLeftUI?: ExcalidrawProps["renderTopLeftUI"];
  renderTopRightUI?: ExcalidrawProps["renderTopRightUI"];
  renderCustomStats?: ExcalidrawProps["renderCustomStats"];
  UIOptions: AppProps["UIOptions"];
  onExportImage: AppClassProperties["onExportImage"];
  renderWelcomeScreen: boolean;
  children?: React.ReactNode;
  app: AppClassProperties;
  isCollaborating: boolean;
  generateLinkForSelection?: AppProps["generateLinkForSelection"];
}

const DefaultMainMenu: React.FC<{
  UIOptions: AppProps["UIOptions"];
}> = ({ UIOptions }) => {
  return (
    <MainMenu __fallback>
      <MainMenu.DefaultItems.LoadScene />
      <MainMenu.DefaultItems.SaveToActiveFile />
      {/* FIXME we should to test for this inside the item itself */}
      {UIOptions.canvasActions.export && <MainMenu.DefaultItems.Export />}
      {/* FIXME we should to test for this inside the item itself */}
      {UIOptions.canvasActions.saveAsImage && (
        <MainMenu.DefaultItems.SaveAsImage />
      )}
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
      <MainMenu.Separator />
      <MainMenu.Group title="Excalidraw links">
        <MainMenu.DefaultItems.Socials />
      </MainMenu.Group>
      <MainMenu.Separator />
      <MainMenu.DefaultItems.ToggleTheme />
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
};

const DefaultOverwriteConfirmDialog = () => {
  return (
    <OverwriteConfirmDialog __fallback>
      <OverwriteConfirmDialog.Actions.SaveToDisk />
      <OverwriteConfirmDialog.Actions.ExportToImage />
    </OverwriteConfirmDialog>
  );
};

type TerraformAttribute = {
  key: string;
  value: unknown;
  changed?: boolean;
  unknownAfter?: boolean;
  before?: unknown;
  after?: unknown;
};

type TerraformResourceDetails = {
  address?: string;
  type?: string;
  name?: string;
  mode?: string;
  actions?: string[];
  attributes?: TerraformAttribute[];
};

type TerraformFacetNestedSection = {
  id?: string;
  label?: string;
  summary?: string;
  data?: Record<string, unknown>;
  sections?: TerraformFacetNestedSection[];
};

type TerraformContainerFacet = {
  id?: string;
  label?: string;
  summary?: string;
  data?: Record<string, unknown>;
  sections?: TerraformFacetNestedSection[];
  sources?: string[];
};

const TERRAFORM_GROUP_FLAGS = [
  "terraformModuleGroup",
  "terraformAccountGroup",
  "terraformRegionGroup",
  "terraformVpcGroup",
  "terraformSubnetGroup",
] as const;

const isTerraformResourceElement = (element: NonDeletedExcalidrawElement) =>
  element.customData?.terraform && Boolean(element.customData?.nodePath);

const isTerraformGroupElement = (element: NonDeletedExcalidrawElement) =>
  TERRAFORM_GROUP_FLAGS.some((flag) => Boolean(element.customData?.[flag]));

const isTerraformInspectableElement = (element: NonDeletedExcalidrawElement) =>
  isTerraformResourceElement(element) || isTerraformGroupElement(element);

const TERRAFORM_DEPENDENCY_PREVIEW_OPACITY = 25;
const TERRAFORM_DIM_NODE_OPACITY = 50;
const TERRAFORM_DIM_EDGE_OPACITY = 28;
const TERRAFORM_FOCUS_OPACITY = 100;
const TERRAFORM_HOVER_INITIAL_HOPS = 1;
const TERRAFORM_HOVER_HOP_BUDGET_BY_TYPE: Record<string, number> = {
  aws_iam_role: 1,
  aws_security_group: 1,
};

const isTerraformDependencyEdge = (element: ExcalidrawElement) =>
  element.customData?.terraformEdgeLayer === "dependency";

const isTerraformDependencyPreviewEdge = (element: ExcalidrawElement) =>
  element.customData?.terraformDependencyPreview === true;

const dependencyEdgeTouchesTerraformNode = (
  element: ExcalidrawElement,
  nodePath: string,
) => {
  const relationship = element.customData?.relationship;

  if (relationship?.source === nodePath || relationship?.target === nodePath) {
    return true;
  }

  return Boolean(
    Array.isArray(relationship?.directions) &&
      relationship.directions.some(
        (direction: { source?: unknown; target?: unknown }) =>
          direction.source === nodePath || direction.target === nodePath,
      ),
  );
};

const clearTerraformDependencyPreviewData = (
  customData: ExcalidrawElement["customData"],
) => {
  const nextCustomData = { ...(customData ?? {}) };
  delete nextCustomData.terraformDependencyPreview;
  return nextCustomData;
};

const isTerraformLayerEdge = (element: ExcalidrawElement) =>
  element.customData?.terraformEdgeLayer === "dependency" ||
  element.customData?.terraformEdgeLayer === "dataFlow";

const getNodePathFromRelationship = (element: ExcalidrawElement) => {
  const relationship = element.customData?.relationship;
  const source =
    typeof relationship?.source === "string" ? relationship.source : null;
  const target =
    typeof relationship?.target === "string" ? relationship.target : null;
  return source && target ? { source, target } : null;
};

const getHopBudgetForNode = (
  elementByNodePath: Map<string, ExcalidrawElement>,
  nodePath: string,
) => {
  const resourceType = String(
    elementByNodePath.get(nodePath)?.customData?.resourceType || "",
  );
  const allowedDepthByType = TERRAFORM_HOVER_HOP_BUDGET_BY_TYPE[resourceType];
  if (typeof allowedDepthByType === "number") {
    return Math.max(TERRAFORM_HOVER_INITIAL_HOPS, allowedDepthByType);
  }
  return TERRAFORM_HOVER_INITIAL_HOPS;
};

/** Parallel Terraform edges between the same node pair: pick one deterministically. */
const pickCanonicalTerraformEdge = (candidates: ExcalidrawElement[]) => {
  return [...candidates].sort((a, b) => {
    const layerA = a.customData?.terraformEdgeLayer === "dependency" ? 0 : 1;
    const layerB = b.customData?.terraformEdgeLayer === "dependency" ? 0 : 1;
    if (layerA !== layerB) {
      return layerA - layerB;
    }
    return String(a.id).localeCompare(String(b.id));
  })[0];
};

const collectTerraformHoverFocus = (
  allElements: readonly ExcalidrawElement[],
  hoveredNodePath: string | null,
) => {
  const focusedNodePaths = new Set<string>();
  const focusedEdgeIds = new Set<string>();
  if (!hoveredNodePath) {
    return { focusedNodePaths, focusedEdgeIds };
  }

  const elementByNodePath = new Map<string, ExcalidrawElement>();
  /** u -> (v -> parallel edges u–v) */
  const adjacencyWithEdges = new Map<
    string,
    Map<string, ExcalidrawElement[]>
  >();
  const addUndirectedEdge = (a: string, b: string, edge: ExcalidrawElement) => {
    if (!adjacencyWithEdges.has(a)) {
      adjacencyWithEdges.set(a, new Map());
    }
    const ma = adjacencyWithEdges.get(a)!;
    if (!ma.has(b)) {
      ma.set(b, []);
    }
    ma.get(b)!.push(edge);
  };

  const edges = allElements.filter(
    (element) =>
      isTerraformLayerEdge(element) &&
      !isTerraformDependencyPreviewEdge(element),
  );
  for (const element of allElements) {
    const nodePath =
      typeof element.customData?.nodePath === "string"
        ? element.customData.nodePath
        : null;
    if (nodePath) {
      elementByNodePath.set(nodePath, element);
    }
  }
  for (const edge of edges) {
    const rel = getNodePathFromRelationship(edge);
    if (!rel) {
      continue;
    }
    addUndirectedEdge(rel.source, rel.target, edge);
    addUndirectedEdge(rel.target, rel.source, edge);
  }

  const visited = new Set<string>();
  /** BFS spanning tree: child nodePath -> edge id from parent (root has no entry). */
  const treeEdgeIdByChild = new Map<string, string>();
  const queue: Array<{ nodePath: string; depth: number }> = [
    { nodePath: hoveredNodePath, depth: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const { nodePath: u, depth: d } = current;
    if (visited.has(u)) {
      continue;
    }
    visited.add(u);
    focusedNodePaths.add(u);

    const treeEdgeId = treeEdgeIdByChild.get(u);
    if (treeEdgeId) {
      focusedEdgeIds.add(treeEdgeId);
    }

    if (d >= getHopBudgetForNode(elementByNodePath, u)) {
      continue;
    }

    const neighborMap = adjacencyWithEdges.get(u);
    if (!neighborMap) {
      continue;
    }

    for (const [v, parallel] of neighborMap) {
      if (visited.has(v)) {
        continue;
      }
      if (!treeEdgeIdByChild.has(v)) {
        treeEdgeIdByChild.set(v, pickCanonicalTerraformEdge(parallel).id);
      }
      queue.push({ nodePath: v, depth: d + 1 });
    }
  }

  return { focusedNodePaths, focusedEdgeIds };
};

const tryParseJsonString = (value: string): unknown | null => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};

const formatTerraformPanelValue = (value: unknown) => {
  if (value === null || typeof value === "undefined" || value === "") {
    return "None";
  }

  if (typeof value === "string") {
    const parsed = tryParseJsonString(value);
    if (parsed && typeof parsed === "object") {
      try {
        return JSON.stringify(parsed, null, 2);
      } catch {
        return value;
      }
    }
    return value;
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
};

const TerraformConfigValue = ({ value }: { value: unknown }) => {
  const formatted = formatTerraformPanelValue(value);
  const parsed = typeof value === "string" ? tryParseJsonString(value) : null;
  if (
    (typeof value === "object" && value !== null) ||
    (parsed && typeof parsed === "object")
  ) {
    return <pre>{formatted}</pre>;
  }
  return <>{formatted}</>;
};

const getTerraformElementForSelection = (
  elements: readonly NonDeletedExcalidrawElement[],
  appState: UIAppState,
) => {
  const selectedIds = Object.keys(appState.selectedElementIds);
  if (selectedIds.length === 0) {
    return null;
  }

  const selectedElements = elements.filter(
    (element) => appState.selectedElementIds[element.id],
  );

  const selectedTerraformNode = selectedElements.find((element) =>
    isTerraformResourceElement(element),
  );
  if (selectedTerraformNode) {
    return selectedTerraformNode;
  }

  const selectedTerraformGroup = selectedElements.find((element) =>
    isTerraformGroupElement(element),
  );
  if (selectedTerraformGroup) {
    return selectedTerraformGroup;
  }

  const selectedTerraformContainer = selectedElements.find(
    (element) =>
      "containerId" in element &&
      Boolean(element.containerId) &&
      elements.some(
        (candidate) =>
          candidate.id === element.containerId &&
          isTerraformInspectableElement(candidate),
      ),
  );
  if (
    selectedTerraformContainer &&
    "containerId" in selectedTerraformContainer &&
    selectedTerraformContainer.containerId
  ) {
    const container = elements.find(
      (element) => element.id === selectedTerraformContainer.containerId,
    );
    if (container && isTerraformInspectableElement(container)) {
      return container;
    }
  }

  const selectedGroupIds = new Set<string>([
    ...Object.keys(appState.selectedGroupIds),
    ...selectedElements.flatMap((element) => element.groupIds || []),
  ]);

  if (selectedGroupIds.size === 0) {
    return null;
  }

  const groupedTerraformElements = elements.filter(
    (element) =>
      isTerraformInspectableElement(element) &&
      (element.groupIds || []).some((groupId) => selectedGroupIds.has(groupId)),
  );

  return groupedTerraformElements.length === 1
    ? groupedTerraformElements[0]
    : null;
};

const getTerraformGroupKind = (customData: Record<string, any>) => {
  if (customData.terraformModuleGroup) {
    return "Module";
  }
  if (customData.terraformSubnetGroup) {
    return "Subnet";
  }
  if (customData.terraformVpcGroup) {
    return "VPC";
  }
  if (customData.terraformRegionGroup) {
    return "Region";
  }
  if (customData.terraformAccountGroup) {
    return "Account";
  }
  return "Group";
};

const getTerraformGroupTitle = (customData: Record<string, any>) => {
  if (customData.modulePath) {
    return customData.modulePath;
  }
  if (customData.subnetLabel || customData.subnetId) {
    return customData.subnetLabel || customData.subnetId;
  }
  if (customData.vpcLabel || customData.vpcId) {
    return customData.vpcLabel || customData.vpcId;
  }
  if (customData.region) {
    return customData.region;
  }
  if (customData.accountId) {
    return customData.accountId;
  }
  return "Terraform group";
};

const getTerraformContainerFacets = (
  customData: Record<string, any>,
): TerraformContainerFacet[] =>
  Array.isArray(customData.terraformContainerFacets)
    ? customData.terraformContainerFacets
    : [];

const toFacetRows = (facet: TerraformContainerFacet) => {
  const data = facet?.data;
  if (!data || typeof data !== "object") {
    return [];
  }
  return Object.entries(data).filter(
    ([, value]) => value !== null && typeof value !== "undefined",
  );
};

const TerraformNestedFacetSections = ({
  sections,
  depth = 0,
}: {
  sections: TerraformFacetNestedSection[];
  depth?: number;
}) => (
  <>
    {sections.map((section, secIdx) => {
      const childSections = Array.isArray(section.sections)
        ? section.sections
        : [];
      const sectionRows =
        section.data && typeof section.data === "object"
          ? Object.entries(section.data).filter(
              ([, value]) => value !== null && typeof value !== "undefined",
            )
          : [];
      const title = section.label || section.id || `Section ${secIdx + 1}`;
      const key = section.id || `${title}-${depth}-${secIdx}`;
      return (
        <details
          className="terraform-element-actions__nested-section"
          key={key}
          open={depth === 0 && secIdx === 0}
        >
          <summary className="terraform-element-actions__resource-title terraform-element-actions__nested-summary">
            {title}
            {section.summary ? (
              <span className="terraform-element-actions__value">
                {" "}
                — {section.summary}
              </span>
            ) : null}
          </summary>
          <div>
            {sectionRows.map(([rowKey, value]) => (
              <div
                className="terraform-element-actions__attribute"
                key={`${key}-${rowKey}`}
              >
                <div className="terraform-element-actions__attribute-head">
                  <span>{rowKey}</span>
                </div>
                <div className="terraform-element-actions__value terraform-element-actions__value--config">
                  <TerraformConfigValue value={value} />
                </div>
              </div>
            ))}
            {childSections.length > 0 ? (
              <TerraformNestedFacetSections
                sections={childSections}
                depth={depth + 1}
              />
            ) : null}
          </div>
        </details>
      );
    })}
  </>
);

const TerraformGroupActions = ({
  element,
  renderAction,
}: {
  element: NonDeletedExcalidrawElement;
  renderAction: ActionManager["renderAction"];
}) => {
  const customData = element.customData ?? {};
  const facets = getTerraformContainerFacets(customData);
  const rows = [
    ["Module path", customData.modulePath],
    ["Source", customData.moduleSource],
    ["Version", customData.moduleVersion],
    ["Account", customData.accountId],
    ["Region", customData.region],
    ["VPC", customData.vpcLabel || customData.vpcId],
    ["Subnet", customData.subnetLabel || customData.subnetId],
  ].filter(([, value]) => value !== null && typeof value !== "undefined");

  return (
    <div className="selected-shape-actions terraform-element-actions">
      <div className="terraform-element-actions__header">
        <div className="terraform-element-actions__eyebrow">Terraform</div>
        <div className="terraform-element-actions__title">
          {formatTerraformPanelValue(getTerraformGroupTitle(customData))}
        </div>
        <div className="terraform-element-actions__summary">
          <span>{getTerraformGroupKind(customData)}</span>
        </div>
      </div>

      <div className="terraform-element-actions__meta">
        {rows.map(([label, value]) => (
          <div className="terraform-element-actions__row" key={label}>
            <div className="terraform-element-actions__label">{label}</div>
            <div className="terraform-element-actions__value">
              {formatTerraformPanelValue(value)}
            </div>
          </div>
        ))}
      </div>

      {facets.length > 0 && (
        <div className="terraform-element-actions__config">
          {facets.map((facet, facetIndex) => {
            const facetRows = toFacetRows(facet);
            const title =
              facet.label || facet.id || `Facet ${String(facetIndex + 1)}`;
            return (
              <details
                className="terraform-element-actions__resource"
                key={facet.id || `${title}-${facetIndex}`}
                open={facetIndex === 0}
              >
                <summary className="terraform-element-actions__resource-title">
                  {title}
                  {facet.summary ? (
                    <span className="terraform-element-actions__value">
                      {" "}
                      - {facet.summary}
                    </span>
                  ) : null}
                </summary>
                <div>
                  {facet.sections && facet.sections.length > 0 ? (
                    <TerraformNestedFacetSections sections={facet.sections} />
                  ) : facetRows.length > 0 ? (
                    facetRows.map(([key, value]) => (
                      <div
                        className="terraform-element-actions__attribute"
                        key={`${title}-${key}`}
                      >
                        <div className="terraform-element-actions__attribute-head">
                          <span>{key}</span>
                        </div>
                        <div className="terraform-element-actions__value terraform-element-actions__value--config">
                          <TerraformConfigValue value={value} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="terraform-element-actions__empty">
                      No facet data available.
                    </div>
                  )}
                  {Array.isArray(facet.sources) && facet.sources.length > 0 ? (
                    <div className="terraform-element-actions__attribute">
                      <div className="terraform-element-actions__attribute-head">
                        <span>sources</span>
                      </div>
                      <div className="terraform-element-actions__value terraform-element-actions__value--config">
                        <TerraformConfigValue value={facet.sources} />
                      </div>
                    </div>
                  ) : null}
                </div>
              </details>
            );
          })}
        </div>
      )}

      <fieldset>
        <legend>{t("labels.actions")}</legend>
        <div className="buttonList">
          {renderAction("duplicateSelection")}
          {renderAction("deleteSelectedElements")}
          {renderAction("hyperlink")}
        </div>
      </fieldset>
    </div>
  );
};

const TerraformElementActions = ({
  element,
  renderAction,
}: {
  element: NonDeletedExcalidrawElement;
  renderAction: ActionManager["renderAction"];
}) => {
  const customData = element.customData ?? {};

  if (isTerraformGroupElement(element)) {
    return (
      <TerraformGroupActions element={element} renderAction={renderAction} />
    );
  }

  const resources: TerraformResourceDetails[] = Array.isArray(
    customData.terraformResources,
  )
    ? customData.terraformResources
    : [];
  const changedCount = resources.reduce(
    (count, resource) =>
      count +
      (resource.attributes || []).filter((attribute) => attribute.changed)
        .length,
    0,
  );
  const attributeCount = resources.reduce(
    (count, resource) => count + (resource.attributes || []).length,
    0,
  );

  return (
    <div className="selected-shape-actions terraform-element-actions">
      <div className="terraform-element-actions__header">
        <div className="terraform-element-actions__eyebrow">Terraform</div>
        <div className="terraform-element-actions__title">
          {formatTerraformPanelValue(customData.resourceType ?? element.type)}
        </div>
        <div className="terraform-element-actions__summary">
          <span>{formatTerraformPanelValue(customData.action)}</span>
          <span>
            {changedCount} changed / {attributeCount} shown
          </span>
        </div>
      </div>

      <div className="terraform-element-actions__meta">
        <div className="terraform-element-actions__row">
          <div className="terraform-element-actions__label">Resource</div>
          <div className="terraform-element-actions__value">
            {formatTerraformPanelValue(customData.nodePath ?? element.id)}
          </div>
        </div>
        <div className="terraform-element-actions__row">
          <div className="terraform-element-actions__label">Type</div>
          <div className="terraform-element-actions__value">
            {formatTerraformPanelValue(customData.resourceType ?? element.type)}
          </div>
        </div>
      </div>

      <div className="terraform-element-actions__config">
        {resources.length > 0 ? (
          resources.map((resource, resourceIndex) => {
            const attributes = resource.attributes || [];
            return (
              <div
                className="terraform-element-actions__resource"
                key={resource.address || resourceIndex}
              >
                {resources.length > 1 && (
                  <div className="terraform-element-actions__resource-title">
                    {formatTerraformPanelValue(
                      resource.address || `Resource ${resourceIndex + 1}`,
                    )}
                  </div>
                )}
                {attributes.length > 0 ? (
                  attributes.map((attribute) => (
                    <div
                      className={clsx("terraform-element-actions__attribute", {
                        "terraform-element-actions__attribute--changed":
                          attribute.changed,
                      })}
                      key={attribute.key}
                    >
                      <div className="terraform-element-actions__attribute-head">
                        <span>{attribute.key}</span>
                        {attribute.unknownAfter ? (
                          <strong>after apply</strong>
                        ) : (
                          attribute.changed && <strong>changed</strong>
                        )}
                      </div>
                      {attribute.unknownAfter ? (
                        <div className="terraform-element-actions__value terraform-element-actions__value--config">
                          <em>{formatTerraformPanelValue(attribute.value)}</em>
                        </div>
                      ) : attribute.changed ? (
                        <div className="terraform-element-actions__diff">
                          <div>
                            <span>Before</span>
                            <TerraformConfigValue value={attribute.before} />
                          </div>
                          <div>
                            <span>After</span>
                            <TerraformConfigValue
                              value={
                                typeof attribute.after === "undefined"
                                  ? attribute.value
                                  : attribute.after
                              }
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="terraform-element-actions__value terraform-element-actions__value--config">
                          <TerraformConfigValue value={attribute.value} />
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="terraform-element-actions__empty">
                    No config attributes in this Terraform plan entry.
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="terraform-element-actions__empty">
            Re-import this Terraform graph to include config and diff data.
          </div>
        )}
      </div>

      {resources[0]?.address && (
        <div className="terraform-element-actions__meta">
          <div className="terraform-element-actions__row">
            <div className="terraform-element-actions__label">Address</div>
            <div className="terraform-element-actions__value">
              {formatTerraformPanelValue(resources[0].address)}
            </div>
          </div>
        </div>
      )}

      <fieldset>
        <legend>{t("labels.actions")}</legend>
        <div className="buttonList">
          {renderAction("duplicateSelection")}
          {renderAction("deleteSelectedElements")}
          {renderAction("hyperlink")}
        </div>
      </fieldset>
    </div>
  );
};

const LayerUI = ({
  actionManager,
  appState,
  files,
  setAppState,
  elements,
  canvas,
  onLockToggle,
  onHandToolToggle,
  onPenModeToggle,
  showExitZenModeBtn,
  renderTopLeftUI,
  renderTopRightUI,
  renderCustomStats,
  UIOptions,
  onExportImage,
  renderWelcomeScreen,
  children,
  app,
  isCollaborating,
  generateLinkForSelection,
}: LayerUIProps) => {
  const editorInterface = useEditorInterface();
  const stylesPanelMode = useStylesPanelMode();
  const isCompactStylesPanel = stylesPanelMode === "compact";
  const tunnels = useInitializeTunnels();

  const spacing = isCompactStylesPanel
    ? {
        menuTopGap: 4,
        toolbarColGap: 4,
        toolbarRowGap: 1,
        toolbarInnerRowGap: 0.5,
        islandPadding: 1,
        collabMarginLeft: 8,
      }
    : {
        menuTopGap: 6,
        toolbarColGap: 4,
        toolbarRowGap: 1,
        toolbarInnerRowGap: 1,
        islandPadding: 1,
        collabMarginLeft: 8,
      };

  const TunnelsJotaiProvider = tunnels.tunnelsJotai.Provider;

  const [eyeDropperState, setEyeDropperState] = useAtom(activeEyeDropperAtom);

  React.useEffect(() => {
    const terraformElement = getTerraformElementForSelection(
      elements,
      appState,
    );
    const selectedNodePath =
      typeof terraformElement?.customData?.nodePath === "string"
        ? terraformElement.customData.nodePath
        : null;
    const allElements = app.scene.getElementsIncludingDeleted();
    const dependencyLayerVisible = allElements.some(
      (element) =>
        isTerraformDependencyEdge(element) &&
        !isTerraformDependencyPreviewEdge(element) &&
        !element.isDeleted,
    );
    let didChange = false;

    const nextElements = allElements.map((element) => {
      if (!isTerraformDependencyEdge(element)) {
        return element;
      }

      const isPreview = isTerraformDependencyPreviewEdge(element);
      const shouldPreview =
        !dependencyLayerVisible &&
        selectedNodePath !== null &&
        dependencyEdgeTouchesTerraformNode(element, selectedNodePath);

      if (shouldPreview) {
        if (
          !element.isDeleted &&
          isPreview &&
          element.opacity === TERRAFORM_DEPENDENCY_PREVIEW_OPACITY
        ) {
          return element;
        }
        didChange = true;
        return newElementWith(element, {
          isDeleted: false,
          opacity: TERRAFORM_DEPENDENCY_PREVIEW_OPACITY,
          customData: {
            ...(element.customData ?? {}),
            terraformDependencyPreview: true,
          },
        });
      }

      if (isPreview) {
        didChange = true;
        return newElementWith(element, {
          isDeleted: true,
          opacity: 100,
          customData: clearTerraformDependencyPreviewData(element.customData),
        });
      }

      return element;
    });

    if (didChange) {
      app.scene.replaceAllElements(repairTerraformEdgeBindings(nextElements));
    }
  }, [app, appState, elements]);

  React.useEffect(() => {
    const allElements = app.scene.getElementsIncludingDeleted();
    const hoveredTerraformResource = allElements.find(
      (element) =>
        appState.hoveredElementIds[element.id] &&
        element.customData?.terraformVisibilityRole === "resource" &&
        typeof element.customData?.nodePath === "string",
    );
    const hoveredNodePath =
      typeof hoveredTerraformResource?.customData?.nodePath === "string"
        ? hoveredTerraformResource.customData.nodePath
        : null;
    const { focusedNodePaths, focusedEdgeIds } = collectTerraformHoverFocus(
      allElements,
      hoveredNodePath,
    );

    let didChange = false;
    const nextElements = allElements.map((element) => {
      if (
        isTerraformLayerEdge(element) &&
        !isTerraformDependencyPreviewEdge(element)
      ) {
        const nextOpacity =
          hoveredNodePath === null
            ? TERRAFORM_FOCUS_OPACITY
            : focusedEdgeIds.has(element.id)
            ? TERRAFORM_FOCUS_OPACITY
            : TERRAFORM_DIM_EDGE_OPACITY;
        if (element.opacity === nextOpacity) {
          return element;
        }
        didChange = true;
        return newElementWith(element, { opacity: nextOpacity });
      }

      if (
        element.customData?.terraformVisibilityRole === "resource" ||
        isTerraformGroupElement(element as NonDeletedExcalidrawElement)
      ) {
        const nodePath =
          typeof element.customData?.nodePath === "string"
            ? element.customData.nodePath
            : null;
        const isFocused =
          nodePath !== null &&
          hoveredNodePath !== null &&
          focusedNodePaths.has(nodePath);
        const nextOpacity =
          hoveredNodePath === null
            ? TERRAFORM_FOCUS_OPACITY
            : isFocused
            ? TERRAFORM_FOCUS_OPACITY
            : TERRAFORM_DIM_NODE_OPACITY;
        if (element.opacity === nextOpacity) {
          return element;
        }
        didChange = true;
        return newElementWith(element, { opacity: nextOpacity });
      }

      return element;
    });

    if (didChange) {
      app.scene.replaceAllElements(nextElements);
    }
  }, [app, appState.hoveredElementIds, elements]);

  const renderJSONExportDialog = () => {
    if (!UIOptions.canvasActions.export) {
      return null;
    }

    return (
      <JSONExportDialog
        elements={elements}
        appState={appState}
        files={files}
        actionManager={actionManager}
        exportOpts={UIOptions.canvasActions.export}
        canvas={canvas}
        setAppState={setAppState}
      />
    );
  };

  const renderImageExportDialog = () => {
    if (
      !UIOptions.canvasActions.saveAsImage ||
      appState.openDialog?.name !== "imageExport"
    ) {
      return null;
    }

    return (
      <ImageExportDialog
        elements={elements}
        appState={appState}
        files={files}
        actionManager={actionManager}
        onExportImage={onExportImage}
        onCloseRequest={() => setAppState({ openDialog: null })}
        name={app.getName()}
      />
    );
  };

  const renderTerraformImportDialog = () => {
    if (appState.openDialog?.name !== "terraformImport") {
      return null;
    }

    return (
      <TerraformImportDialog
        onCloseRequest={() => setAppState({ openDialog: null })}
      />
    );
  };

  const renderCanvasActions = () => (
    <div style={{ position: "relative" }}>
      {/* wrapping to Fragment stops React from occasionally complaining
                about identical Keys */}
      <tunnels.MainMenuTunnel.Out />
      {renderWelcomeScreen && <tunnels.WelcomeScreenMenuHintTunnel.Out />}
    </div>
  );

  const renderSelectedShapeActions = () => {
    const isCompactMode = isCompactStylesPanel;
    const terraformElement = getTerraformElementForSelection(
      elements,
      appState,
    );
    const terraformMenuWidth = terraformElement
      ? "min(36rem, calc(100vw - 2rem))"
      : undefined;

    return (
      <Section
        heading="selectedShapeActions"
        className={clsx("selected-shape-actions zen-mode-transition", {
          "transition-left": appState.zenModeEnabled,
        })}
      >
        {isCompactMode ? (
          <Island
            className={clsx("compact-shape-actions-island")}
            padding={0}
            style={{
              // we want to make sure this doesn't overflow so subtracting the
              // approximate height of hamburgerMenu + footer
              maxHeight: `${appState.height - 166}px`,
              width: terraformMenuWidth,
            }}
          >
            {terraformElement ? (
              <TerraformElementActions
                element={terraformElement}
                renderAction={actionManager.renderAction}
              />
            ) : (
              <CompactShapeActions
                appState={appState}
                elementsMap={app.scene.getNonDeletedElementsMap()}
                renderAction={actionManager.renderAction}
                app={app}
                setAppState={setAppState}
              />
            )}
          </Island>
        ) : (
          <Island
            className={CLASSES.SHAPE_ACTIONS_MENU}
            padding={2}
            style={{
              // we want to make sure this doesn't overflow so subtracting the
              // approximate height of hamburgerMenu + footer
              maxHeight: `${appState.height - 166}px`,
              width: terraformMenuWidth,
            }}
          >
            {terraformElement ? (
              <TerraformElementActions
                element={terraformElement}
                renderAction={actionManager.renderAction}
              />
            ) : (
              <SelectedShapeActions
                appState={appState}
                elementsMap={app.scene.getNonDeletedElementsMap()}
                renderAction={actionManager.renderAction}
                app={app}
              />
            )}
          </Island>
        )}
      </Section>
    );
  };

  const renderFixedSideContainer = () => {
    const shouldRenderSelectedShapeActions = showSelectedShapeActions(
      appState,
      elements,
    );

    const shouldShowStats =
      appState.stats.open &&
      !appState.zenModeEnabled &&
      !appState.viewModeEnabled &&
      appState.openDialog?.name !== "elementLinkSelector";

    return (
      <FixedSideContainer side="top">
        <div className="App-menu App-menu_top">
          <Stack.Col
            gap={spacing.menuTopGap}
            className={clsx("App-menu_top__left")}
          >
            {renderCanvasActions()}
            <div
              className={clsx("selected-shape-actions-container", {
                "selected-shape-actions-container--compact":
                  isCompactStylesPanel,
              })}
            >
              {shouldRenderSelectedShapeActions && renderSelectedShapeActions()}
            </div>
          </Stack.Col>
          {!appState.viewModeEnabled &&
            appState.openDialog?.name !== "elementLinkSelector" && (
              <Section heading="shapes" className="shapes-section">
                {(heading: React.ReactNode) => (
                  <div style={{ position: "relative" }}>
                    {renderWelcomeScreen && (
                      <tunnels.WelcomeScreenToolbarHintTunnel.Out />
                    )}
                    <Stack.Col gap={spacing.toolbarColGap} align="start">
                      <Stack.Row
                        gap={spacing.toolbarRowGap}
                        className={clsx("App-toolbar-container", {
                          "zen-mode": appState.zenModeEnabled,
                        })}
                      >
                        <Island
                          padding={spacing.islandPadding}
                          className={clsx("App-toolbar", {
                            "zen-mode": appState.zenModeEnabled,
                            "App-toolbar--compact": isCompactStylesPanel,
                          })}
                        >
                          <HintViewer
                            appState={appState}
                            isMobile={editorInterface.formFactor === "phone"}
                            editorInterface={editorInterface}
                            app={app}
                          />
                          {heading}
                          <Stack.Row gap={spacing.toolbarInnerRowGap}>
                            <PenModeButton
                              zenModeEnabled={appState.zenModeEnabled}
                              checked={appState.penMode}
                              onChange={() => onPenModeToggle(null)}
                              title={t("toolBar.penMode")}
                              penDetected={appState.penDetected}
                            />
                            <LockButton
                              checked={appState.activeTool.locked}
                              onChange={onLockToggle}
                              title={t("toolBar.lock")}
                            />

                            <div className="App-toolbar__divider" />

                            <ShapesSwitcher
                              setAppState={setAppState}
                              activeTool={appState.activeTool}
                              UIOptions={UIOptions}
                              app={app}
                            />
                          </Stack.Row>
                        </Island>
                        {isCollaborating && (
                          <Island
                            style={{
                              marginLeft: spacing.collabMarginLeft,
                              alignSelf: "center",
                              height: "fit-content",
                            }}
                          >
                            <LaserPointerButton
                              title={t("toolBar.laser")}
                              checked={
                                appState.activeTool.type === TOOL_TYPE.laser
                              }
                              onChange={() =>
                                app.setActiveTool({ type: TOOL_TYPE.laser })
                              }
                              isMobile
                            />
                          </Island>
                        )}
                      </Stack.Row>
                    </Stack.Col>
                  </div>
                )}
              </Section>
            )}
          <div
            className={clsx(
              "layer-ui__wrapper__top-right zen-mode-transition",
              {
                "transition-right": appState.zenModeEnabled,
                "layer-ui__wrapper__top-right--compact": isCompactStylesPanel,
              },
            )}
          >
            {appState.collaborators.size > 0 && (
              <UserList
                collaborators={appState.collaborators}
                userToFollow={appState.userToFollow?.socketId || null}
              />
            )}
            {renderTopRightUI?.(
              editorInterface.formFactor === "phone",
              appState,
            )}
            {!appState.viewModeEnabled &&
              appState.openDialog?.name !== "elementLinkSelector" &&
              // hide button when sidebar docked
              (!isSidebarDocked ||
                appState.openSidebar?.name !== DEFAULT_SIDEBAR.name) && (
                <tunnels.DefaultSidebarTriggerTunnel.Out />
              )}
            {shouldShowStats && (
              <Stats
                app={app}
                onClose={() => {
                  actionManager.executeAction(actionToggleStats);
                }}
                renderCustomStats={renderCustomStats}
              />
            )}
          </div>
        </div>
      </FixedSideContainer>
    );
  };

  const renderSidebars = () => {
    return (
      <DefaultSidebar
        __fallback
        onDock={(docked) => {
          trackEvent(
            "sidebar",
            `toggleDock (${docked ? "dock" : "undock"})`,
            `(${
              editorInterface.formFactor === "phone" ? "mobile" : "desktop"
            })`,
          );
        }}
      />
    );
  };

  const isSidebarDocked = useAtomValue(isSidebarDockedAtom);

  const layerUIJSX = (
    <>
      {/* ------------------------- tunneled UI ---------------------------- */}
      {/* make sure we render host app components first so that we can detect
          them first on initial render to optimize layout shift */}
      {children}
      {/* render component fallbacks. Can be rendered anywhere as they'll be
          tunneled away. We only render tunneled components that actually
        have defaults when host do not render anything. */}
      <DefaultMainMenu UIOptions={UIOptions} />
      <DefaultSidebar.Trigger
        __fallback
        icon={sidebarRightIcon}
        title={capitalizeString(t("toolBar.library"))}
        onToggle={(open) => {
          if (open) {
            trackEvent(
              "sidebar",
              `${DEFAULT_SIDEBAR.name} (open)`,
              `button (${
                editorInterface.formFactor === "phone" ? "mobile" : "desktop"
              })`,
            );
          }
        }}
        tab={DEFAULT_SIDEBAR.defaultTab}
      />
      <DefaultOverwriteConfirmDialog />
      {appState.openDialog?.name === "ttd" && <TTDDialog __fallback />}
      {/* ------------------------------------------------------------------ */}

      {appState.isLoading && <LoadingMessage delay={250} />}
      {appState.errorMessage && (
        <ErrorDialog onClose={() => setAppState({ errorMessage: null })}>
          {appState.errorMessage}
        </ErrorDialog>
      )}
      {eyeDropperState && editorInterface.formFactor !== "phone" && (
        <EyeDropper
          colorPickerType={eyeDropperState.colorPickerType}
          onCancel={() => {
            setEyeDropperState(null);
          }}
          onChange={(colorPickerType, color, selectedElements, { altKey }) => {
            if (
              colorPickerType !== "elementBackground" &&
              colorPickerType !== "elementStroke"
            ) {
              return;
            }

            if (selectedElements.length) {
              for (const element of selectedElements) {
                mutateElement(element, arrayToMap(elements), {
                  [altKey && eyeDropperState.swapPreviewOnAlt
                    ? colorPickerType === "elementBackground"
                      ? "strokeColor"
                      : "backgroundColor"
                    : colorPickerType === "elementBackground"
                    ? "backgroundColor"
                    : "strokeColor"]: color,
                });
                ShapeCache.delete(element);
              }
              app.scene.triggerUpdate();
            } else if (colorPickerType === "elementBackground") {
              setAppState({
                currentItemBackgroundColor: color,
              });
            } else {
              setAppState({ currentItemStrokeColor: color });
            }
          }}
          onSelect={(color, event) => {
            setEyeDropperState((state) => {
              return state?.keepOpenOnAlt && event.altKey ? state : null;
            });
            eyeDropperState?.onSelect?.(color, event);
          }}
        />
      )}
      {appState.openDialog?.name === "help" && (
        <HelpDialog
          onClose={() => {
            setAppState({ openDialog: null });
          }}
        />
      )}
      <ActiveConfirmDialog />
      {appState.openDialog?.name === "elementLinkSelector" && (
        <ElementLinkDialog
          sourceElementId={appState.openDialog.sourceElementId}
          onClose={() => {
            setAppState({
              openDialog: null,
            });
          }}
          scene={app.scene}
          appState={appState}
          generateLinkForSelection={generateLinkForSelection}
        />
      )}
      <tunnels.OverwriteConfirmDialogTunnel.Out />
      {renderImageExportDialog()}
      {renderTerraformImportDialog()}
      {renderJSONExportDialog()}
      {appState.openDialog?.name === "charts" && (
        <PasteChartDialog
          data={appState.openDialog.data}
          rawText={appState.openDialog.rawText}
          onClose={() =>
            setAppState({
              openDialog: null,
            })
          }
        />
      )}
      {editorInterface.formFactor === "phone" && (
        <MobileMenu
          app={app}
          appState={appState}
          elements={elements}
          actionManager={actionManager}
          renderJSONExportDialog={renderJSONExportDialog}
          renderImageExportDialog={renderImageExportDialog}
          renderTerraformImportDialog={renderTerraformImportDialog}
          setAppState={setAppState}
          onHandToolToggle={onHandToolToggle}
          onPenModeToggle={onPenModeToggle}
          renderTopLeftUI={renderTopLeftUI}
          renderTopRightUI={renderTopRightUI}
          renderSidebars={renderSidebars}
          renderWelcomeScreen={renderWelcomeScreen}
          UIOptions={UIOptions}
        />
      )}
      {editorInterface.formFactor !== "phone" && (
        <>
          <div
            className="layer-ui__wrapper"
            style={
              appState.openSidebar &&
              isSidebarDocked &&
              editorInterface.canFitSidebar
                ? { width: `calc(100% - var(--right-sidebar-width))` }
                : {}
            }
          >
            {renderWelcomeScreen && <tunnels.WelcomeScreenCenterTunnel.Out />}
            {renderFixedSideContainer()}
            <Footer
              appState={appState}
              actionManager={actionManager}
              showExitZenModeBtn={showExitZenModeBtn}
              renderWelcomeScreen={renderWelcomeScreen}
            />
            {(appState.toast || appState.scrolledOutside) && (
              <div className="floating-status-stack">
                {appState.toast && (
                  <Toast
                    message={appState.toast.message}
                    onClose={() => setAppState({ toast: null })}
                    duration={appState.toast.duration}
                    closable={appState.toast.closable}
                  />
                )}
                {!appState.toast && appState.scrolledOutside && (
                  <button
                    type="button"
                    className="scroll-back-to-content"
                    onClick={() => {
                      setAppState((appState) => ({
                        ...calculateScrollCenter(elements, appState),
                      }));
                    }}
                  >
                    {t("buttons.scrollBackToContent")}
                  </button>
                )}
              </div>
            )}
          </div>
          {renderSidebars()}
        </>
      )}
    </>
  );

  return (
    <UIAppStateContext.Provider value={appState}>
      <TunnelsJotaiProvider>
        <TunnelsContext.Provider value={tunnels}>
          {layerUIJSX}
        </TunnelsContext.Provider>
      </TunnelsJotaiProvider>
    </UIAppStateContext.Provider>
  );
};

const stripIrrelevantAppStateProps = (appState: AppState): UIAppState => {
  const { cursorButton, scrollX, scrollY, ...ret } = appState;
  return ret;
};

const areEqual = (prevProps: LayerUIProps, nextProps: LayerUIProps) => {
  // short-circuit early
  if (prevProps.children !== nextProps.children) {
    return false;
  }

  const { canvas: _pC, appState: prevAppState, ...prev } = prevProps;
  const { canvas: _nC, appState: nextAppState, ...next } = nextProps;

  return (
    isShallowEqual(
      // asserting AppState because we're being passed the whole AppState
      // but resolve to only the UI-relevant props
      stripIrrelevantAppStateProps(prevAppState as AppState),
      stripIrrelevantAppStateProps(nextAppState as AppState),
      {
        selectedElementIds: isShallowEqual,
        selectedGroupIds: isShallowEqual,
      },
    ) && isShallowEqual(prev, next)
  );
};

export default React.memo(LayerUI, areEqual);
