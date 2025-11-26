// ESLint 9 with flat config handles ignores automatically
// No need to manually filter ignored files
module.exports = {
  "*.{js,ts,tsx}": "eslint --max-warnings=0 --fix",
  "*.{css,scss,json,md,html,yml}": "prettier --write",
};
