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
  element.customData?.terraformEdgeLayer === "dataFlow" ||
  element.customData?.terraformEdgeLayer === "declaredDataFlow" ||
  element.customData?.terraformEdgeLayer === "networking";

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

/** True when the scene was built as semantic AWS topology (not ELK module graph). */
export const isTerraformSemanticOverviewScene = (
  elements: readonly ExcalidrawElement[],
) => elements.some((e) => e.customData?.terraformSemanticOverview === true);

/** True when the scene was built as TFD pipeline layout. */
export const isTerraformPipelineOverviewScene = (
  elements: readonly ExcalidrawElement[],
) => elements.some((e) => e.customData?.terraformPipelineOverview === true);

/** Graph address for Terraform focus / edges (`nodePath`, else `terraformVisibilityKey`). */
export const getTerraformGraphAddressForElement = (
  element: ExcalidrawElement | NonDeletedExcalidrawElement | undefined,
): string | null => {
  if (!element?.customData) {
    return null;
  }
  const cd = element.customData;
  if (typeof cd.nodePath === "string" && cd.nodePath.length > 0) {
    return cd.nodePath;
  }
  if (
    typeof cd.terraformVisibilityKey === "string" &&
    cd.terraformVisibilityKey.length > 0
  ) {
    return cd.terraformVisibilityKey;
  }
  return null;
};
