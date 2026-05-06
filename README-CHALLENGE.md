# Excalidraw Lasso Selection Challenge

## What is this?

A coding challenge based on the [Excalidraw](https://excalidraw.com) open-source whiteboard. A feature has been surgically removed from this codebase — your job is to re-implement it.

## The Challenge

**Implement a Lasso Selection Tool** — a freehand selection mode where users draw a loop around elements to select them, with animated trail feedback.

Read the full challenge description: [`.challenge/CHALLENGE.md`](.challenge/CHALLENGE.md)

## How to Participate

1. **Fork** this repository
2. **Create a branch** from `challenge/excalidraw-lasso-selection`
3. **Implement** the lasso selection tool following the requirements in CHALLENGE.md
4. **Open a Pull Request** targeting `challenge/excalidraw-lasso-selection`

## Automated Evaluation

When you open a PR, GitHub Actions will automatically run:

| Check | What it does |
|-------|-------------|
| **Typecheck** | `yarn test:typecheck` — TypeScript compilation |
| **Lasso Tests** | Runs your test file at `packages/excalidraw/tests/lasso.test.tsx` |
| **Regression Check** | Full test suite — ensures you didn't break existing features |

Results are posted as a comment on your PR.

## Scoring (100 points)

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| Correctness | 35% | Solves the stated problem, edge cases, logic |
| Code Quality | 20% | Project conventions, idiomatic, readable |
| Completeness | 20% | Full scope, error conditions, acceptance criteria |
| Minimality | 15% | Only necessary changes, no bloat |
| Test Quality | 10% | Meaningful tests if written |

**Hard gates:** Build failure or regressions cap your total at 30/100.

## Getting Started

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/excalidraw.git
cd excalidraw

# Install dependencies
yarn install

# Run the dev server
yarn start

# Run typecheck
yarn test:typecheck

# Run tests
yarn vitest run packages/excalidraw/tests/lasso.test.tsx --run
```

## Hints

Check the [CHALLENGE.md](.challenge/CHALLENGE.md) for detailed hints on where to start.

## Difficulty

**Hard** — estimated 2-4 hours
