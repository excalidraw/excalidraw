# AGENTS.md - Excalidraw (AI Agent Mode)

## 1. Environment & Topology

- **Dev machine**: VM112 `dev-sandbox` (`192.168.1.96`, user `dev`)
  - Repo path: `/home/dev/projects/excalidraw`
  - Active branch: `feat/ai-agent-mode`
  - Runtime: Node 22 + Yarn `1.22.22` (GitHub CLI `gh` authenticated as `rpb-dev`)
  - Dev server: `http://192.168.1.96:3001` (LAN accessible)
  - Web IDE: `code-server` on `http://192.168.1.96:8080`
  - Browser verification: headless Playwright MCP is available in `opencode`
- **Production target**: CT131 `excalidraw` (`192.168.1.87:8085`)
  - Path: `/opt/excalidraw-ai` (Docker Compose `compose.prod.yml` + nginx reverse proxy)
  - Public URL: `https://excalidraw.rpb.pt` (Cloudflare Tunnel "Home Server" + Cloudflare Access)
- **AI backend (LiteLLM)**: CT117 (`http://192.168.1.91:4000/v1`)
  - Default model: `gpt-6-luna`
  - Other allowed models on the `excalidraw-ai` virtual key: `claude-sonnet-5.5`, `mimo-v2.6-flash`, `deepseek-chat`, `kimi-k3`
  - Auth is injected server-side via `/api/llm` (Vite proxy in dev using `.env.local`; nginx proxy in prod using `/opt/excalidraw-ai/.env`)

## 2. Standard Commands

Always set `NODE_OPTIONS="--dns-result-order=ipv4first"` for network commands in VM112 (IPv6 egress is blocked by firewall).

```bash
# Start Vite dev server with HMR + /api/llm -> LiteLLM proxy (port 3001)
./bin/dev.sh

# Type check & lint/format
yarn test:typecheck
yarn fix

# Run AI Agent unit tests or full suite
npx vitest run excalidraw-app/tests/aiAgent.test.ts
yarn test:update

# Sync workspace to CT131, rebuild Docker prod image, and verify HTTP 200
./bin/sync-to-prod.sh
```

## 3. AI Agent Mode Architecture

Core files live under `excalidraw-app/components/ai-agent/`:
- `AIAgentSidebarTab.tsx` - Sidebar UI, chat history (`aiAgentMessagesAtom`), settings panel, cursor lifecycle.
- `aiAgentSettings.ts` - Default provider config (`provider: "custom"`, `baseURL: "/api/llm"`, `model: "gpt-6-luna"`, `apiKey: "litellm-proxy"`), `localStorage` persistence, and `testLLMConnection` (`max_tokens: 64` so reasoning models like `gpt-6-luna` do not truncate).
- `aiAgentService.ts` - OpenAI-compatible SSE streaming client (`streamAIChat`), Mermaid block extraction, and canvas context summary.
- `agentCursorController.ts` - Animated collaborator cursor while the agent draws.
- `diagramGenerator.ts` - Mermaid parsing and animated insertion onto the Excalidraw canvas.
- `excalidraw-app/tests/aiAgent.test.ts` - Unit tests for AI Agent mode.
- `excalidraw-app/vite.config.mts` - Dev server config (`port: 3001`, `host: true`) and `/api/llm` proxy to LiteLLM.

## 4. Guardrails for Agents

- **Secrets**: Never print, log, or commit `.env`, `.env.local`, `/home/dev/.ssh/id_ed25519_excalidraw_deploy`, or LiteLLM API keys.
- **Same-origin LLM proxy**: Keep browser requests targeting `/api/llm` (never hardcode real API keys in frontend code). Users can still override provider/key in the UI settings for BYOK.
- **Verification before deploy**: Run `yarn test:typecheck` and `npx vitest run excalidraw-app/tests/aiAgent.test.ts` before running `./bin/sync-to-prod.sh`.
- **Safe process cleanup**: Never run broad `pkill -f` commands that could match `opencode` or your own subshell.
- **Production files on CT131**: `./bin/sync-to-prod.sh` intentionally excludes `.env`, `.env.local`, `compose.prod.yml`, `nginx.conf.template`, and `bin/`. Do not remove those excludes.

## 5. Upstream Excalidraw Guidelines

- For new DOM/browser API usage, use `app.ownerDocument` and `app.ownerWindow` instead of globals; without `app`, derive them from the mounted node's `ownerDocument` and its `defaultView`.
- When overriding properties of an existing type, prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit<Base, keyof Overrides> & Overrides`.

### Crowdin (translations)

Crowdin is the source of truth for `packages/excalidraw/locales/*.json` (except `en.json`). The GitHub integration reads `en.json` from `master` (Crowdin branch `master`, hence `-b master` on every CLI command) and pushes translations to `l10n_master`; edits committed straight to locale files are overwritten on its next sync.

Workflow for changing translations:

1. Check out `l10n_master` and pull. Older locale files would be imported as extra translations and can override translators' newer fixes.
2. Edit the locale JSON files; keep `{{placeholders}}` and tags intact.
3. Upload each edited language: `crowdin upload translations -b master -l <lang> --import-eq-suggestions --preserve-hierarchy`.
   - `--preserve-hierarchy` is required: without it the CLI looks for `en.json` at the root of the Crowdin branch and fails ("Source file ... does not exist"), even though `--dryrun` passes.
   - `-l` takes one language (repeated flags keep only the last); without it, every language is uploaded.
   - `--import-eq-suggestions` keeps translations identical to the English source (key names like `Ctrl`, `Tab`, product names); otherwise Crowdin skips them as untranslated.
   - Uploads land as unapproved suggestions. A string with an approved translation keeps exporting the approved one, so changing an approved translation also needs an approval (Crowdin editor, or the API: add the translation, then `POST /approvals`).
4. Sync back: `crowdin download -b master` in the same checkout. The output matches the integration's files byte for byte, so its next sync finds nothing to push.
5. Check `git diff`: the edited files should match your edits exactly (a mismatch means Crowdin still exports another translation). Commit and push to `l10n_master`; CI recomputes `percentages.json`.
