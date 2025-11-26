import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-plugin-prettier";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import confusingBrowserGlobals from "confusing-browser-globals";

export default [
  js.configs.recommended,
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/dev-dist/**",
      "**/.yarn/**",
      "**/coverage/**",
      "dev-docs/**",
      "setupTests.ts",
      "public/service-worker.js",
    ],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      import: importPlugin,
      "jsx-a11y": jsxA11y,
      prettier,
      react,
      "react-hooks": reactHooks,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // TypeScript rules
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-inferrable-types": "off",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-check": false,
        },
      ],
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/constants"],
              message: "Avoid importing from barrel files (constants)",
            },
          ],
        },
      ],

      // React rules
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/display-name": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Import rules
      "import/no-unresolved": "off",
      "import/no-extraneous-dependencies": "off",

      // General rules
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-restricted-globals": ["error"].concat(
        confusingBrowserGlobals.filter((g) => g !== "self"),
      ),
      "no-console": ["error", { allow: ["warn", "error", "info"] }],
      "prefer-const": ["warn", { destructuring: "all" }],
      "no-else-return": ["error", { allowElseIf: false }],
      "no-lonely-if": "error",
      "no-inner-declarations": "off",

      // Prettier integration
      "prettier/prettier": "warn",
    },
  },
  // Package-specific rules for monorepo boundaries
  {
    files: ["packages/excalidraw/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/constants"],
              message: "Avoid importing from barrel files (constants)",
            },
            {
              group: ["**/../../excalidraw-app/**"],
              message:
                "Excalidraw library cannot import from excalidraw-app (circular dependency)",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/common/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/../../excalidraw-app/**"],
              message:
                "Common package cannot import from excalidraw-app (circular dependency)",
            },
            {
              group: ["**/../../excalidraw/**"],
              message:
                "Common package cannot import from excalidraw (circular dependency)",
            },
            {
              group: ["**/../../element/**"],
              message:
                "Common package cannot import from element (circular dependency)",
            },
            {
              group: ["**/../../utils/**"],
              message:
                "Common package cannot import from utils (circular dependency)",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/element/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/../../excalidraw-app/**"],
              message:
                "Element package cannot import from excalidraw-app (circular dependency)",
            },
            {
              group: ["**/../../excalidraw/**"],
              message:
                "Element package cannot import from excalidraw (circular dependency)",
            },
            {
              group: ["**/../../utils/**"],
              message:
                "Element package cannot import from utils (circular dependency)",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/math/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/../../excalidraw-app/**"],
              message:
                "Math package cannot import from excalidraw-app (circular dependency)",
            },
            {
              group: ["**/../../excalidraw/**"],
              message:
                "Math package cannot import from excalidraw (circular dependency)",
            },
            {
              group: ["**/../../element/**"],
              message:
                "Math package cannot import from element (circular dependency)",
            },
            {
              group: ["**/../../utils/**"],
              message:
                "Math package cannot import from utils (circular dependency)",
            },
            {
              group: ["**/../../common/**"],
              message:
                "Math package cannot import from common (circular dependency)",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["packages/utils/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/../../excalidraw-app/**"],
              message:
                "Utils package cannot import from excalidraw-app (circular dependency)",
            },
            {
              group: ["**/../../element/**"],
              message:
                "Utils package cannot import from element (circular dependency)",
            },
          ],
        },
      ],
    },
  },
  // Special case: Allow self reference in workers
  {
    files: ["**/workers/**/*.{js,ts}", "**/*.worker.{js,ts}"],
    languageOptions: {
      globals: {
        ...globals.worker,
        self: "readonly",
      },
    },
  },
  // Test files configuration
  {
    files: ["**/*.test.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
  // Script files configuration
  {
    files: ["scripts/**/*.{js,ts,mjs}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
    },
  },
  // Configuration files
  {
    files: ["*.config.{js,ts,mjs}", "*rc.{js,ts,mjs}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-var-requires": "off",
    },
  },
];
