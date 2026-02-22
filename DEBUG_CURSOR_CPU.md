# Debugging Cursor IDE at 100% CPU

## 1. Identify the Offending Process

```bash
# See all Cursor-related processes sorted by CPU usage
top -b -n 1 | grep -i cursor

# More detailed view with full command lines
ps aux --sort=-%cpu | grep -i cursor

# Or use htop for an interactive view (filter with F4 -> "cursor")
htop
```

Cursor is an Electron app, so you'll see multiple processes. Look for which one is eating CPU:

| Process type | What it is |
|---|---|
| `cursor --type=gpu-process` | GPU/rendering |
| `cursor --type=renderer` | A window/tab (editor, extensions, webviews) |
| `cursor --type=utility --utility-sub-type=node` | Extension host or language server |
| `cursor` (main, no flag) | Main/browser process |
| Child `node` processes | LSP servers, formatters, linters spawned by extensions |

Note the **PID** of the high-CPU process.

## 2. Check What That Process Is Doing

### Strace (system call tracing)

```bash
# Attach to the hot PID — shows what syscalls it's hammering
sudo strace -p <PID> -c -S time
# Let it run for ~10 seconds, then Ctrl+C to see a summary table

# For live output of individual calls
sudo strace -p <PID> -e trace=read,write,open,stat,poll -f 2>&1 | head -200
```

Look for:
- **Tight `poll`/`epoll_wait` with 0 timeout** — busy-loop (extension or IPC gone wrong)
- **Endless `read`/`write` on the same fd** — stuck IPC pipe or runaway file watcher
- **Constant `inotify_add_watch` / `stat`** — file watcher thrashing (node_modules, .git, build output)

### Perf (CPU profiling)

```bash
# Record 10 seconds of CPU samples
sudo perf record -p <PID> -g --call-graph dwarf -- sleep 10
sudo perf report
```

This shows which functions are burning CPU. Electron/V8 symbols will be mangled, but you can still spot patterns (e.g., stuck in `epoll`, GC loops, crypto).

## 3. Use Cursor's Built-in Dev Tools

Cursor inherits VS Code's Electron tooling:

```
Ctrl+Shift+P  ->  "Developer: Toggle Developer Tools"
```

- **Performance tab** — record a CPU profile directly in the renderer. Look for long-running JS tasks.
- **Console tab** — check for error spam (a tight catch-retry loop can pin CPU).

For the **extension host** specifically:

```
Ctrl+Shift+P  ->  "Developer: Show Running Extensions"
```

This shows per-extension activation time and status. If one extension is marked slow or erroring, that's your suspect.

## 4. Profile the Extension Host

```
Ctrl+Shift+P  ->  "Developer: Start Extension Host Profile"
# Wait 15-20 seconds while CPU is high
Ctrl+Shift+P  ->  "Developer: Stop Extension Host Profile"
```

This saves a `.cpuprofile` file. Open it in:
- Cursor's own dev tools (Performance tab -> Load profile)
- Chrome's `chrome://tracing`
- https://www.speedscope.app

Look for functions with high "self time" — that's where the CPU is actually spent.

## 5. Common Causes and Fixes

### File watcher overload

Cursor watches files for changes. Large directories (`node_modules`, `dist`, `.git`) cause thrashing.

```bash
# Check how many inotify watches are in use
cat /proc/sys/fs/inotify/max_user_watches
find /proc/<PID>/fdinfo -type f -exec grep -l inotify {} \; | wc -l
```

**Fix:** Add to Cursor settings (`settings.json`):

```json
{
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/.git/objects/**": true,
    "**/dist/**": true,
    "**/build/**": true,
    "**/.yarn/**": true
  }
}
```

### Runaway extension

```bash
# List child processes of the extension host
pstree -p <CURSOR_MAIN_PID> | grep -A2 "utility"
```

**Fix:** Disable extensions one-by-one to isolate:

```
cursor --disable-extensions
```

If CPU drops, binary-search by re-enabling half at a time.

### TypeScript language server spinning

Common in monorepos. The TS server may be re-checking the world in a loop.

```bash
# Check if tsserver is the hot child process
ps aux --sort=-%cpu | grep tsserver
```

**Fix:**
- Ensure `tsconfig.json` has proper `exclude` (node_modules, dist, build)
- Set `"typescript.tsserver.maxTsServerMemory": 4096` in settings
- Try `"typescript.tsserver.experimental.enableProjectDiagnostics": false`

### GPU process spinning

```bash
ps aux --sort=-%cpu | grep "gpu-process"
```

**Fix:** Disable GPU acceleration:

```bash
cursor --disable-gpu
```

Or in settings: `"disable-hardware-acceleration": true`

### AI/Copilot features looping

Cursor's AI features (autocomplete, chat, background indexing) can sometimes get stuck.

**Fix:**
- Disable background indexing: check Cursor-specific settings for "index" or "codebase"
- Toggle off AI autocomplete temporarily and see if CPU drops
- Check `~/.cursor/logs/` for recent error spam

## 6. Check Logs

```bash
# Cursor logs directory
ls -lt ~/.cursor/logs/

# Tail the most recent main log
tail -f ~/.cursor/logs/main.log

# Look for error spam (tight retry loops show up here)
grep -c "error\|Error\|ERROR" ~/.cursor/logs/*.log
```

## 7. Nuclear Options

If you just need it to stop right now:

```bash
# Throttle the process temporarily (send SIGSTOP / SIGCONT)
kill -STOP <PID>   # freeze it
kill -CONT <PID>   # resume when ready

# Limit it to 50% of one core with cpulimit
cpulimit -p <PID> -l 50

# Or just restart Cursor cleanly
kill <MAIN_PID>
cursor .
```

Reset Cursor state if nothing else works:

```bash
# Back up settings first
cp -r ~/.cursor/User/settings.json ~/cursor-settings-backup.json

# Clear cached data (extensions and settings are preserved)
rm -rf ~/.cursor/CachedData
rm -rf ~/.cursor/Cache
rm -rf ~/.cursor/GPUCache

# Restart
cursor .
```
