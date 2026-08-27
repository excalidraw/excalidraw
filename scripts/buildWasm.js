/**
 * This script is used to convert the wasm modules into js modules, with the binary converted into base64 encoded strings.
 */
const fs = require("fs");
const path = require("path");

const wasmModules = [
  {
    pkg: `../node_modules/fonteditor-core`,
    src: `./wasm/woff2.wasm`,
    dest: `../packages/excalidraw/fonts/wasm/woff2-wasm.ts`,
  },
  {
    pkg: `../node_modules/harfbuzzjs`,
    src: `./wasm/hb-subset.wasm`,
    dest: `../packages/excalidraw/fonts/wasm/hb-subset-wasm.ts`,
  },
];

for (const { pkg, src, dest } of wasmModules) {
  const packagePath = path.resolve(__dirname, pkg, "package.json");
  const licensePath = path.resolve(__dirname, pkg, "LICENSE");
  const sourcePath = path.resolve(__dirname, src);
  const destPath = path.resolve(__dirname, dest);

  const {
    name,
    version,
    author,
    license,
    authors,
    licenses,
  } = require(packagePath);

  const licenseContent = fs.readFileSync(licensePath, "utf-8") || "";
  const base64 = fs.readFileSync(sourcePath, "base64");
  const content = `// GENERATED CODE -- DO NOT EDIT!
/* eslint-disable */
// @ts-nocheck

/**
* The following wasm module is generated with \`scripts/buildWasm.js\` and encoded as base64.
*
* The source of this content is taken from the package "${name}", which contains the following metadata:
* 
* @author ${author || JSON.stringify(authors)} 
* @license ${license || JSON.stringify(licenses)}
* @version ${version}

${licenseContent}
*/

// faster atob alternative - https://github.com/evanw/esbuild/issues/1534#issuecomment-902738399
const __toBinary = /* @__PURE__ */ (() => {
  const table = new Uint8Array(128);
  for (let i = 0; i < 64; i++)
    {table[i < 26 ? i + 65 : i < 52 ? i + 71 : i < 62 ? i - 4 : i * 4 - 205] = i;}
  return (base64) => {
    const n = base64.length; const bytes = new Uint8Array((n - (base64[n - 1] == "=") - (base64[n - 2] == "=")) * 3 / 4 | 0);
    for (let i2 = 0, j = 0; i2 < n; ) {
      const c0 = table[base64.charCodeAt(i2++)]; const c1 = table[base64.charCodeAt(i2++)];
      const c2 = table[base64.charCodeAt(i2++)]; const c3 = table[base64.charCodeAt(i2++)];
      bytes[j++] = c0 << 2 | c1 >> 4;
      bytes[j++] = c1 << 4 | c2 >> 2;
      bytes[j++] = c2 << 6 | c3;
    }
    return bytes;
  };
})();

export default __toBinary(\`${base64}\`);
`;

  fs.writeFileSync(destPath, content);
}
