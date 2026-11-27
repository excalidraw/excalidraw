// A/B mirror harness: serves two Excalidraw source trees from one origin, each
// in its own iframe page (/left/, /right/), so the parent page can reach both
// editors directly and mirror input between them.
//
// Start it with `yarn ab <ref> [<ref>]` (ab.mjs), which resolves the trees
// and passes them in as AB_TREES.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import type { Plugin } from "vite";

const HARNESS = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HARNESS, "..");

type Side = "left" | "right";

type Tree = {
  side: Side;
  kind: "commit" | "dir";
  root: string;
  label: string;
  sha: string;
  subject: string;
  dirty: boolean;
  warning: string;
};

if (!process.env.AB_TREES) {
  throw new Error(
    "[ab] start the harness with `yarn ab <ref> [<ref>]` (see ab-mirror/README.md)",
  );
}
const TREES: Record<Side, Tree> = JSON.parse(process.env.AB_TREES);
const SIDES: Side[] = ["left", "right"];

// workspace packages, resolved into the importing file's tree
const PACKAGES: Record<string, { entry: string; dir: string }> = {
  common: { entry: "packages/common/src/index.ts", dir: "packages/common/src" },
  element: {
    entry: "packages/element/src/index.ts",
    dir: "packages/element/src",
  },
  excalidraw: {
    entry: "packages/excalidraw/index.tsx",
    dir: "packages/excalidraw",
  },
  math: { entry: "packages/math/src/index.ts", dir: "packages/math/src" },
  utils: { entry: "packages/utils/src/index.ts", dir: "packages/utils/src" },
  "fractional-indexing": {
    entry: "packages/fractional-indexing/src/index.ts",
    dir: "packages/fractional-indexing/src",
  },
  "laser-pointer": {
    entry: "packages/laser-pointer/src/index.ts",
    dir: "packages/laser-pointer/src",
  },
};

const treeOf = (importer: string | undefined): Side | null => {
  if (!importer) {
    return null;
  }
  const file = importer.replace(/[?#].*$/, "");
  if (file.includes("/node_modules/")) {
    return null;
  }
  // the pane entries first: the harness itself may live inside a tree (`yarn ab .`)
  const entrySide = SIDES.find((side) =>
    file.startsWith(`${HARNESS}/${side}/`),
  );
  if (entrySide) {
    return entrySide;
  }
  // the deepest root wins, should one tree contain the other
  return (
    [...SIDES]
      .sort((a, b) => TREES[b].root.length - TREES[a].root.length)
      .find((side) => file.startsWith(`${TREES[side].root}/`)) ?? null
  );
};

const treeResolver = (): Plugin => ({
  name: "ab-tree-resolver",
  enforce: "pre",
  async resolveId(source, importer, options) {
    const match = /^@excalidraw\/([a-z-]+)(?:\/(.+))?$/.exec(source);
    const pkg = match && PACKAGES[match[1]];
    if (!match || !pkg) {
      return null;
    }
    const side = treeOf(importer);
    if (!side) {
      this.error(
        `[ab] can't tell which tree "${source}" belongs to (imported from ${importer}). ` +
          `Only files in left/, right/ or the trees themselves may import @excalidraw/*.`,
      );
    }
    const root = TREES[side!].root;
    const target = match[2]
      ? path.join(root, pkg.dir, match[2])
      : path.join(root, pkg.entry);
    return this.resolve(target, importer, { ...options, skipSelf: true });
  },
});

const treesEndpoint = (): Plugin => ({
  name: "ab-trees-endpoint",
  configureServer(server) {
    server.middlewares.use("/__ab/trees", (_req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(TREES));
    });
  },
});

export default defineConfig({
  root: HARNESS,
  appType: "mpa",
  cacheDir: path.join(HARNESS, ".vite"),
  // VITE_APP_* vars the editor reads (same for both trees)
  envDir: REPO,
  server: {
    host: "127.0.0.1",
    port: 3091,
    strictPort: false,
    open: false,
    // commit snapshots never change (and there may be many of them)
    watch: { ignored: [`${HARNESS}/.cache/**`] },
    fs: {
      allow: [
        HARNESS,
        TREES.left.root,
        TREES.right.root,
        // snapshots link their node_modules here
        fs.realpathSync(path.join(REPO, "node_modules")),
      ],
    },
  },
  resolve: {
    // one React per page: host.tsx renders the tree's <Excalidraw>, and a
    // live checkout with its own node_modules would bring a second copy
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    entries: ["index.html", "left/index.html", "right/index.html"],
  },
  plugins: [treeResolver(), treesEndpoint(), react()],
});
