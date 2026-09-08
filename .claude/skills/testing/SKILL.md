---
name: testing
description: Test scope, trigger conditions, external integration tests, and pre-merge checklist for IndieWeb spec routes.
trigger: Before releasing any spec route or merging any branch.
---

# Testing

## When to Run What

| Scope | Trigger | Action |
|---|---|---|
| Any file edit | After saving | Run lint. Fix all errors before the next edit. |
| Logical unit of work | Before moving to the next feature, route, or schema change | Run unit tests. Fix failures before continuing. |
| Spec route release | Before releasing a Webmention, Micropub, IndieAuth, or WebSub change | Run the corresponding external integration test. |
| Merge | Before merging any branch | Complete the pre-merge checklist below. |

A logical unit of work is describable in a single commit message — a new
route, spec endpoint, schema change, or component. A typo fix, comment,
style tweak, or single-file rename does not qualify. Do not accumulate
failures across units.

> The applicable lint and test commands are in the nearest framework
> AGENTS.md. Check there before running any check.

## External Integration Tests

Run these against the corresponding spec routes before any release:

- Webmention — [webmention.rocks](https://webmention.rocks)
- Micropub — [micropub.rocks](https://micropub.rocks)
- IndieAuth — [indieauth.rocks](https://indieauth.rocks)

## Pre-Merge Checklist

- [ ] `rel=me` is bidirectional for all configured profiles
- [ ] Every post has `h-entry` with `u-url`, `dt-published`, `e-content`
- [ ] `POST /api/webmention` returns 202 for valid source/target
- [ ] `/.well-known/oauth-authorization-server` returns valid IndieAuth metadata
- [ ] `GET /api/micropub?q=config` returns valid config
- [ ] Atom feed has `rel=hub` and `rel=self`
- [ ] Export endpoints return valid output
- [ ] No new vendor dependency without `docs/dependencies.md` entry
- [ ] No active constraint in CONSTRAINTS.md violated
- [ ] DECISIONS.md updated with any autobuild-mode choices this session
- [ ] Corrections and confirmed preferences recorded in MEMORY.md