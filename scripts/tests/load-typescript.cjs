const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

// Execute the production module with explicit dependency doubles, without
// loading the editor or a browser. Run with node --test scripts/tests/*.cjs.
exports.loadTypeScript = (file, dependencies, globals = {}) => {
  const filename = path.resolve(__dirname, "../..", file);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.React,
    },
    fileName: filename,
    reportDiagnostics: true,
  });
  if (output.diagnostics?.length) {
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(output.diagnostics, {
        getCurrentDirectory: () => process.cwd(),
        getCanonicalFileName: (name) => name,
        getNewLine: () => "\n",
      }),
    );
  }
  const context = {
    exports: {},
    console,
    ...globals,
    require: (name) => {
      if (!(name in dependencies)) {
        throw new Error(`Missing dependency double: ${name}`);
      }
      return dependencies[name];
    },
  };
  vm.runInNewContext(output.outputText, context, { filename });
  return context.exports;
};
