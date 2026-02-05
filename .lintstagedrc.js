module.exports = {
  "*.{js,ts,tsx}": ["oxlint --fix", "oxfmt --write"],
  "*.{css,scss,json,md,html,yml}": ["oxfmt --write"],
};
