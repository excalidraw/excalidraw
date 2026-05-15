import fs from "node:fs";
import path from "node:path";

import { TERRAFORM_ROOT } from "./paths.mjs";

const LINK_FILES = [
  "main.base.tf",
  "artifacts.tf",
  "variables.tf",
  "outputs.tf",
  "imports.tf",
  "moved.tf",
];

/** Isolated terraform root for one recipe (symlink shared files, copy state + workload). */
export function prepareTerraformRoot(caseDir, { workloadPath, statePath }) {
  const tfRoot = path.join(caseDir, "tf");
  fs.mkdirSync(tfRoot, { recursive: true });

  for (const file of LINK_FILES) {
    const src = path.join(TERRAFORM_ROOT, file);
    const dest = path.join(tfRoot, file);
    if (!fs.existsSync(src)) {
      continue;
    }
    if (fs.existsSync(dest)) {
      fs.unlinkSync(dest);
    }
    fs.symlinkSync(src, dest);
  }

  const modulesSrc = path.join(TERRAFORM_ROOT, "modules");
  const modulesDest = path.join(tfRoot, "modules");
  if (fs.existsSync(modulesDest)) {
    fs.unlinkSync(modulesDest);
  }
  fs.symlinkSync(modulesSrc, modulesDest);

  const buildsSrc = path.join(TERRAFORM_ROOT, "builds");
  if (fs.existsSync(buildsSrc)) {
    const buildsDest = path.join(tfRoot, "builds");
    if (!fs.existsSync(buildsDest)) {
      fs.symlinkSync(buildsSrc, buildsDest);
    }
  }

  const testPkg = path.join(TERRAFORM_ROOT, "test-package");
  if (fs.existsSync(testPkg)) {
    const dest = path.join(tfRoot, "test-package");
    if (!fs.existsSync(dest)) {
      fs.symlinkSync(testPkg, dest);
    }
  }

  fs.copyFileSync(workloadPath, path.join(tfRoot, "main.workload.tf"));
  fs.copyFileSync(statePath, path.join(tfRoot, "terraform.tfstate"));

  return tfRoot;
}
