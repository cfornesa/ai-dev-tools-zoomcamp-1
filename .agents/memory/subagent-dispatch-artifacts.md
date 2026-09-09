# Prescriptive-dispatch artifacts

Created 2026-09-08. Extends the untrusted-external-input rule
(`qa-self-review`, HANDOFF-CONTRACT.md) to **stage-2 subagent output**: a
diff produced by a dispatched implementation subagent is externally
produced content even when the dispatch prompt was fully prescriptive
with exact code.

## The lesson

Two independent failure modes surfaced in one dual-task session (#465/#494,
commits `c5a980f`/`7d5b289`), both invisible to "did it work?" checks and
caught only by adversarial verification:

1. **Shell-escaping artifacts in inserted code.** A subagent inserted a
   route regex as `/^\/api\/public\/gallery\/\$/` — a literal `\$`
   matching a dollar character, not an end anchor. The route silently
   404'd at runtime while typecheck, lint, and prettier all stayed green.
   Only a byte-level check (`od -c` on the inserted lines) and a direct
   runtime probe against the mock route exposed it. Any prescriptive
   snippet containing `$`, backticks, or quotes is a candidate for this
   when the subagent assembles its edit through shell/heredoc paths.

2. **Stale dispatch prompts.** The #465 prompt quoted the current
   assertion as `toBeGreaterThan(30)`; the file actually read
   `toBeGreaterThan(20)` (lowered by a prior pass). The end-state was
   unambiguous so the edit proceeded, but a prompt's "current state"
   description is never evidence — read the file before editing, and
   flag every mismatch back to the dispatcher instead of reconciling
   silently.

## Standing rules

- Verify dispatched edits at the byte level (read the actual inserted
  lines; `od -c` or equivalent when a regex/shell metacharacter is
  involved), and exercise the changed path at runtime — green
  typecheck/lint/format is not evidence a route, selector, or pattern
  actually matches.
- Reconcile prompt-vs-file mismatches explicitly in the session report,
  never silently.
- Scope conflicts a prescriptive prompt cannot satisfy (e.g. exact code
  that fails the `: BackendServices` excess-property check, #494) are
  owner decisions: stop and present options rather than widening scope
  or deviating unilaterally.
