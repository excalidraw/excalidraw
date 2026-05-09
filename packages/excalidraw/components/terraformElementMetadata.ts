import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

export const TERRAFORM_GROUP_FLAGS = [
  "terraformModuleGroup",
  "terraformAccountGroup",
  "terraformRegionGroup",
  "terraformVpcGroup",
  "terraformSubnetGroup",
] as const;

export const isTerraformResourceElement = (
  element: ExcalidrawElement | NonDeletedExcalidrawElement,
) => element.customData?.terraform && Boolean(element.customData?.nodePath);

export const isTerraformGroupElement = (
  element: ExcalidrawElement | NonDeletedExcalidrawElement,
) => TERRAFORM_GROUP_FLAGS.some((flag) => Boolean(element.customData?.[flag]));

export const isTerraformLayerEdge = (
  element: ExcalidrawElement | NonDeletedExcalidrawElement,
) =>
  element.customData?.terraformEdgeLayer === "dependency" ||
  element.customData?.terraformEdgeLayer === "dataFlow";

export const isTerraformInspectableElement = (
  element: ExcalidrawElement | NonDeletedExcalidrawElement | null,
) =>
  Boolean(
    element &&
      (isTerraformResourceElement(element) ||
        isTerraformGroupElement(element) ||
        isTerraformLayerEdge(element) ||
        element.customData?.relationship),
  );
