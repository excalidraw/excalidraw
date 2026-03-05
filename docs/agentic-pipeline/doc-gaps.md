# Documentation gaps found during Stage 1 adoption

## 1) Hook ownership assumption in mixed-hook repos
- Original doc statement: run `mise run hooks:install`.
- Observed behavior: this installs Lefthook as primary git hook entrypoint, which conflicts with repos already using Husky.
- Why this is confusing: participants may unintentionally replace an existing hook strategy.
- Recommended wording:
  - Add an explicit branch in docs:
    - If target repo has no existing hook framework: run `mise run hooks:install`.
    - If target repo already uses Husky: keep Husky as owner and call Lefthook from `.husky/pre-commit` instead.
- Impact: High.
