## Goal

Preserve unmentioned SVG elements during generated-art-piece refinement when
multiple identified elements share one source line. An element-targeted
revision must change only the named element and must create a new version only
when preservation succeeds.

## Fixed entry point / fixture

Authenticated generated-piece editor route
`/users/@e2e_owner/edit/<slug>` with `AI_PROVIDER=fake`; an SVG source with a
`rect id="target"` and `circle id="other"` on the same line. Mention
`@target`, request a warmer target, and inspect the accepted version and the
rendered error state.

## Acceptance criteria

- `@target` resolves as an SVG element mention and a successful fake-provider
  refinement changes the target element's fill while keeping the `other`
  element byte-identical.
- The accepted run stores exactly one new version and retains the unchanged
  source outside the targeted element.
- A refinement that changes an unmentioned same-line element is rejected with
  `unmentioned_region_changed:other` and stores no new version.
- Existing multiline SVG-group preservation tests and all existing generated
  art-piece refine tests remain green.
- Focused backend tests, frontend targeting test listing, and `make check`
  are recorded; active Chrome at 1280x900 and 375x812 must inspect the
  targeted workflow or the exact environment boundary must be recorded.

## Out of scope

Changing the public refine API, marker generation, production data, or closed
#820's historical contract.

## Routing

Stage 2b complex: backend preservation logic and focused tests; no migration
or provider contract change is expected.

## Discovery

Found while running #921 after #958. Closed #820 covers the earlier general
preservation contract but not same-line SVG element extraction. This issue is
the linked corrective follow-up; #921 remains open until its SVG criterion is
verified.
