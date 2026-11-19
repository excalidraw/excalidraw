// Runs as `prepublishOnly` in every published package.
//
// Only `pnpm publish` rewrites the `workspace:*` dependencies to real versions
// and applies `publishConfig.exports`. Published with npm or yarn, a package
// would depend on `workspace:*` and couldn't be installed.
const userAgent = process.env.npm_config_user_agent ?? "";

if (!userAgent.startsWith("pnpm/")) {
  const client = userAgent.split(" ")[0] || "an unknown client";

  console.error(
    `\nPublish with pnpm, not ${client}: run \`pnpm publish\` or \`pnpm release\`.\n`,
  );
  process.exit(1);
}
