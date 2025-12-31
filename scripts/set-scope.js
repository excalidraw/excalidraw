const fs = require("fs");
const path = require("path");

const PACKAGES = ["common", "math", "element", "excalidraw"];
const PACKAGES_DIR = path.resolve(__dirname, "../packages");

const normalizeScope = (value) =>
  value ? value.trim().replace(/^@/, "") : "";

const formatScope = (value) => `@${value}`;

const args = process.argv.slice(2);

let nextScope = "";
let previousScope = "excalidraw";

for (const argument of args) {
  if (/--help/.test(argument)) {
    console.info(`Usage:
  yarn set:scope --scope=@myteam [--from=@excalidraw]

Options:
  --scope   新 scope，必须提供
  --from    旧 scope，默认 @excalidraw
`);
    process.exit(0);
  }

  if (/--scope=/.test(argument)) {
    nextScope = argument.split("=")[1];
    continue;
  }

  if (/--from=/.test(argument)) {
    previousScope = argument.split("=")[1];
    continue;
  }

  console.error(`无法识别的参数：${argument}`);
  process.exit(1);
}

const newScope = normalizeScope(nextScope);
const oldScope = normalizeScope(previousScope);

if (!newScope) {
  console.error("请通过 --scope=<scope> 指定新的 scope。");
  process.exit(1);
}

if (!oldScope) {
  console.error("旧 scope 不能为空。");
  process.exit(1);
}

if (newScope === oldScope) {
  console.warn("新旧 scope 相同，未做任何修改。");
  process.exit(0);
}

const replaceDependencies = (deps) => {
  if (!deps) {
    return;
  }

  for (const packageName of PACKAGES) {
    const oldName = `${formatScope(oldScope)}/${packageName}`;
    const newName = `${formatScope(newScope)}/${packageName}`;

    if (deps[oldName]) {
      // 使用中文注释说明逻辑：将旧 scope 依赖改成新 scope
      deps[newName] = deps[oldName];
      delete deps[oldName];
    }
  }
};

const updatePackageJson = (packageName) => {
  const packageJsonPath = path.resolve(
    PACKAGES_DIR,
    packageName,
    "package.json",
  );

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  pkg.name = `${formatScope(newScope)}/${packageName}`;

  replaceDependencies(pkg.dependencies);
  replaceDependencies(pkg.devDependencies);
  replaceDependencies(pkg.peerDependencies);
  replaceDependencies(pkg.optionalDependencies);

  fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);

  console.info(`已更新 ${pkg.name}`);
};

for (const packageName of PACKAGES) {
  updatePackageJson(packageName);
}

console.info(
  `Scope 已从 ${formatScope(oldScope)} 替换为 ${formatScope(newScope)}。`,
);

