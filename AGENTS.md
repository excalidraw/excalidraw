# Guidelines

- For new DOM/browser API usage, use `app.ownerDocument` and `app.ownerWindow` instead of globals; without `app`, derive them from the mounted node's `ownerDocument` and its `defaultView`.
- When overriding properties of an existing type, prefer `Merge<Base, Overrides>` from `@excalidraw/common/utility-types` over `Omit<Base, keyof Overrides> & Overrides`.

## Tickets — work starts from a contract

This fork tracks work as files in `tickets/`, not a SaaS backlog. **Never start work that already has a ticket, and never fix an adjacent problem inline — file it.**

```
ticket_flow[5]{step,action,where}:
  "1","look first","ls tickets/in-progress/ tickets/open/"
  "2","claim","git mv tickets/open/<f> tickets/in-progress/<f>"
  "3","readiness","answer the six questions from the ticket body alone; if any needs guessing, fix the ticket first"
  "4","build","follow the Non-goals; run the gates"
  "5","close","verify against Test cases, git mv to review/, fill Resolution"
```

The contract is five sections — Problem, Impact, Requirements, Non-goals, Test cases — plus **architecture intent** and **constraints**. Read:

- `tickets/README.md` — the operating model
- `.agents/skills/tickets/SKILL.md` — how to write, triage, split and close
- `RULES/08-tickets.md` — the law
- `docs/OWNERS.md` — who owns which surface
- `tickets/_templates/` — `bug` · `feature` · `chore` · `spike`

Naming: `<type>-<NNNN>-<devid>-<slug>.md`, dev id from `tickets/DEVIDS`. Check with `./bin/guards/ticket-ids.sh`.

## This fork's house rules

```
house_rules[4]{rule,detail}:
  "no unconfigured egress","nothing contacts an Excalidraw-controlled or third-party host — excalidraw.com backends, Firebase, Sentry, Vercel telemetry, the hosted AI backend — unless the operator configured that endpoint"
  "self-hosted by default","collaboration, storage and AI resolve to zerwizserver or localhost; the hosted Excalidraw service is never a default"
  "config is never hardcoded","a port, host, path or credential resolves from env/config with one documented default"
  "append-only","tickets/, RULES/ and docs/fixes/ are appended to, never rewritten — a correction is a new entry citing the old one"
```

## Run it

```bash
./scripts/start.sh    # the desktop app (Electron window + local dev server); no browser
./scripts/stop.sh     # stop it
```

## Gates

```bash
yarn test:typecheck
yarn test:app --watch=false
yarn test:code
yarn build:app
./bin/guards/ticket-ids.sh
./bin/guards/no-private-paths.sh   # this repo is PUBLIC: no operator path in it
```
