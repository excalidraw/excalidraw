# Trouble: mise config not trusted

## Documented Step
From `ai-agents-pipeline/docs/agents/adopting-in-another-repo.md`:
- Copy `mise.toml` and `lefthook.yml`.
- Run `mise install` and `mise run hooks:install`.

## Observed Failure
`mise install` failed before tool installation because the copied `mise.toml` was not trusted in this repository.

## Evidence (command + output)
Command:
```bash
cd excalidraw
mise install
```
Output:
```text
mise ERROR error parsing config file: ~/Documents/Workshops/wr-26-make-yourself-obsolete-github/excalidraw/mise.toml
mise ERROR Config files in ~/Documents/Workshops/wr-26-make-yourself-obsolete-github/excalidraw/mise.toml are not trusted.
Trust them with `mise trust`. See https://mise.jdx.dev/cli/trust.html for more information.
```

## Root Cause
On this machine, `mise` requires explicit trust for repository config files before they can be executed.

## Fix Applied
Executed:
```bash
mise trust mise.toml
```

## Validation
After trusting, `mise install` proceeded and reported tools available:
```text
mise all tools are installed
```
