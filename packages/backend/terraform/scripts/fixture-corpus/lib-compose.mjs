import fs from "node:fs";
import path from "node:path";

import { PRESETS_DIR } from "./paths.mjs";

export function composeMain({ preset, patch = null, out }) {
  const base = preset.endsWith(".tfpart") ? preset : `${preset}.tfpart`;
  const presetPath = path.join(PRESETS_DIR, base);
  if (!fs.existsSync(presetPath)) {
    throw new Error(`Preset not found: ${presetPath}`);
  }
  let body = fs.readFileSync(presetPath, "utf8");
  if (patch) {
    const patchPath = path.isAbsolute(patch)
      ? patch
      : path.join(PRESETS_DIR, patch);
    body += `\n${fs.readFileSync(patchPath, "utf8")}`;
  }
  const header = `# Composed by fixture-corpus\n# preset: ${preset}\n\n`;
  fs.writeFileSync(out, header + body);
}
