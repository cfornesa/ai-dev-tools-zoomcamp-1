---
name: memory-files
description: Rules for reading, writing, and maintaining MEMORY.md, DECISIONS.md, CONSTRAINTS.md, and DESIGN.md across sessions.
trigger: End of session; proposing MEMORY.md or DECISIONS.md updates.
---

# Memory Files

## File Responsibilities

| File | Written by | Read every session |
|---|---|---|
| AGENTS.md | Human only | Yes |
| MEMORY.md | Agent (on confirmation) | Yes |
| DECISIONS.md | Agent | Yes |
| CONSTRAINTS.md | Agent (on statement) | Yes |
| DESIGN.md | Human + agent | Only when design work occurs |

## Creating Files

- **Interactive mode** — ask before creating MEMORY.md or DESIGN.md for
  the first time.
- **Auto Build mode** — create DECISIONS.md at session start without
  asking; note it in build output. Ask before creating MEMORY.md even
  in auto mode.
- **CONSTRAINTS.md** — create at the project root the first time a
  constraint is stated in any session. Always required; not conditional
  on whether AGENTS.md is read-only.

## MEMORY.md Rules

- Write only confirmed, repeated, or clearly stable lessons.
- Keep under 150 lines. When near the limit, ask the person to review;
  move older entries to `docs/memory-archive.md`.
- No secrets, tokens, or personal data.
- Flag contradictions — do not silently overwrite existing entries.
- When a DECISIONS.md entry becomes stable and user-confirmed, summarize
  it as a DECISION entry here.

**Entry format** — one line per lesson, optional note on the next line:
YYYY-MM-DD CATEGORY Lesson in one sentence.
Optional one-line note with context or source decision.


**Valid categories:** `PREFERENCE` `CORRECTION` `CONSTRAINT` `DECISION` `STACK`

## CONSTRAINTS.md Format

One entry per constraint, recorded immediately when stated:
CONSTRAINT plain-language description
SCOPE what it applies to
SET date or "this session"


Constraints are permanent until explicitly lifted. When a person says
something that could lift a constraint, confirm before acting:
> "Are you removing this constraint permanently, or just for this feature?"

## End-of-Session Requirement (Interactive Mode)

Before the final response of any session:

1. Propose 1–3 MEMORY.md entries in the standard format above.
2. Propose any queued DESIGN.md Observed Taste entries.
3. Ask: "Should I write these to MEMORY.md and DESIGN.md?"
4. Do not write either without confirmation.

If the session ends without this step, log both as unresolved checkpoints
in DECISIONS.md.

## AGENTS.md Safeguard

- Never edit without explicit human instruction.
- If AGENTS.md is non-empty when first read, it is the standing
  instruction set. Never replace its contents — only append.
- Present any change as a clearly marked diff; wait for approval before
  applying.
- After any approved change, log what changed in DECISIONS.md and
  summarize in MEMORY.md.
- This file is owned by the person, not the session.