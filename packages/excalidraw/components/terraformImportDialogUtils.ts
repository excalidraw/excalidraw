export type TerraformView = "module" | "semantic" | "pipeline";

export const MAX_PLAN_BUNDLES = 10;

export type PlanDotBundleRow = {
  id: string;
  planFile: File | null;
  dotFile: File | null;
  label: string;
};

export const VIEW_OPTIONS: ReadonlyArray<{
  value: TerraformView;
  label: string;
  description: string;
}> = [
  {
    value: "semantic",
    label: "Semantic view",
    description:
      "AWS account, region, VPC, and subnet topology plus provider boxes for other clouds.",
  },
  {
    value: "pipeline",
    label: "Pipeline view",
    description:
      "Left-to-right .tfd dataflow columns with topology context frames.",
  },
  {
    value: "module",
    label: "Module view",
    description: "Module-framed infrastructure graph.",
  },
];

export const joinPresetPath = (rootPath: string, relativePath: string) =>
  `${rootPath.replace(/\/+$/, "")}/${relativePath.replace(/^\/+/, "")}`;

export const toPresetId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const inferStackIdFromFileName = (
  name: string,
  fallbackIndex: number,
) => {
  const trimmed = name.trim();
  const noExt = trimmed.includes(".")
    ? trimmed.slice(0, trimmed.lastIndexOf("."))
    : trimmed;
  return toPresetId(noExt) || `stack-${fallbackIndex + 1}`;
};

export async function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

let bundleRowCounter = 0;

export const newBundleRow = (): PlanDotBundleRow => ({
  id: `bundle-${++bundleRowCounter}`,
  planFile: null,
  dotFile: null,
  label: "",
});
