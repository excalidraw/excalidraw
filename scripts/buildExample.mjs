import * as esbuild from "esbuild";
import { sassPlugin } from "esbuild-sass-plugin";
import { execSync } from "child_process";

const createDevBuild = async () => {
  return await esbuild.build({
    entryPoints: ["example/index.tsx"],
    outfile: "example/public/bundle.js",
    define: {
      "import.meta.env": "{}",
    },
    bundle: true,
    format: "esm",
    plugins: [sassPlugin()],
    loader: {
      ".woff2": "dataurl",
      ".html": "copy",
    },
  });
};

const startServer = async (ctx) => {
  await ctx.serve({
    servedir: "example/public",
    port: 5001,
  });
};
execSync(
  `rm -rf example/public/dist && yarn build:esm && cp -r dist example/public`,
);

const ctx = await createDevBuild();

// await startServer(ctx);
// console.info("Hosted at port http://localhost:5001!!");
