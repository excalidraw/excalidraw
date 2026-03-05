# Trouble: mise trust blocked by sandbox permissions

## Documented Step
Run `mise install` after copying `mise.toml`.

## Observed Failure
Running the prerequisite `mise trust mise.toml` failed because the process could not write under `~/.local/state/mise/trusted-configs` in the current sandbox.

## Evidence (command + output)
Command:
```bash
cd excalidraw
mise trust mise.toml
```
Output:
```text
mise ERROR failed to ln -sf /Users/sajjadtng/Documents/Workshops/wr-26-make-yourself-obsolete-github/excalidraw /Users/sajjadtng/.local/state/mise/trusted-configs/wr-26-make-yourself--excalidraw-4716c5691b340a27
mise ERROR Operation not permitted (os error 1)
```

## Root Cause
`mise trust` writes to a user-level state directory outside the writable sandbox roots.

## Fix Applied
Re-ran trust/install/hooks with elevated permissions so `mise` could update user-level state:
```bash
mise trust mise.toml
mise install
mise run hooks:install
```

## Validation
Commands completed successfully:
```text
mise trusted /Users/sajjadtng/Documents/Workshops/wr-26-make-yourself-obsolete-github/excalidraw
mise all tools are installed
sync hooks: ✔️ (pre-commit)
```
