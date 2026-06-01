import clsx from "clsx";
import React from "react";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { t } from "../i18n";

import {
  getTerraformContainerFacets,
  getTerraformGroupKind,
  getTerraformGroupTitle,
} from "./terraformElementActionsSelection";
import {
  isTerraformGroupElement,
  isTerraformLayerEdge,
} from "./terraformElementMetadata";
import { UNKNOWN_VALUE_PLACEHOLDER } from "./terraformElkLayout";

import type {
  TerraformUnknownAfterDependency,
  TerraformUnknownAfterIntentRow,
} from "./terraformPlanConfigRefs";
import type { ActionManager } from "../actions/manager";

/** Same asset as {@link injectTerraformLayoutDuplicateInfoGlyphs} canvas markers. */
export const TERRAFORM_DUPLICATE_LAYOUT_INFO_SRC = new URL(
  "./info-circle-svgrepo-com.svg",
  import.meta.url,
).href;

type TerraformAttribute = {
  key: string;
  value: unknown;
  changed?: boolean;
  unknownAfter?: boolean;
  before?: unknown;
  after?: unknown;
  unknownAfterDependencies?: TerraformUnknownAfterDependency[];
  unknownAfterPreview?: TerraformUnknownAfterIntentRow[];
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

const hasUnknownAfterIntentRows = (
  rows: TerraformUnknownAfterIntentRow[] | undefined,
) => (rows?.length ?? 0) > 0;

const TerraformUnknownAfterIntentRows = ({
  rows,
  onFocusTerraformNodePath,
}: {
  rows: TerraformUnknownAfterIntentRow[];
  onFocusTerraformNodePath?: (nodePath: string) => void;
}) => {
  if (rows.length === 0) {
    return null;
  }
  return (
    <ul className="terraform-element-actions__unknown-after-intent">
      {rows.map((row) => (
        <li key={`${row.key}:${row.resolvesTo ?? ""}`}>
          <code className="terraform-element-actions__intent-key">
            {row.key}
          </code>
          <span className="terraform-element-actions__intent-badge">new</span>
          <span className="terraform-element-actions__intent-sep">: </span>
          <em>{formatTerraformPanelValue(UNKNOWN_VALUE_PLACEHOLDER)}</em>
          {row.resolvesTo ? (
            <>
              <span className="terraform-element-actions__intent-arrow">
                {" "}
                →{" "}
              </span>
              {row.nodePath && onFocusTerraformNodePath ? (
                <button
                  type="button"
                  className="terraform-element-actions__depends-on-link"
                  onClick={() => onFocusTerraformNodePath(row.nodePath!)}
                >
                  {formatTerraformPanelValue(row.resolvesTo)}
                </button>
              ) : (
                <span className="terraform-element-actions__intent-expr">
                  {formatTerraformPanelValue(row.resolvesTo)}
                </span>
              )}
            </>
          ) : null}
        </li>
      ))}
    </ul>
  );
};

const TerraformUnknownAfterPlaceholder = () => (
  <div className="terraform-element-actions__value terraform-element-actions__value--config">
    <em>{formatTerraformPanelValue(UNKNOWN_VALUE_PLACEHOLDER)}</em>
  </div>
);

const TerraformAttributeUnknownAfterBody = ({
  attribute,
  onFocusTerraformNodePath,
}: {
  attribute: TerraformAttribute;
  onFocusTerraformNodePath?: (nodePath: string) => void;
}) => {
  const showBeforeAfterDiff =
    attribute.changed && attribute.before != null && attribute.before !== "";

  if (showBeforeAfterDiff) {
    return (
      <div className="terraform-element-actions__unknown-after">
        <div className="terraform-element-actions__diff">
          <div>
            <span>Before</span>
            <TerraformConfigValue value={attribute.before} />
          </div>
          <div>
            <span>After apply</span>
            {hasUnknownAfterIntentRows(attribute.unknownAfterPreview) ? (
              <TerraformUnknownAfterIntentRows
                rows={attribute.unknownAfterPreview!}
                onFocusTerraformNodePath={onFocusTerraformNodePath}
              />
            ) : (
              <TerraformUnknownAfterPlaceholder />
            )}
          </div>
        </div>
        <TerraformAttributeDependsOn
          attribute={attribute}
          onFocusTerraformNodePath={onFocusTerraformNodePath}
        />
      </div>
    );
  }

  if (hasUnknownAfterIntentRows(attribute.unknownAfterPreview)) {
    return (
      <div className="terraform-element-actions__unknown-after">
        <TerraformUnknownAfterIntentRows
          rows={attribute.unknownAfterPreview!}
          onFocusTerraformNodePath={onFocusTerraformNodePath}
        />
        <TerraformAttributeDependsOn
          attribute={attribute}
          onFocusTerraformNodePath={onFocusTerraformNodePath}
        />
      </div>
    );
  }

  return (
    <div className="terraform-element-actions__unknown-after">
      <TerraformUnknownAfterPlaceholder />
      <TerraformAttributeDependsOn
        attribute={attribute}
        onFocusTerraformNodePath={onFocusTerraformNodePath}
      />
    </div>
  );
};

const TerraformAttributeDependsOn = ({
  attribute,
  onFocusTerraformNodePath,
}: {
  attribute: TerraformAttribute;
  onFocusTerraformNodePath?: (nodePath: string) => void;
}) => {
  if (
    (attribute.unknownAfterPreview?.length ?? 0) > 0 ||
    (attribute.unknownAfterDependencies?.length ?? 0) === 0
  ) {
    return null;
  }

  return (
    <div className="terraform-element-actions__depends-on">
      <div className="terraform-element-actions__label">Depends on</div>
      <ul className="terraform-element-actions__depends-on-list">
        {attribute.unknownAfterDependencies!.map((dep) => (
          <li key={dep.reference}>
            {dep.nodePath && onFocusTerraformNodePath ? (
              <button
                type="button"
                className="terraform-element-actions__depends-on-link"
                onClick={() => onFocusTerraformNodePath(dep.nodePath!)}
              >
                {formatTerraformPanelValue(dep.reference)}
              </button>
            ) : (
              formatTerraformPanelValue(dep.reference)
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

const TerraformAttributeConfigBody = ({
  attribute,
  onFocusTerraformNodePath,
}: {
  attribute: TerraformAttribute;
  onFocusTerraformNodePath?: (nodePath: string) => void;
}) => {
  if (attribute.unknownAfter) {
    return (
      <TerraformAttributeUnknownAfterBody
        attribute={attribute}
        onFocusTerraformNodePath={onFocusTerraformNodePath}
      />
    );
  }

  if (attribute.changed) {
    return (
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
    );
  }

  return (
    <div className="terraform-element-actions__value terraform-element-actions__value--config">
      <TerraformConfigValue value={attribute.value} />
    </div>
  );
};

const TerraformResourceConfigPanel = ({
  resources,
  onFocusTerraformNodePath,
}: {
  resources: TerraformResourceDetails[];
  onFocusTerraformNodePath?: (nodePath: string) => void;
}) => {
  if (resources.length === 0) {
    return (
      <div className="terraform-element-actions__empty">
        Re-import this Terraform graph to include config and diff data.
      </div>
    );
  }

  return (
    <>
      {resources.map((resource, resourceIndex) => {
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
                  <TerraformAttributeConfigBody
                    attribute={attribute}
                    onFocusTerraformNodePath={onFocusTerraformNodePath}
                  />
                </div>
              ))
            ) : (
              <div className="terraform-element-actions__empty">
                No config attributes in this Terraform plan entry.
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};

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
  const facets = getTerraformContainerFacets(
    customData,
  ) as TerraformContainerFacet[];
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

const TerraformEdgeActions = ({
  element,
  renderAction,
}: {
  element: NonDeletedExcalidrawElement;
  renderAction: ActionManager["renderAction"];
}) => {
  const customData = element.customData ?? {};
  const relationship =
    customData.relationship && typeof customData.relationship === "object"
      ? customData.relationship
      : {};
  const rows = [
    ["Layer", customData.terraformEdgeLayer],
    ["Type", relationship.type],
    ["Label", relationship.label],
    ["Origin", relationship.origin],
    ["Source", relationship.source],
    ["Target", relationship.target],
    ["Detail", relationship.detail],
  ].filter(([, value]) => value !== null && typeof value !== "undefined");

  return (
    <div className="selected-shape-actions terraform-element-actions">
      <div className="terraform-element-actions__header">
        <div className="terraform-element-actions__eyebrow">Terraform</div>
        <div className="terraform-element-actions__title">Relationship</div>
        <div className="terraform-element-actions__summary">
          <span>
            {formatTerraformPanelValue(customData.terraformEdgeLayer)}
          </span>
        </div>
      </div>

      <div className="terraform-element-actions__meta">
        {rows.map(([label, value]) => (
          <div className="terraform-element-actions__row" key={label}>
            <div className="terraform-element-actions__label">{label}</div>
            <div className="terraform-element-actions__value">
              <TerraformConfigValue value={value} />
            </div>
          </div>
        ))}
      </div>

      <fieldset>
        <legend>{t("labels.actions")}</legend>
        <div className="buttonList">{renderAction("hyperlink")}</div>
      </fieldset>
    </div>
  );
};

export const TerraformElementActions = ({
  element,
  renderAction,
  onFocusTerraformNodePath,
}: {
  element: NonDeletedExcalidrawElement;
  renderAction: ActionManager["renderAction"];
  onFocusTerraformNodePath?: (nodePath: string) => void;
}) => {
  const customData = element.customData ?? {};

  if (isTerraformGroupElement(element)) {
    return (
      <TerraformGroupActions element={element} renderAction={renderAction} />
    );
  }

  if (isTerraformLayerEdge(element)) {
    return (
      <TerraformEdgeActions element={element} renderAction={renderAction} />
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
        {customData.terraformSemanticRouteTableDuplicate ? (
          <div className="terraform-element-actions__row">
            <div className="terraform-element-actions__label">Note</div>
            <div className="terraform-element-actions__value">
              Duplicate tile for semantic subnet-column alignment. Canonical
              address:{" "}
              {formatTerraformPanelValue(String(customData.nodePath ?? ""))}.
            </div>
          </div>
        ) : null}
        {customData.terraformSemanticLayoutDuplicate ? (
          <div className="terraform-element-actions__row">
            <div className="terraform-element-actions__label">Note</div>
            <div
              className={clsx(
                "terraform-element-actions__value",
                "terraform-element-actions__value--with-inline-icon",
              )}
            >
              <span className="terraform-element-actions__inline-icon-wrap">
                <img
                  src={TERRAFORM_DUPLICATE_LAYOUT_INFO_SRC}
                  width={16}
                  height={16}
                  alt=""
                  className="terraform-element-actions__inline-icon"
                />
              </span>
              <span>
                Duplicate tile for semantic layout (same Terraform address drawn
                again). Dependency hover uses this tile&apos;s layout id;
                canonical address:{" "}
                {formatTerraformPanelValue(String(customData.nodePath ?? ""))}.
              </span>
            </div>
          </div>
        ) : null}
        {customData.terraformMergedSubnetComposite ? (
          <div className="terraform-element-actions__row">
            <div className="terraform-element-actions__label">Note</div>
            <div className="terraform-element-actions__value">
              One tile for multiple subnets that share a route table (merged
              supplementary zones).
            </div>
          </div>
        ) : null}
      </div>

      <div className="terraform-element-actions__config">
        <TerraformResourceConfigPanel
          resources={resources}
          onFocusTerraformNodePath={onFocusTerraformNodePath}
        />
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
