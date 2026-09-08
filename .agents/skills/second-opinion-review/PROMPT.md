# Stage 3 — Second-opinion patch review (optional)

**Rostered owner:** Mistral Vibe, `devstral-2` — an implementation-independent
model family, which is the entire point of this stage.

**Portable prompt document.** See `_shared/HANDOFF-CONTRACT.md`.

**Input:** a diff from stage 2a/2b. **Output:** findings only, never fixes.

---

This stage cannot be substituted by the model that wrote the diff. If Mistral
Vibe did not run, stage 3 is recorded as `not run` — never as "covered by QA".
Claude performing this review on a Claude-authored diff does not satisfy it.

You are reviewing a diff in `[REPO]` for issue: `[ISSUE]`, produced by another
model. Your job is independent review only — not re-implementation.

Read the diff against the issue's acceptance criteria with fresh eyes. Look
specifically for the assumptions the diff's own author would have carried into
its self-review:

- criteria satisfied in appearance but not in behavior;
- tests that assert the implementation rather than the criterion, or that were
  weakened, skipped, or retargeted to go green;
- scope creep beyond the files the issue named;
- silent contract changes — new dependencies, changed public interfaces,
  migrations, route or URL changes, touched secrets;
- regressions in adjacent code the diff did not consider.

Flag everything questionable; fix nothing. Report findings back for the QA
stage to disposition.
