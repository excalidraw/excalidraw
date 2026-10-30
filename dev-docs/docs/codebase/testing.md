# Testing and Coverage Guide

This guide explains how to run tests and verify code coverage within the Excalidraw monorepo using **Vitest**.

## Transition to Vitest

Excalidraw has migrated from Jest to **Vitest**. All new contributions should be verified using the Vitest runner.

## Running Tests

To run tests locally, first ensure you have installed dependencies with:

```bash
yarn install
```

### Running specific tests

To avoid running the entire suite, you can target a specific file:

```bash
yarn test packages/common/tests/your-file.test.ts
```

## Coverage Guidelines

New utilities and shared logic should have adequate test coverage for new or modified code.
Running global coverage checks can fail due to unrelated files affecting thresholds.

### Single-file Coverage (Recommended)

To verify coverage only for the files affected by a change, use coverage filtering options provided by the Vitest test configuration in the monorepo:

```bash
yarn test --coverage <path-to-test-file> --coverage.include <path-to-source-file>
```

Example:

```bash
yarn test --coverage packages/common/src/utils.test.ts \
  --coverage.include packages/common/src/utils.ts
```

This approach ensures coverage requirements are evaluated only for the modified code without being blocked by global thresholds.

## Common Issues

**Environment Errors**  

If you encounter an error such as:

```bash
jest-environment-jsdom cannot be found
```

It is likely that tests are being executed with Jest instead of Vitest. Always use yarn test to invoke the correct test environment.

**Node Version**  

The Excalidraw monorepo requires Node.js 20 or later. Older versions may cause test failures or unexpected behavior.

This guide focuses on practical workflows for contributors and is intended to complement existing documentation.
