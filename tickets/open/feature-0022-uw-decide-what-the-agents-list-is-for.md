# feature-0022-uw-decide-what-the-agents-list-is-for

**Type** feature · **Status** open · **Risk** low · **Opened** 2026-10-11 · **Owner** @zerwiz

## Problem

**Current:** Settings lets a user add **agents** — a name, a base URL, and a _Test connection_ that fetches the A2A card — and **nothing in the app ever reads them.** Measured by audit: `settings.agents` is written and never consumed outside the dialog. **Expected:** either agents are **used** for something, or the surface is **removed**. A settings page that implies a capability which does not exist is worse than one that is silent about it.

## Impact

**Affected:** anyone who adds an agent and waits for something to happen. **Risk if not built:** the settings surface loses credibility, and a real integration is buried under a dead one.

## Architecture intent

Decide, do not defer. The two honest outcomes are "wire it to a real feature" and "take it out"; a third — leaving it as a place to type a URL — is the one to refuse.

## Requirements

- **Decide**, in this ticket, which of: (a) agents become dispatch targets the panel can hand work to, (b) agents are removed from Settings and the store, or (c) agents are part of plan 03's skills as a remote-execution path.
- Whichever is chosen, the settings surface and the store agree — **no stored field without a reader** and no UI without an effect.
- If removed, `migrateSettings` drops the field cleanly and an existing store still loads.
- The decision is recorded in this ticket's Resolution with the reason, so it is not re-litigated.

## Non-goals

Not building a general A2A client; not a remote-agent marketplace.

## Test cases

- **Positive:** every field in Settings has a reader — demonstrated by pointing at the code that consumes it.
- **Negative:** if an agent is unreachable, whatever uses it **says so** rather than failing silently.
- **Compatibility:** a store written before the decision still loads.

## Resolution

_(filled on close)_
