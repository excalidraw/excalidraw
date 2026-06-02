import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { TerraformModuleLayoutOptions } from "./terraformModuleLayoutOptions";
import type {
  TerraformLayoutOptions,
  TerraformPlanParsingSources,
} from "./terraformLayoutCore";
import type { TerraformPlanNodesMap } from "./terraformPlanParsing";
import type { TerraformProviderFamily } from "./terraformProviderClassification";

export type TerraformLayoutProgress = {
  phase: string;
  done: number;
  total: number;
};

export type TerraformLayoutWorkerJob =
  | {
      type: "moduleStack";
      stackId: string;
      plan: unknown;
      dotText: string;
      moduleLayoutOptions?: Partial<TerraformModuleLayoutOptions>;
    }
  | {
      type: "semanticAws";
      prep: SemanticAwsLayoutPrep;
    }
  | {
      type: "semanticAwsShard";
      shardId: string;
      prep: SemanticAwsLayoutPrep;
    }
  | {
      type: "semanticProvider";
      family: TerraformProviderFamily;
      label: string;
      changes: unknown[];
      nodes: TerraformPlanNodesMap;
      plan: unknown;
    };

export type SemanticAwsLayoutPrep = {
  topoModel: unknown;
  zones: unknown[];
  regionalBuckets: unknown[];
  nodes: TerraformPlanNodesMap;
  awsPlan: unknown;
  vpcEndpointBuckets: unknown[];
  routeTableBottomPlacements: unknown;
  vpcDefaultPlumbingBuckets: unknown[];
  vpcFlowLogBuckets: unknown[];
  endpointSecurityGroupBuckets: unknown[];
  natZonePlacements: unknown;
  interfaceVpcEndpointZonePlacements: unknown;
  deferDecorations?: boolean;
  /** Staging fast path: skip per-zone route anchor debug rows in topology meta. */
  skipZoneRouteAnchorDebug?: boolean;
};

export type TerraformLayoutWorkerJobResult =
  | {
      type: "moduleStack";
      stackId: string;
      elements: ExcalidrawElement[];
      meta: Record<string, unknown>;
    }
  | {
      type: "semanticAws";
      elements: ExcalidrawElement[];
      meta: Record<string, unknown>;
      files?: Record<string, unknown>;
    }
  | {
      type: "semanticAwsShard";
      shardId: string;
      elements: ExcalidrawElement[];
      meta: Record<string, unknown>;
      files?: Record<string, unknown>;
    }
  | {
      type: "semanticProvider";
      family: TerraformProviderFamily;
      elements: ExcalidrawElement[];
    };

export type TerraformLayoutWorkerRequest = {
  id: number;
  job: TerraformLayoutWorkerJob;
};

export type TerraformLayoutWorkerResponse =
  | { id: number; ok: true; result: TerraformLayoutWorkerJobResult }
  | { id: number; ok: false; error: string };

export type LayoutViaWorkersOptions = {
  onProgress?: (progress: TerraformLayoutProgress) => void;
  signal?: AbortSignal;
};

export type { TerraformPlanParsingSources, TerraformLayoutOptions };
