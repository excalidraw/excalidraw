const { CLIEngine } = require("eslint");

// see https://github.com/okonet/lint-staged#how-can-i-ignore-files-from-eslintignore-
// for explanation
const cli = new CLIEngine({});

module.exports = {
  "*.{js,ts,tsx,mjs,cjs}": (files) => {
    const lintable = files.filter((file) => !cli.isPathIgnored(file));
    if (lintable.length === 0) {
      return [];
    }
    return `eslint --max-warnings=0 --fix ${lintable.join(" ")}`;
  },
  "*.{css,scss,json,md,html,yml}": ["prettier --write"],
};
