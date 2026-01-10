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

## Measuring Coverage

When contributing new utilities, aim for 100% test coverage.

### Single-file Coverage (Recommended)

Running global coverage checks often fails due to global thresholds.  
To check coverage for only your changes, use:

```bash
yarn test --coverage <path-to-test-file> --coverage.include <path-to-source-file>
```

Example:

```bash
yarn test --coverage packages/common/tests/throttleRAF.test.ts --coverage.include packages/common/src/throttleRAF.ts
```

## Troubleshooting

**Environment Errors**  
If you see `jest-environment-jsdom cannot be found`, you are likely trying to use `npx jest`.  
Use `yarn test` to invoke the correct Vitest environment.

**Node Version**  
Ensure you are using **Node 20+** for compatibility with the monorepo.
