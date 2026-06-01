import {
  parseDeclaredDataFlowText,
  type ParsedDeclaredDataFlow,
  type TfdVersion,
} from "./terraformDeclaredDataFlow";
import { parseStackAddress } from "./terraformStackAddress";

import type { TerraformPlanDotBundle } from "./terraformPlanParsing";
import type {
  TerraformImportPresetSources,
  TerraformImportPresetWarning,
} from "./terraformImportPresetsTypes";

export type TerraformArtifactRef = {
  repoName: string;
  relativePath: string;
};

export type TerraformArtifactKind = "plan" | "dot" | "state";

export type ParsedTfdUseBlock = {
  stackId: string;
  plan?: TerraformArtifactRef;
  dot?: TerraformArtifactRef;
  state?: TerraformArtifactRef;
};

export type ParsedTfdComposition = ParsedDeclaredDataFlow & {
  useBlocks: ParsedTfdUseBlock[];
};

export type TerraformArtifactRecord = {
  repoName: string;
  relativePath: string;
  kind: TerraformArtifactKind;
  stackId?: string;
  label?: string;
  content: string;
};

export type TerraformStackCatalogEntry = {
  stackId: string;
  label: string;
  planPath: string;
  dotPath: string;
  statePath?: string;
  planText?: string;
  dotText?: string;
  stateText?: string;
};

export type ApplyTfdCompositionOptions = {
  repoName?: string;
  stackCatalog?: readonly TerraformStackCatalogEntry[];
  artifactLoader?: (
    ref: TerraformArtifactRef,
    kind: TerraformArtifactKind,
  ) => Pick<TerraformArtifactRecord, "content"> | TerraformArtifactRecord | null | undefined;
};

export type ApplyTfdCompositionResult = {
  sources: TerraformImportPresetSources;
  composition: ParsedTfdComposition;
  errors: string[];
  warnings: TerraformImportPresetWarning[];
};

const ARTIFACT_REF_PATTERN =
  /^@?(?<repo>[a-zA-Z0-9][a-zA-Z0-9._-]*)\/(?<path>.+)$/;

export function repoNameFromRootPath(rootPath: string): string {
  const normalized = rootPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const segments = normalized.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? "terraform";
}

export function formatArtifactRef(ref: TerraformArtifactRef): string {
  return `${ref.repoName}/${ref.relativePath}`;
}

export function parseArtifactRef(raw: string): TerraformArtifactRef | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const match = trimmed.match(ARTIFACT_REF_PATTERN);
  if (!match?.groups?.repo || !match.groups.path) {
    return null;
  }
  const relativePath = match.groups.path.replace(/^\/+/, "");
  if (!relativePath || relativePath.includes("..")) {
    return null;
  }
  return {
    repoName: match.groups.repo,
    relativePath,
  };
}

export function inferStackIdsFromBinds(
  binds: ReadonlyMap<string, string>,
): string[] {
  const stackIds = new Set<string>();
  for (const address of binds.values()) {
    const parsed = parseStackAddress(address);
    if (parsed) {
      stackIds.add(parsed.stackId);
    }
  }
  return [...stackIds].sort();
}

function parseUseFieldLine(line: string): {
  kind: TerraformArtifactKind;
  ref: TerraformArtifactRef;
} | null {
  const match = line.match(/^(plan|dot|state)\s+(.+)$/i);
  if (!match) {
    return null;
  }
  const kind = match[1]!.toLowerCase() as TerraformArtifactKind;
  const ref = parseArtifactRef(match[2]!);
  if (!ref) {
    return null;
  }
  return { kind, ref };
}

/** Parse TFD v3 `use` blocks plus existing bind/edge syntax. */
export function parseTfdComposition(text: string): ParsedTfdComposition {
  const useBlocks: ParsedTfdUseBlock[] = [];
  const bindEdgeLines: string[] = [];
  const lines = text.split(/\r?\n/);
  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index]!;
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      bindEdgeLines.push(rawLine);
      index += 1;
      continue;
    }

    const useMatch = line.match(/^use\s+([A-Za-z0-9][\w.-]*)\s*\{\s*$/);
    if (useMatch) {
      const stackId = useMatch[1]!;
      const block: ParsedTfdUseBlock = { stackId };
      index += 1;
      while (index < lines.length) {
        const inner = lines[index]!.trim();
        if (inner === "}") {
          index += 1;
          break;
        }
        if (!inner || inner.startsWith("#")) {
          index += 1;
          continue;
        }
        const field = parseUseFieldLine(inner);
        if (field) {
          block[field.kind] = field.ref;
        }
        index += 1;
      }
      useBlocks.push(block);
      continue;
    }

    bindEdgeLines.push(rawLine);
    index += 1;
  }

  const parsed = parseDeclaredDataFlowText(bindEdgeLines.join("\n"));
  return { ...parsed, useBlocks };
}

export function generateUseBlocksFromStackCatalog(
  repoName: string,
  stacks: readonly TerraformStackCatalogEntry[],
): string {
  const lines = stacks.map((stack) => {
    const planRef = formatArtifactRef({
      repoName,
      relativePath: stack.planPath,
    });
    const dotRef = formatArtifactRef({
      repoName,
      relativePath: stack.dotPath,
    });
    const stateLine = stack.statePath
      ? `\n  state ${formatArtifactRef({
          repoName,
          relativePath: stack.statePath,
        })}`
      : "";
    return `use ${stack.stackId} {\n  plan ${planRef}\n  dot ${dotRef}${stateLine}\n}`;
  });
  return lines.join("\n\n");
}

function catalogEntryForRef(
  catalog: readonly TerraformStackCatalogEntry[],
  ref: TerraformArtifactRef,
): TerraformStackCatalogEntry | undefined {
  return catalog.find(
    (entry) =>
      entry.planPath === ref.relativePath ||
      entry.dotPath === ref.relativePath ||
      entry.statePath === ref.relativePath,
  );
}

function loadArtifactContent(
  ref: TerraformArtifactRef,
  kind: TerraformArtifactKind,
  options: ApplyTfdCompositionOptions,
  catalog: readonly TerraformStackCatalogEntry[],
): { content: string | null; error?: string } {
  const fromLoader = options.artifactLoader?.(ref, kind);
  if (fromLoader?.content) {
    return { content: fromLoader.content };
  }

  const entry = catalogEntryForRef(catalog, ref);
  if (!entry) {
    return {
      content: null,
      error: `Artifact not found: ${formatArtifactRef(ref)}`,
    };
  }
  if (kind === "plan") {
    return { content: entry.planText ?? null };
  }
  if (kind === "dot") {
    return { content: entry.dotText ?? null };
  }
  return { content: entry.stateText ?? null };
}

function bundleFromFallbackSources(
  fallbackSources: TerraformImportPresetSources,
  stackId: string,
  catalog: readonly TerraformStackCatalogEntry[],
): TerraformPlanDotBundle | null {
  const match = fallbackSources.planDotBundles.find((bundle) =>
    bundleMatchesStackId(bundle, stackId, catalog),
  );
  if (!match) {
    return null;
  }
  return { ...match, label: stackId };
}

function buildBundleFromUseBlock(
  block: ParsedTfdUseBlock,
  options: ApplyTfdCompositionOptions,
  catalog: readonly TerraformStackCatalogEntry[],
  fallbackSources: TerraformImportPresetSources,
  errors: string[],
): TerraformPlanDotBundle | null {
  if (!block.plan || !block.dot) {
    errors.push(
      `use ${block.stackId}: requires both plan and dot artifact refs`,
    );
    return null;
  }

  const plan = loadArtifactContent(block.plan, "plan", options, catalog);
  const dot = loadArtifactContent(block.dot, "dot", options, catalog);
  if (!plan.content) {
    const fallback = bundleFromFallbackSources(
      fallbackSources,
      block.stackId,
      catalog,
    );
    if (fallback) {
      return fallback;
    }
    errors.push(
      plan.error ??
        `use ${block.stackId}: missing plan ${formatArtifactRef(block.plan)}`,
    );
    return null;
  }
  if (!dot.content) {
    const fallback = bundleFromFallbackSources(
      fallbackSources,
      block.stackId,
      catalog,
    );
    if (fallback) {
      return fallback;
    }
    errors.push(
      dot.error ??
        `use ${block.stackId}: missing dot ${formatArtifactRef(block.dot)}`,
    );
    return null;
  }

  let parsedPlan: unknown;
  try {
    parsedPlan = JSON.parse(plan.content);
  } catch {
    errors.push(
      `use ${block.stackId}: invalid plan JSON at ${formatArtifactRef(block.plan)}`,
    );
    return null;
  }

  return {
    plan: parsedPlan,
    dotText: dot.content,
    label: block.stackId,
  };
}

function bundleMatchesStackId(
  bundle: TerraformPlanDotBundle,
  stackId: string,
  catalog: readonly TerraformStackCatalogEntry[],
): boolean {
  const trimmedLabel = (bundle.label ?? "").trim();
  if (trimmedLabel === stackId) {
    return true;
  }
  const entry = catalog.find((candidate) => candidate.stackId === stackId);
  return entry != null && entry.label.trim() === trimmedLabel;
}

function filterBundlesByStackIds(
  sources: TerraformImportPresetSources,
  stackIds: readonly string[],
  catalog: readonly TerraformStackCatalogEntry[] = [],
): TerraformImportPresetSources {
  const wanted = new Set(stackIds);
  const planDotBundles = sources.planDotBundles.filter((bundle) =>
    stackIds.some((stackId) => bundleMatchesStackId(bundle, stackId, catalog)),
  );

  const states: unknown[] = [];
  const stateLabels: string[] = [];
  for (let index = 0; index < sources.stateLabels.length; index++) {
    const label = sources.stateLabels[index] ?? "";
    const stackId = catalog.find((entry) => entry.label.trim() === label.trim())
      ?.stackId;
    if (!wanted.has(label.trim()) && !(stackId && wanted.has(stackId))) {
      continue;
    }
    const state = sources.states[index];
    if (state !== undefined) {
      states.push(state);
      stateLabels.push(label);
    }
  }

  return {
    ...sources,
    planDotBundles,
    states,
    stateLabels,
  };
}

/**
 * Resolve import sources from TFD composition: `use` blocks select artifacts;
 * when absent, infer stack ids from binds and filter the fallback bundle list.
 */
export function applyTfdCompositionToSources(
  fallbackSources: TerraformImportPresetSources,
  tfdTexts: readonly string[],
  options: ApplyTfdCompositionOptions = {},
): ApplyTfdCompositionResult {
  const mergedTfd = tfdTexts.filter((text) => text?.trim()).join("\n\n");
  const composition = parseTfdComposition(mergedTfd || "tfd 2\n");
  const errors: string[] = [];
  const warnings: TerraformImportPresetWarning[] = [
    ...fallbackSources.warnings,
  ];
  const catalog = options.stackCatalog ?? [];

  if (composition.useBlocks.length > 0) {
    const planDotBundles: TerraformPlanDotBundle[] = [];
    const states: unknown[] = [];
    const stateLabels: string[] = [];

    for (const block of composition.useBlocks) {
      const bundle = buildBundleFromUseBlock(
        block,
        options,
        catalog,
        fallbackSources,
        errors,
      );
      if (!bundle) {
        continue;
      }
      planDotBundles.push(bundle);

      if (block.state) {
        const state = loadArtifactContent(
          block.state,
          "state",
          options,
          catalog,
        );
        if (state.content) {
          try {
            states.push(JSON.parse(state.content));
            stateLabels.push(bundle.label ?? block.stackId);
          } catch {
            errors.push(
              `use ${block.stackId}: invalid state JSON at ${formatArtifactRef(block.state)}`,
            );
          }
        } else {
          warnings.push({
            code: "missing_state_file",
            message:
              state.error ??
              `Optional state missing for use ${block.stackId}: ${formatArtifactRef(block.state)}`,
          });
        }
      } else {
        const catalogEntry = catalog.find(
          (entry) => entry.stackId === block.stackId,
        );
        if (catalogEntry?.statePath && !catalogEntry.stateText) {
          warnings.push({
            code: "missing_state_file",
            message: `Optional state file missing for stack "${block.stackId}".`,
          });
        }
      }
    }

    return {
      sources: {
        planDotBundles,
        states,
        stateLabels,
        tfdTexts: fallbackSources.tfdTexts,
        tfdLabels: fallbackSources.tfdLabels,
        warnings,
      },
      composition,
      errors,
      warnings,
    };
  }

  const inferred = inferStackIdsFromBinds(composition.binds);
  if (inferred.length === 0) {
    return {
      sources: fallbackSources,
      composition,
      errors,
      warnings,
    };
  }

  const filtered = filterBundlesByStackIds(fallbackSources, inferred, catalog);
  if (filtered.planDotBundles.length === 0) {
    errors.push(
      `TFD bind inference found stacks [${inferred.join(", ")}] but no matching import bundles were loaded.`,
    );
  }

  return {
    sources: filtered,
    composition,
    errors,
    warnings,
  };
}

export function tfdCompositionVersion(
  composition: ParsedTfdComposition,
): TfdVersion {
  if (composition.useBlocks.length > 0) {
    return Math.max(composition.version, 3) as TfdVersion;
  }
  return composition.version;
}
