# feature-0019-uw-host-models-on-the-tailnet

**Type** feature · **Status** open · **Risk** medium · **Opened** 2026-10-11 · **Owner** @zerwiz

## Problem

**Current:** models are hosted on **heimdall** and reachable over the tailnet, but every other machine is **loopback-only**. Measured 2026-10-11 on this laptop: `llama-server` bound `127.0.0.1:8080`, and the server asking for `http://omarchy.tailefab81.ts.net:8080/v1/models` got **no answer at all**. So a rail that can serve a 35B model was invisible to the fleet and to the deployed app, and the deployment fell back to a model that could not answer (`feature-0018`).

**Expected:** a machine can **publish its rail on the tailnet** deliberately, in one documented step, so that the server, a teammate, or another agent can use the model — and it can be unpublished just as deliberately.

## Impact

**Affected:** the deployed chat (which needs a model that answers), and every teammate whose own machine could serve a model but currently cannot share it.

**Risk if not built:** every deployment depends on a model that happens to be installed _on the server_, which is the weakest machine in the fleet.

## Architecture intent

**Tailscale is the transport, and the rail is not moved.** The model keeps binding loopback; the tailnet address is a published door onto it. That keeps the rail's own security posture (a local service) while making it reachable by exactly the devices on the tailnet — and nothing else.

## Requirements

- A documented, one-step publish per machine: the rail's loopback port becomes reachable at the tailnet address, **without changing how the rail itself binds or how it is launched**.
- It survives a reboot (a supervised unit), not a shell that has to stay open.
- Unpublishing is equally one step, and the documentation says which command.
- **A published rail is stated as a decision**, with its consequence written down: any device on the tailnet can use the model, and anything pointed at it **depends on that machine being awake**.
- The publish is **idempotent** — running it twice does not stack forwards.
- Nothing is published on the **public internet** by this ticket; `tailscale funnel` is explicitly out of scope.

## Constraints

- No elevation assumed beyond what the machine needs on its own rail (the forwarder binds a high port on the tailnet address, which an ordinary user may do).
- No secret in the repo: a rail's API key, if it has one, stays local.
- The published model list is the **sender's** concern; the receiver chooses what to use.

## Non-goals

- Not model hosting _quality_ — a machine shares what it already runs.
- Not publishing to the internet.
- Not a model router or a fleet-wide catalogue; that is `feature-0018`'s floor and the team vault's gateway.

## Test cases

- **Positive:** after publishing, a **different tailnet machine** fetches the model list from the sender's tailnet address and gets `200` with models.
- **Negative:** with nothing published, the same request fails — proving the door is what changed.
- **Positive:** unpublishing restores the failure without touching the rail.
- **Compatibility:** the rail still answers on `127.0.0.1` exactly as before, and its own launcher is unchanged.

## Resolution

_(filled on close)_
