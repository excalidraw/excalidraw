/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-excalidraw-app-in-terraform",
      severity: "error",
      comment:
        "Terraform library modules must not import excalidraw-app (tests excluded via pathNot).",
      from: {
        path: "^packages/excalidraw/components/terraform",
        pathNot: "\\.test\\.(ts|tsx)$",
      },
      to: {
        path: "^excalidraw-app",
      },
    },
    {
      name: "layout-core-no-ui",
      severity: "error",
      comment: "Layout orchestrator must stay worker-safe and UI-free.",
      from: {
        path: "terraformLayoutCore\\.ts$",
      },
      to: {
        path: "TerraformImportDialog|LayerUI|TerraformSelectedShapeActions",
      },
    },
    {
      name: "link-modules-no-layout",
      severity: "error",
      comment:
        "Link extractors must not depend on the topology layout megafile.",
      from: {
        path: "terraformTopology.+Links\\.ts$",
      },
      to: {
        path: "terraformTopologyLayout\\.ts$",
      },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    exclude: {
      path: "(\\.test\\.(ts|tsx)$|__snapshots__)",
    },
  },
};
