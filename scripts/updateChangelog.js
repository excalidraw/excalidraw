const fs = require("fs");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

const excalidrawDir = `${__dirname}/../src/packages/excalidraw`;
const excalidrawPackage = `${excalidrawDir}/package.json`;
const pkg = require(excalidrawPackage);
const lastVersion = pkg.version;
const existingChangeLog = fs.readFileSync(
  `${excalidrawDir}/CHANGELOG.md`,
  "utf8",
);

const supportedTypes = ["feat", "fix", "style", "refactor", "perf", "build"];
const headerForType = {
  feat: "Features",
  fix: "Fixes",
  style: "Styles",
  refactor: " Refactor",
  perf: "Performance",
  build: "Build",
};

const getCommitHashForLastVersion = async () => {
  try {
    const commitMessage = `"release @excalidraw/excalidraw@${lastVersion}"`;
    const { stdout } = await exec(
      `git log --format=format:"%H" --grep=${commitMessage}`,
    );
    return stdout;
  } catch (e) {
    console.error(e);
  }
};

const getLibraryCommitsSinceLastRelease = async () => {
  const commitHash = await getCommitHashForLastVersion();
  const { stdout } = await exec(
    `git log --pretty=format:%s ${commitHash}...master`,
  );
  const commitsSinceLastRelease = stdout.split("\n");
  const commitList = {};
  supportedTypes.forEach((type) => {
    commitList[type] = [];
  });

  commitsSinceLastRelease.forEach((commit) => {
    const indexOfColon = commit.indexOf(":");
    const type = commit.slice(0, indexOfColon);
    if (!supportedTypes.includes(type)) {
      return;
    }
    const messageWithoutType = commit.slice(indexOfColon + 1).trim();
    const messageWithCapitalizeFirst =
      messageWithoutType.charAt(0).toUpperCase() + messageWithoutType.slice(1);
    const prNumber = commit.match(/\(#([0-9]*)\)/)[1];

    // return if the changelog already contains the pr number which would happen for package updates
    if (existingChangeLog.includes(prNumber)) {
      return;
    }
    const prMarkdown = `[#${prNumber}](https://github.com/excalidraw/excalidraw/pull/${prNumber})`;
    const messageWithPRLink = messageWithCapitalizeFirst.replace(
      /\(#[0-9]*\)/,
      prMarkdown,
    );
    commitList[type].push(messageWithPRLink);
  });
  return commitList;
};

const updateChangelog = async (nextVersion) => {
  const commitList = await getLibraryCommitsSinceLastRelease();
  let changelogForLibrary =
    "## Excalidraw Library\n\n**_This section lists the updates made to the excalidraw library and will not affect the integration._**\n\n";
  supportedTypes.forEach((type) => {
    if (commitList[type].length) {
      changelogForLibrary += `### ${headerForType[type]}\n\n`;
      const commits = commitList[type];
      commits.forEach((commit) => {
        changelogForLibrary += `- ${commit}\n\n`;
      });
    }
  });
  changelogForLibrary += "---\n";
  const lastVersionIndex = existingChangeLog.indexOf(`## ${lastVersion}`);
  let updatedContent =
    existingChangeLog.slice(0, lastVersionIndex) +
    changelogForLibrary +
    existingChangeLog.slice(lastVersionIndex);
  const currentDate = new Date().toISOString().slice(0, 10);
  const newVersion = `## ${nextVersion} (${currentDate})`;
  updatedContent = updatedContent.replace(`## Unreleased`, newVersion);
  fs.writeFileSync(`${excalidrawDir}/CHANGELOG.md`, updatedContent, "utf8");
};

module.exports = updateChangelog;
