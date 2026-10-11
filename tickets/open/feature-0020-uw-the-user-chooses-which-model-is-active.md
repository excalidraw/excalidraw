# feature-0020-uw-the-user-chooses-which-model-is-active

**Type** feature · **Status** open · **Risk** medium · **Opened** 2026-10-11 · **Owner** @zerwiz

## Problem

**Current:** `AI.tsx` resolves `settings.models[0]` — **always the first entry**. A user with a fast local model _and_ a strong hosted one has no way to choose between them: there is no active mark, no chooser, no reorder. The only way to use the second is to **delete the first**. **Expected:** one model is **active**, the user says which, and everything else in the list stays configured and ready.

## Impact

**Affected:** anyone with more than one model — which is the normal case for anyone who has a local rail _and_ an API key. **Risk if not built:** the model list is decorative; the panel's honesty about _which_ model answers (already built) is undermined by there being no way to change it.

## Architecture intent

An **active id**, not a layout. Ordering is a workaround for a choice, and a choice deserves to be stated.

## Requirements

- The settings shape gains an active model (`activeModelId`), migrated from the old shape by taking the first entry — so nobody's configuration changes under them.
- Settings marks the active model and offers to make another active.
- The AI panel names the **active** model (it already names one; it must name the right one).
- Removing the active model falls back to **another configured model** if one exists, and to the install default only if none does — never to nothing while others sit in the list.
- With no models configured, the install default is the active one, and the panel says so.

## Non-goals

Not per-room model choice; not automatic selection by cost or speed; not the conversation and skills of plan 03.

## Test cases

- **Positive:** two models configured, the second made active → the panel names the second, and the first is still in the list afterwards.
- **Negative:** removing the active model while another exists → the other becomes active; the panel never claims "no model" while a configured one remains.
- **Compatibility:** a store written before this change loads with the first entry active.

## Resolution

_(filled on close)_
