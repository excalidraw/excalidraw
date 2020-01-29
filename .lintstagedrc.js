const { CLIEngine } = require("eslint");

// see https://github.com/okonet/lint-staged#how-can-i-ignore-files-from-eslintignore-
//  for explanation
const cli = new CLIEngine({});

module.exports = {
  "*.{js,ts,tsx}": files => {
    return (
      "eslint --max-warnings=0 " +
      files.filter(file => !cli.isPathIgnored(file)).join(" ")
    );
  },
  "*.{js,css,scss,json,md,ts,tsx,html,yml}": ["prettier --write"],
};
