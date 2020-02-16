module.exports = {
  globals: {
    Cypress: "readonly",
    cy: "readonly",
  },
  overrides: [
    {
      "files": ["**/*.ts"],
      rules: {
        "@typescript-eslint/no-unused-vars": ["off"],
      },
    },
  ],
};
