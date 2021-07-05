const fs = require("fs");

const updateReadme = () => {
  const excalidrawDir = `${__dirname}/../src/packages/excalidraw`;
  let data = fs.readFileSync(`${excalidrawDir}/README_NEXT.md`, "utf8");

  // remove note for unstable release
  data = data.replace(
    /<!-- unstable-readme-start-->[\s\S]*?<!-- unstable-readme-end-->/,
    "",
  );

  // replace "excalidraw-next" with "excalidraw"
  data = data.replace(/excalidraw-next/g, "excalidraw");
  data = data.trim();

  const demoIndex = data.indexOf("### Demo");
  const excalidrawNextNote =
    "#### Note\n\n**If you don't want to wait for the next stable release and try out the unreleased changes you can use [@excalidraw/excalidraw-next](https://www.npmjs.com/package/@excalidraw/excalidraw-next).**\n\n";
  // Add excalidraw next note to try out for unreleased changes
  data = data.slice(0, demoIndex) + excalidrawNextNote + data.slice(demoIndex);

  // update readme
  fs.writeFileSync(`${excalidrawDir}/README.md`, data, "utf8");
};

module.exports = updateReadme;
